const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const seed = require('./data/seed');
const medicationsData = require('./data/medications');
const { evaluateHealthEvidence, detectHealthEvidence } = require('./health-evidence');
const { extractTextFromImageBase64 } = require('./ocr');
const { createToken, getUserIdFromToken } = require('./auth');
const { docClient, USERS_TABLE, POSTS_TABLE, useDynamo } = require('./db');

const conditions = [...seed.conditions];
const services = [...seed.services];
const medications = [...medicationsData];
const recommendationsByCondition = { ...seed.recommendationsByCondition };

// Fallback en memoria para desarrollo local sin DynamoDB
const LOCAL_USERS_FILE = path.join(__dirname, 'data/local-users.json');
const seedEmails = new Set(seed.users.map((u) => u.email.toLowerCase()));

function loadRegisteredUsers() {
  try {
    if (!fs.existsSync(LOCAL_USERS_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(LOCAL_USERS_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function persistRegisteredUsers() {
  if (useDynamo()) return;
  const registered = memoryUsers.filter((u) => !seedEmails.has(u.email.toLowerCase()));
  fs.mkdirSync(path.dirname(LOCAL_USERS_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(registered, null, 2));
}

let memoryUsers = [...seed.users];
for (const user of loadRegisteredUsers()) {
  if (!memoryUsers.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
    memoryUsers.push(user);
  }
}
let memoryPosts = [...seed.posts];

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function getConditions() {
  return conditions;
}

function getConditionById(id) {
  return conditions.find((c) => c.id === id);
}

function getRecommendations(conditionId) {
  const condition = getConditionById(conditionId);
  if (!condition) return null;
  return {
    condition,
    recommendations: recommendationsByCondition[conditionId] || [],
  };
}

function getServices({ conditionId } = {}) {
  if (!conditionId) return services;
  return services.filter((s) => s.conditionIds.includes(conditionId));
}

function normalizeMedQuery(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeOcrText(value) {
  return normalizeMedQuery(value).replace(/[^a-z0-9]/g, '');
}

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.includes(shorter) && shorter.length >= 5) {
    return shorter.length / longer.length;
  }

  const costs = Array.from({ length: shorter.length + 1 }, (_, i) => i);
  for (let i = 1; i <= longer.length; i += 1) {
    let prev = i - 1;
    costs[0] = i;
    for (let j = 1; j <= shorter.length; j += 1) {
      const temp = costs[j];
      const cost = longer[i - 1] === shorter[j - 1] ? prev : prev + 1;
      prev = costs[j];
      costs[j] = Math.min(costs[j] + 1, costs[j - 1] + 1, cost);
    }
  }
  const distance = costs[shorter.length];
  return 1 - distance / longer.length;
}

function scoreIngredientCombo(m, cleanLines) {
  const ingredients = m.activeIngredients ?? [];
  if (!ingredients.length) return 99;

  const combined = cleanLines.join(' ');
  const hits = ingredients.filter((ing) => fuzzyIngredientMatch(ing, combined));

  if (ingredients.length >= 2) {
    if (hits.length >= ingredients.length) return 0;
    if (hits.length >= 2) return 1;
  } else if (hits.length === 1) {
    return 2;
  }
  return 99;
}

function fuzzyIngredientMatch(ingredient, text) {
  const ing = normalizeOcrText(ingredient);
  const haystack = normalizeOcrText(text);
  if (!ing || !haystack) return false;

  if (haystack.includes(ing) || ing.includes(haystack)) return true;
  if (stringSimilarity(haystack, ing) >= 0.82) return true;

  // OCR suele omitir la primera letra (Dropropizina → ropropizina).
  if (ing.length >= 6 && haystack.includes(ing.slice(1))) return true;
  if (haystack.length >= 6 && ing.includes(haystack.slice(1))) return true;

  const tokens = [
    ...(text.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{5,}/g) ?? []),
    ...text.split(/[,;/]+/).map((p) => p.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, '')),
  ]
    .map((t) => normalizeOcrText(t))
    .filter((t) => t.length >= 5);

  for (const token of tokens) {
    if (token.includes(ing) || ing.includes(token)) return true;
    if (stringSimilarity(token, ing) >= 0.84) return true;
    if (ing.length >= 6 && token.includes(ing.slice(1))) return true;
    if (token.length >= 6 && ing.includes(token.slice(1))) return true;
  }

  return false;
}

const MAX_CLOSE_MATCHES = 3;

function pickClosestMatches(ranked, { conditionId, limit = MAX_CLOSE_MATCHES } = {}) {
  if (!ranked.length) return [];

  let pool = ranked;
  if (conditionId) {
    const related = ranked.filter(({ m }) => m.conditionIds.includes(conditionId));
    if (related.length) pool = related;
  }

  const bestScore = pool[0].score;
  return pool
    .filter(({ score }) => score === bestScore)
    .slice(0, limit)
    .map(({ m }) => m);
}

function buildMatchResult(mode, matches, extra = {}) {
  return {
    mode,
    matches,
    match: matches.length === 1 ? matches[0] : matches[0] ?? null,
    ...extra,
  };
}

function scoreQueryMatch(m, q, tokens) {
  const fields = [
    ...m.brandNames.map(normalizeMedQuery),
    normalizeMedQuery(m.name),
    normalizeMedQuery(m.form),
    ...(m.activeIngredients ?? []).map(normalizeMedQuery),
    ...(m.ocrKeywords ?? []).map(normalizeMedQuery),
  ];
  let best = 99;
  for (const field of fields) {
    if (!field) continue;
    if (field === q) best = Math.min(best, 0);
    else if (field.startsWith(q)) best = Math.min(best, 1);
    else if (tokens.every((t) => field.includes(t))) best = Math.min(best, 2);
    else if (field.includes(q)) best = Math.min(best, 3);
  }

  const combined = tokens.join(' ');
  if (tokens.length >= 2 && (m.activeIngredients ?? []).length >= 2) {
    const hits = m.activeIngredients.filter((ing) => fuzzyIngredientMatch(ing, combined));
    if (hits.length >= m.activeIngredients.length) best = Math.min(best, 0);
    else if (hits.length >= 2) best = Math.min(best, 1);
  }

  for (const ing of m.activeIngredients ?? []) {
    if (fuzzyIngredientMatch(ing, q)) best = Math.min(best, 2);
  }

  return best;
}

function scoreOcrMatch(m, cleanLines) {
  const comboScore = scoreIngredientCombo(m, cleanLines);
  if (comboScore < 99) return comboScore;

  const tryField = (field, penalty) => {
    if (field.length < 4) return 99;
    let best = 99;

    for (const line of cleanLines) {
      const nl = normalizeOcrText(line);
      if (!nl) continue;

      if (nl === field) best = Math.min(best, 0 + penalty);
      else if (nl.includes(field) || field.includes(nl)) best = Math.min(best, 1 + penalty);
      else if (stringSimilarity(nl, field) >= 0.78) best = Math.min(best, 1 + penalty);
      else {
        const tokens = field.match(/[a-z0-9]{5,}/g) ?? [];
        if (!tokens.length) continue;
        const hits = tokens.filter((t) => nl.includes(t)).length;
        if (hits >= 2 || (tokens.length === 1 && hits === 1)) {
          best = Math.min(best, 2 + penalty);
        }
      }
    }
    return best;
  };

  let best = 99;
  for (const brand of m.brandNames) {
    best = Math.min(best, tryField(normalizeOcrText(brand), 0));
  }
  best = Math.min(best, tryField(normalizeOcrText(m.name), 0));

  for (const keyword of m.ocrKeywords ?? []) {
    best = Math.min(best, tryField(normalizeOcrText(keyword), 0));
  }

  for (const ingredient of m.activeIngredients ?? []) {
    if (fuzzyIngredientMatch(ingredient, cleanLines.join(' '))) {
      best = Math.min(best, 2);
    }
    best = Math.min(best, tryField(normalizeOcrText(ingredient), 3));
  }

  return best;
}

function identifyMedications({ barcode, query, conditionId } = {}) {
  let pool = medications;

  if (conditionId) {
    pool = pool.filter((m) => m.conditionIds.includes(conditionId));
  }

  if (barcode) {
    const code = String(barcode).trim();
    const match = medications.find(
      (m) => m.barcode === code || m.barcodes?.includes(code)
    );
    return {
      mode: 'barcode',
      match: match ?? null,
      suggestions: match ? [] : pool.slice(0, 5),
    };
  }

  if (query) {
    const q = normalizeMedQuery(query);
    const tokens = q.split(/\s+/).filter(Boolean);

    const ranked = medications
      .map((m) => ({ m, score: scoreQueryMatch(m, q, tokens) }))
      .filter(({ score }) => score < 99)
      .sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name));

    const filtered = pickClosestMatches(ranked, { conditionId });

    return buildMatchResult('search', filtered);
  }

  return { mode: 'list', matches: pool };
}

function identifyFromOcrText(text, conditionId) {
  const rawLines = String(text)
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const { cleanOcrLines } = require('./ocr');
  const cleanLines = cleanOcrLines(rawLines);

  const ranked = medications
    .map((m) => ({ m, score: scoreOcrMatch(m, cleanLines) }))
    .filter(({ score }) => score < 99)
    .sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name));

  const filtered = pickClosestMatches(ranked, { conditionId });

  return buildMatchResult('ocr', filtered, { detectedLines: cleanLines });
}

