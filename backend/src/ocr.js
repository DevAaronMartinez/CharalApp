const Tesseract = require('tesseract.js');
const sharp = require('sharp');

const { PSM } = Tesseract;

let workerPromise;

async function getWorker() {
  if (!workerPromise) {
    const worker = await Tesseract.createWorker('spa+eng', 1, {
      logger: () => {},
    });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });
    workerPromise = worker;
  }
  return workerPromise;
}

/** Variantes de imagen para mejorar lectura del envase. */
async function buildOcrVariants(buffer) {
  const meta = await sharp(buffer).metadata();
  const targetWidth = Math.min(Math.max(meta.width ?? 1200, 1400), 2400);

  const base = sharp(buffer).rotate().resize(targetWidth, null, {
    fit: 'inside',
    withoutEnlargement: false,
  });

  const [highContrast, sharpText, centerCrop] = await Promise.all([
    base
      .clone()
      .grayscale()
      .normalize()
      .linear(1.35, -25)
      .sharpen({ sigma: 1.2 })
      .png()
      .toBuffer(),
    base
      .clone()
      .grayscale()
      .median(3)
      .normalize()
      .sharpen({ sigma: 1.8 })
      .png()
      .toBuffer(),
    base
      .clone()
      .extract({
        left: Math.floor((meta.width ?? targetWidth) * 0.08),
        top: Math.floor((meta.height ?? targetWidth) * 0.12),
        width: Math.floor((meta.width ?? targetWidth) * 0.84),
        height: Math.floor((meta.height ?? targetWidth) * 0.76),
      })
      .grayscale()
      .normalize()
      .linear(1.4, -30)
      .sharpen()
      .png()
      .toBuffer()
      .catch(() => null),
  ]);

  return [highContrast, sharpText, centerCrop].filter(Boolean);
}

function letterRatio(line) {
  const chars = line.replace(/\s/g, '');
  if (!chars.length) return 0;
  const letters = (chars.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) ?? []).length;
  return letters / chars.length;
}

function isUsefulOcrLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 4) return false;
  if (letterRatio(trimmed) < 0.45) return false;

  const junk = (trimmed.match(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s,./\-+%]/g) ?? []).length;
  if (junk / trimmed.length > 0.3) return false;

  // Descarta líneas casi solo símbolos o una letra suelta repetida.
  const words = trimmed.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{5,}/.test(w));
  if (meaningful.length >= 1) return true;

  // Líneas tipo "Amantadina, Clorfenamina, Paracetamol"
  if (/,/.test(trimmed) && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(trimmed)) return true;

  return false;
}

function cleanOcrLines(lines) {
  const seen = new Set();
  const cleaned = [];

  const pushLine = (line) => {
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

function mergeLines(existing, incoming) {
  const seen = new Set(existing.map((l) => l.toLowerCase()));
  for (const line of incoming) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      existing.push(line);
    }
  }
  return existing;
}

async function recognizeBuffer(worker, buffer) {
  const { data } = await worker.recognize(buffer);
  const raw = data.text ?? '';
  const lines = raw
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return { raw, lines };
}

/**
 * OCR local con Tesseract + preprocesado de imagen.
 */
async function extractTextFromImageBase64(imageBase64) {
  const worker = await getWorker();
  const buffer = Buffer.from(imageBase64, 'base64');
  const variants = await buildOcrVariants(buffer);

  let rawParts = [];
  let allLines = [];

  for (const variant of variants) {
    const { raw, lines } = await recognizeBuffer(worker, variant);
    if (raw.trim()) rawParts.push(raw.trim());
    allLines = mergeLines(allLines, lines);
  }

  const cleanLines = cleanOcrLines(allLines);

  return {
    text: cleanLines.join('\n'),
    lines: cleanLines,
    rawLines: allLines,
  };
}

/** Variantes para pantallas LCD (glucómetro, tensiómetro). */
async function buildDigitOcrVariants(buffer) {
  const meta = await sharp(buffer).metadata();
  const targetWidth = Math.min(Math.max(meta.width ?? 900, 1200), 2200);

  const base = sharp(buffer).rotate().resize(targetWidth, null, {
    fit: 'inside',
    withoutEnlargement: false,
  });

  const [lcd, inverted, center] = await Promise.all([
    base
      .clone()
      .grayscale()
      .normalize()
      .linear(2.2, -60)
      .sharpen({ sigma: 2.4 })
      .png()
      .toBuffer(),
    base
      .clone()
      .grayscale()
      .negate()
      .normalize()
      .linear(1.6, -25)
      .sharpen({ sigma: 1.6 })
      .png()
      .toBuffer(),
    base
      .clone()
      .extract({
        left: Math.floor((meta.width ?? targetWidth) * 0.15),
        top: Math.floor((meta.height ?? targetWidth) * 0.2),
        width: Math.floor((meta.width ?? targetWidth) * 0.7),
        height: Math.floor((meta.height ?? targetWidth) * 0.55),
      })
      .grayscale()
      .normalize()
      .linear(2.5, -70)
      .sharpen({ sigma: 2 })
      .png()
      .toBuffer()
      .catch(() => null),
  ]);

  return [lcd, inverted, center].filter(Boolean);
}

