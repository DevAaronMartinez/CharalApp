import medicationsJson from '@/data/medications.json';
import type { Medication, MedicationIdentifyResult } from '@/types';

type CatalogMed = Medication & {
  barcodes?: string[];
  ocrKeywords?: string[];
};

const medications = medicationsJson as CatalogMed[];

const MAX_CLOSE_MATCHES = 3;

function normalizeMedQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeOcrText(value: string): string {
  return normalizeMedQuery(value).replace(/[^a-z0-9]/g, '');
}

function stringSimilarity(a: string, b: string): number {
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

function fuzzyIngredientMatch(ingredient: string, text: string): boolean {
  const ing = normalizeOcrText(ingredient);
  const haystack = normalizeOcrText(text);
  if (!ing || !haystack) return false;

  if (haystack.includes(ing) || ing.includes(haystack)) return true;
  if (stringSimilarity(haystack, ing) >= 0.82) return true;

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

function scoreIngredientCombo(m: CatalogMed, cleanLines: string[]): number {
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

function pickClosestMatches(
  ranked: { m: CatalogMed; score: number }[],
  { conditionId, limit = MAX_CLOSE_MATCHES }: { conditionId?: string; limit?: number } = {}
): CatalogMed[] {
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

function buildMatchResult(
  mode: MedicationIdentifyResult['mode'],
  matches: CatalogMed[],
  extra: Partial<MedicationIdentifyResult> = {}
): MedicationIdentifyResult {
  return {
    mode,
    matches,
    match: matches.length === 1 ? matches[0] : (matches[0] ?? null),
    ...extra,
  };
}

function scoreQueryMatch(m: CatalogMed, q: string, tokens: string[]): number {
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
    const hits = m.activeIngredients!.filter((ing) => fuzzyIngredientMatch(ing, combined));
    if (hits.length >= m.activeIngredients!.length) best = Math.min(best, 0);
    else if (hits.length >= 2) best = Math.min(best, 1);
  }

  for (const ing of m.activeIngredients ?? []) {
    if (fuzzyIngredientMatch(ing, q)) best = Math.min(best, 2);
  }

  return best;
}

function scoreOcrMatch(m: CatalogMed, cleanLines: string[]): number {
  const comboScore = scoreIngredientCombo(m, cleanLines);
  if (comboScore < 99) return comboScore;

  const tryField = (field: string, penalty: number) => {
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

function letterRatio(line: string): number {
  const chars = line.replace(/\s/g, '');
  if (!chars.length) return 0;
  const letters = (chars.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) ?? []).length;
  return letters / chars.length;
}

function isUsefulOcrLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 4) return false;
  if (letterRatio(trimmed) < 0.45) return false;

  const junk = (trimmed.match(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s,./\-+%]/g) ?? []).length;
  if (junk / trimmed.length > 0.3) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{5,}/.test(w));
  if (meaningful.length >= 1) return true;

  if (/,/.test(trimmed) && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(trimmed)) return true;

  return false;
}

export function cleanOcrLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  const pushLine = (line: string) => {
    const normalized = line.trim().replace(/\s+/g, ' ');
    if (!isUsefulOcrLine(normalized)) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(normalized);
  };

  for (const line of lines) {
    pushLine(line);

    const tokens = line.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{5,}/gi) ?? [];
    if (tokens.length >= 2) {
      pushLine(tokens.join(', '));
    }
  }

  return cleaned.sort((a, b) => b.length - a.length);
}

export function identifyMedications(params: {
  barcode?: string;
  query?: string;
  conditionId?: string;
} = {}): MedicationIdentifyResult {
  const { barcode, query, conditionId } = params;
  let pool = medications;

  if (conditionId) {
    pool = pool.filter((m) => m.conditionIds.includes(conditionId));
  }

  if (barcode) {
    const code = String(barcode).trim();
    const match =
      medications.find((m) => m.barcode === code || m.barcodes?.includes(code)) ?? null;
    return {
      mode: 'barcode',
      match,
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

  return { mode: 'list', matches: pool, match: null };
}

export function identifyFromOcrText(
  text: string,
  conditionId?: string
): MedicationIdentifyResult {
  const rawLines = String(text)
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const cleanLines = cleanOcrLines(rawLines);

  const ranked = medications
    .map((m) => ({ m, score: scoreOcrMatch(m, cleanLines) }))
    .filter(({ score }) => score < 99)
    .sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name));

  const filtered = pickClosestMatches(ranked, { conditionId });
  return buildMatchResult('ocr', filtered, { detectedLines: cleanLines });
}

/** OCR on-device + match local (sin backend). */
export async function identifyMedicationFromPhotoLocal(
  uri: string,
  conditionId: string | undefined,
  extractText: (uri: string) => Promise<{ lines: string[]; available: boolean }>
): Promise<MedicationIdentifyResult> {
  const { lines, available } = await extractText(uri);
  if (!available || !lines.length) {
    return {
      mode: 'ocr',
      matches: [],
      match: null,
      detectedLines: lines,
    };
  }
  return identifyFromOcrText(lines.join('\n'), conditionId);
}

export function getMedicationsCatalogSize(): number {
  return medications.length;
}