async function identifyFromImageBase64(imageBase64, conditionId) {
  const { text, lines } = await extractTextFromImageBase64(imageBase64);
  if (!text.trim()) {
    return {
      mode: 'ocr',
      matches: [],
      match: null,
      detectedLines: lines,
      ocrEmpty: true,
      ocrEngine: 'tesseract-local',
    };
  }
  return {
    ...identifyFromOcrText(text, conditionId),
    ocrEngine: 'tesseract-local',
  };
}

async function findUserByEmail(email) {
  const normalized = email.toLowerCase();

  if (useDynamo()) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': normalized },
        Limit: 1,
      })
    );
    return result.Items?.[0] ?? null;
  }

  return memoryUsers.find((u) => u.email.toLowerCase() === normalized) ?? null;
}

async function getUserById(id) {
  if (useDynamo()) {
    const result = await docClient.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { id } })
    );
    return sanitizeUser(result.Item);
  }

  const user = memoryUsers.find((u) => u.id === id);
  return sanitizeUser(user);
}

async function saveUser(user) {
  if (useDynamo()) {
    await docClient.send(new PutCommand({ TableName: USERS_TABLE, Item: user }));
    return;
  }
  const index = memoryUsers.findIndex((u) => u.id === user.id);
  if (index >= 0) memoryUsers[index] = user;
  else memoryUsers.push(user);
  persistRegisteredUsers();
}