async function recognizeBufferWithPsm(worker, buffer, psm) {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
  });
  return recognizeBuffer(worker, buffer);
}

async function recognizeDigitsOnly(worker, buffer) {
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: '0123456789',
    preserve_interword_spaces: '0',
  });
  const { raw, lines } = await recognizeBuffer(worker, buffer);
  await worker.setParameters({
    tessedit_char_whitelist: '',
    preserve_interword_spaces: '1',
  });
  const fromRaw = (raw.match(/\d{2,3}/g) ?? [])
    .map((part) => part.trim())
    .filter((part) => {
      const value = Number(part);
      return value >= 20 && value <= 600;
    });

  const merged = [...new Set([...lines.map((l) => l.trim()).filter((l) => /^\d{2,3}$/.test(l)), ...fromRaw])];

  return { raw, lines: merged };
}

async function buildDisplayCropVariants(buffer) {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 900;
  const h = meta.height ?? 1200;
  const targetWidth = Math.min(Math.max(w, 1000), 2000);

  const crops = [
    { left: 0.2, top: 0.08, width: 0.6, height: 0.35 },
    { left: 0.25, top: 0.32, width: 0.5, height: 0.28 },
    { left: 0.22, top: 0.28, width: 0.56, height: 0.38 },
    { left: 0.15, top: 0.2, width: 0.7, height: 0.55 },
  ];

  const variants = [];
  for (const crop of crops) {
    try {
      const buf = await sharp(buffer)
        .rotate()
        .extract({
          left: Math.floor(w * crop.left),
          top: Math.floor(h * crop.top),
          width: Math.max(1, Math.floor(w * crop.width)),
          height: Math.max(1, Math.floor(h * crop.height)),
        })
        .resize(targetWidth, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .normalize()
        .linear(2.4, -65)
        .sharpen({ sigma: 2.2 })
        .png()
        .toBuffer();
      variants.push(buf);
    } catch {
      // ignore invalid crop on tiny images
    }
  }

  return variants;
}

/** OCR sin filtro de medicamentos — útil para lecturas numéricas (PA, glucosa). */
async function extractRawTextFromImageBase64(imageBase64) {
  const worker = await getWorker();
  const buffer = Buffer.from(imageBase64, 'base64');
  const variants = await buildOcrVariants(buffer);
  const digitVariants = await buildDigitOcrVariants(buffer);
  const displayCrops = await buildDisplayCropVariants(buffer);

  let allLines = [];
  let rawParts = [];
  let digitLines = [];
  let displayParts = [];

  for (const crop of displayCrops) {
    for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_BLOCK]) {
      const { raw, lines } = await recognizeBufferWithPsm(worker, crop, psm);
      if (raw.trim()) {
        rawParts.unshift(raw.trim());
        displayParts.push(raw.trim());
      }
      allLines = mergeLines(allLines, lines);
    }
    const digits = await recognizeDigitsOnly(worker, crop);
    if (digits.raw.trim()) {
      rawParts.unshift(digits.raw.trim());
      displayParts.push(digits.raw.trim());
    }
    digitLines = mergeLines(digitLines, digits.lines);
  }

  for (const variant of variants) {
    const { raw, lines } = await recognizeBufferWithPsm(worker, variant, PSM.SINGLE_BLOCK);
    if (raw.trim()) rawParts.push(raw.trim());
    allLines = mergeLines(allLines, lines);
  }

  for (const variant of digitVariants) {
    for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_WORD, PSM.SPARSE_TEXT]) {
      const { raw, lines } = await recognizeBufferWithPsm(worker, variant, psm);
      if (raw.trim()) rawParts.push(raw.trim());
      allLines = mergeLines(allLines, lines);
    }
    const digits = await recognizeDigitsOnly(worker, variant);
    if (digits.lines.length) digitLines = mergeLines(digitLines, digits.lines);
  }

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: '',
    preserve_interword_spaces: '1',
  });

  const cleanedLines = allLines
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l.length >= 1);
  const numericLines = mergeLines([...digitLines], cleanedLines);

  const displayHint = digitLines.length ? `mg/dl\n${digitLines.join('\n')}` : '';

  return {
    text: numericLines.join('\n'),
    lines: numericLines,
    rawText: [displayHint, rawParts.join('\n')].filter(Boolean).join('\n'),
    digitLines,
    displayText: [displayHint, ...displayParts].filter(Boolean).join('\n'),
  };
}

module.exports = { extractTextFromImageBase64, extractRawTextFromImageBase64, cleanOcrLines, isUsefulOcrLine };
