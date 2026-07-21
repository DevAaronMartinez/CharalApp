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

module.exports = { extractTextFromImageBase64, cleanOcrLines, isUsefulOcrLine };