async function getAllUsers() {
  if (useDynamo()) {
    const result = await docClient.send(new ScanCommand({ TableName: USERS_TABLE }));
    return result.Items ?? [];
  }
  return memoryUsers;
}

async function getUsers({ conditionId, needsHelp } = {}) {
  let result = (await getAllUsers()).map(sanitizeUser);

  if (conditionId) {
    result = result.filter((u) => u.conditionIds?.includes(conditionId));
  }
  if (needsHelp === 'true' || needsHelp === true) {
    result = result.filter((u) => u.needsHelp);
  }
  return result;
}

async function getClusters({ conditionId } = {}) {
  const filtered = (await getUsers({ conditionId })).filter(
    (u) => u.latitude && u.longitude
  );
  const clusters = {};

  filtered.forEach((user) => {
    const key = `${user.latitude.toFixed(2)},${user.longitude.toFixed(2)}`;
    if (!clusters[key]) {
      clusters[key] = {
        latitude: user.latitude,
        longitude: user.longitude,
        count: 0,
        city: user.city,
        conditionIds: new Set(),
      };
    }
    clusters[key].count += 1;
    user.conditionIds.forEach((cid) => clusters[key].conditionIds.add(cid));
  });

  return Object.values(clusters).map((c) => ({
    latitude: c.latitude,
    longitude: c.longitude,
    count: c.count,
    city: c.city,
    conditionIds: [...c.conditionIds],
  }));
}

async function login(email, password) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const plainPassword = String(password ?? '');
  if (!normalizedEmail || !plainPassword) return null;

  const user = await findUserByEmail(normalizedEmail);
  if (!user || user.passwordHash !== seed.hashPassword(plainPassword)) {
    return null;
  }
  const token = createToken(user.id);
  return { user: sanitizeUser(user), token };
}

async function register(data) {
  const email = String(data.email ?? '').trim().toLowerCase();
  const password = String(data.password ?? '');
  const name = String(data.name ?? '').trim();

  if (!email || !password || !name) {
    return { error: 'Nombre, email y contraseña requeridos' };
  }

  if (await findUserByEmail(email)) {
    return { error: 'El email ya está registrado' };
  }

  const user = {
    id: uuidv4(),
    name,
    email,
    passwordHash: seed.hashPassword(password),
    conditionIds: data.conditionIds || [],
    latitude: data.latitude,
    longitude: data.longitude,
    city: data.city || '',
    bio: data.bio || '',
    needsHelp: false,
    createdAt: new Date().toISOString(),
  };

  await saveUser(user);
  const token = createToken(user.id);
  return { user: sanitizeUser(user), token };
}

async function updateUserById(id, updates) {
  if (useDynamo()) {
    const existing = await docClient.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { id } })
    );
    if (!existing.Item) return null;

    const allowed = ['name', 'bio', 'needsHelp', 'conditionIds', 'latitude', 'longitude', 'city'];
    const updated = { ...existing.Item };
    allowed.forEach((key) => {
      if (updates[key] !== undefined) updated[key] = updates[key];
    });

    await docClient.send(new PutCommand({ TableName: USERS_TABLE, Item: updated }));
    return sanitizeUser(updated);
  }

  const index = memoryUsers.findIndex((u) => u.id === id);
  if (index === -1) return null;

  const allowed = ['name', 'bio', 'needsHelp', 'conditionIds', 'latitude', 'longitude', 'city'];
  allowed.forEach((key) => {
    if (updates[key] !== undefined) memoryUsers[index][key] = updates[key];
  });

  persistRegisteredUsers();
  return sanitizeUser(memoryUsers[index]);
}

async function getAllPosts() {
  if (useDynamo()) {
    const result = await docClient.send(new ScanCommand({ TableName: POSTS_TABLE }));
    return result.Items ?? [];
  }
  return memoryPosts;
}

async function getPosts({ conditionId } = {}) {
  let result = await getAllPosts();

  if (conditionId) {
    result = result.filter((p) => p.conditionId === conditionId);
  }

  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function createPost(userId, data) {
  const user = await getUserById(userId);
  if (!user) return null;

  const post = {
    id: uuidv4(),
    userId,
    userName: user.name,
    conditionId: data.conditionId,
    title: data.title,
    content: data.content,
    tags: data.tags || [],
    likes: 0,
    createdAt: new Date().toISOString(),
  };

  if (useDynamo()) {
    await docClient.send(new PutCommand({ TableName: POSTS_TABLE, Item: post }));
  } else {
    memoryPosts.unshift(post);
  }

  return post;
}

async function likePost(id) {
  if (useDynamo()) {
    const existing = await docClient.send(
      new GetCommand({ TableName: POSTS_TABLE, Key: { id } })
    );
    if (!existing.Item) return null;

    const updated = { ...existing.Item, likes: (existing.Item.likes || 0) + 1 };
    await docClient.send(new PutCommand({ TableName: POSTS_TABLE, Item: updated }));
    return updated;
  }

  const post = memoryPosts.find((p) => p.id === id);
  if (!post) return null;
  post.likes += 1;
  return post;
}

function logout() {
  // JWT es stateless; el cliente elimina el token
}

async function evaluateEvidence(payload) {
  return evaluateHealthEvidence(payload);
}

async function detectEvidence(payload) {
  return detectHealthEvidence(payload);
}

module.exports = {
  getConditions,
  getConditionById,
  getRecommendations,
  getServices,
  identifyMedications,
  identifyFromOcrText,
  identifyFromImageBase64,
  getUsers,
  getClusters,
  login,
  register,
  getUserById,
  getUserIdFromToken,
  updateUserById,
  getPosts,
  createPost,
  likePost,
  logout,
  saveUser,
  useDynamo,
  evaluateEvidence,
  detectEvidence,
};
