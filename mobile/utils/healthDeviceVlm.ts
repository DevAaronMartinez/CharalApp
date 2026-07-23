import type { EvidenceSuggestions } from '@/utils/evidenceDetect';
import type { EvidenceType, GlucoseContext } from '@/types';

export type DeviceReadingEngine = 'ocr' | 'vlm';

export type VlmHealthReading = EvidenceSuggestions & {
  glucoseContext?: GlucoseContext;
  confidence?: number;
  notes?: string;
  raw?: string;
  engine?: DeviceReadingEngine;
};

/** Prompt mínimo: el VLM 1.6B tiende a copiar etiquetas del prompt, no dígitos. */
const BP_PROMPT =
  'Read only the large digits on the electronic display. Output three numbers from top to bottom, one per line. Digits only.';

const GLUCOSE_PROMPT =
  'Read only the large digits on the electronic display. Output one number. Digits only.';

export const HEALTH_VLM_SYSTEM_PROMPT =
  'You OCR digits from photos. Output digits only. Never diagnose.';

export function healthVlmUserPrompt(type: EvidenceType): string {
  return type === 'blood_pressure' ? BP_PROMPT : GLUCOSE_PROMPT;
}

export function isTemplateEcho(text: string): boolean {
  const t = String(text ?? '').trim();
  if (!t) return true;
  if (/<number>/i.test(t)) return true;
  if (/SYS\s*=\s*<|VALUE\s*=\s*</i.test(t)) return true;
  // Solo etiquetas sin dígitos (fallo típico del VLM).
  if (/systolic|diastolic|pulse|sistol|diast|pulso/i.test(t) && !/\d/.test(t)) {
    return true;
  }
  if (!/\d/.test(t)) return true;
  return false;
}

export type OcrBox = {
  text: string;
  score?: number;
  y1?: number;
  x1?: number;
  y2?: number;
};

function isValidBp(sys: number, dia: number) {
  return sys >= 70 && sys <= 260 && dia >= 40 && dia <= 160 && sys > dia;
}

function toNum(value: unknown): number | undefined {
  if (value == null || value === '' || value === 'null') return undefined;
  const n = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function extractNumbers(text: string): number[] {
  return [...String(text).matchAll(/\d{2,3}(?:[.,]\d+)?/g)]
    .map((m) => Number(m[0].replace(',', '.')))
    .filter((n) => Number.isFinite(n));
}

/**
 * Convierte detecciones OCR (ordenadas de arriba → abajo) en lectura de monitor.
 */
export function parseReadingFromOcrBoxes(
  boxes: OcrBox[],
  type: EvidenceType
): VlmHealthReading | null {
  const sorted = [...boxes].sort((a, b) => {
    const dy = (a.y1 ?? 0) - (b.y1 ?? 0);
    if (Math.abs(dy) > 8) return dy;
    return (a.x1 ?? 0) - (b.x1 ?? 0);
  });

  const raw = sorted.map((b) => b.text).join('\n');
  const digitBoxes = sorted
    .map((b) => {
      const nums = extractNumbers(b.text);
      const primary = nums.find((n) =>
        type === 'blood_pressure' ? n >= 40 && n <= 260 : n >= 3 && n <= 700
      );
      return primary == null
        ? null
        : {
            value: primary,
            y1: b.y1 ?? 0,
            score: b.score ?? 0.7,
            h: (b.y2 ?? b.y1 ?? 0) - (b.y1 ?? 0),
          };
    })
    .filter(Boolean) as { value: number; y1: number; score: number; h: number }[];

  // Preferir cajas casi solo-dígitos / más altas (LCD grandes).
  digitBoxes.sort((a, b) => a.y1 - b.y1 || b.h - a.h);

  if (type === 'blood_pressure') {
    const bpNums = digitBoxes
      .map((d) => d.value)
      .filter((n) => n >= 40 && n <= 260);

    // Deduplicar valores consecutivos iguales
    const unique: number[] = [];
    for (const n of bpNums) {
      if (unique[unique.length - 1] !== n) unique.push(n);
    }

    let systolic: number | undefined;
    let diastolic: number | undefined;
    let pulse: number | undefined;

    if (unique.length >= 2 && isValidBp(unique[0], unique[1])) {
      systolic = unique[0];
      diastolic = unique[1];
      if (unique[2] != null && unique[2] >= 40 && unique[2] <= 180) {
        pulse = unique[2];
      }
    } else {
      // Buscar el mejor par SYS>DIA en orden vertical
      for (let i = 0; i < unique.length - 1; i += 1) {
        if (isValidBp(unique[i], unique[i + 1])) {
          systolic = unique[i];
          diastolic = unique[i + 1];
          const rest = unique.slice(i + 2).find((n) => n >= 40 && n <= 180 && n !== systolic && n !== diastolic);
          pulse = rest;
          break;
        }
      }
    }

    if (systolic == null || diastolic == null) {
      return parseBloodPressureFromText(raw);
    }

    const avgScore =
      digitBoxes.slice(0, 3).reduce((s, d) => s + d.score, 0) /
      Math.max(1, Math.min(3, digitBoxes.length));

    return {
      systolic: String(Math.round(systolic)),
      diastolic: String(Math.round(diastolic)),
      pulse: pulse != null ? String(Math.round(pulse)) : undefined,
      confidence: Math.max(0.55, Math.min(0.98, avgScore || 0.8)),
      raw,
      engine: 'ocr',
    };
  }

  // Glucosa: número dominante en rango
  const candidates = digitBoxes
    .map((d) => d.value)
    .filter((n) => (n >= 20 && n <= 600) || (n >= 3 && n <= 20));
  if (!candidates.length) {
    return parseGlucoseFromText(raw);
  }

  // Preferir valores típicos de glucómetro (mg/dL) sobre HbA1c a menos que diga %
  const joined = raw.toLowerCase();
  const isHba1c = /%|hba1c/.test(joined);
  const value = isHba1c
    ? candidates.find((n) => n >= 3 && n <= 20)
    : candidates.find((n) => n >= 20 && n <= 600) ?? candidates[0];

  if (value == null) return null;

  if (isHba1c || (value >= 3 && value <= 20 && !candidates.some((n) => n >= 40))) {
    return {
      glucoseValue: String(Math.round(value * 10) / 10),
      glucoseContext: 'hba1c',
      confidence: 0.8,
      raw,
      engine: 'ocr',
    };
  }

  return {
    glucoseValue: String(Math.round(value)),
    glucoseContext: 'unknown',
    confidence: 0.8,
    raw,
    engine: 'ocr',
  };
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseBloodPressureFromText(text: string): VlmHealthReading | null {
  if (isTemplateEcho(text)) return null;

  const normalized = String(text ?? '')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  let systolic =
    toNum(normalized.match(/\bSYS\s*[=:]?\s*(\d{2,3})\b/i)?.[1]) ??
    toNum(normalized.match(/\bsistol\w*\s*[=:]?\s*(\d{2,3})\b/i)?.[1]);
  let diastolic =
    toNum(normalized.match(/\bDIA\s*[=:]?\s*(\d{2,3})\b/i)?.[1]) ??
    toNum(normalized.match(/\bdiast\w*\s*[=:]?\s*(\d{2,3})\b/i)?.[1]);
  let pulse =
    toNum(normalized.match(/\bPUL(?:SE|SO)?\s*[=:]?\s*(\d{2,3})\b/i)?.[1]) ??
    toNum(normalized.match(/\bHR\s*[=:]?\s*(\d{2,3})\b/i)?.[1]);

  const lineNums = String(text ?? '')
    .split(/[\n\r]+/)
    .map((line) => line.replace(/[^\d]/g, ''))
    .map((digits) => (digits ? Number(digits) : NaN))
    .filter((n) => Number.isFinite(n) && n >= 40 && n <= 260);

  if ((systolic == null || diastolic == null) && lineNums.length >= 2 && isValidBp(lineNums[0], lineNums[1])) {
    systolic = lineNums[0];
    diastolic = lineNums[1];
    if (pulse == null && lineNums[2] != null && lineNums[2] >= 40 && lineNums[2] <= 180) {
      pulse = lineNums[2];
    }
  }

  if (systolic == null || diastolic == null) {
    const slash = normalized.match(/\b(\d{2,3})\s*[\/\-]\s*(\d{2,3})(?:\s+(\d{2,3}))?\b/);
    if (slash) {
      systolic = systolic ?? toNum(slash[1]);
      diastolic = diastolic ?? toNum(slash[2]);
      if (pulse == null && slash[3]) pulse = toNum(slash[3]);
    }
  }

  if (systolic == null || diastolic == null) {
    const nums = extractNumbers(normalized).filter((n) => n >= 40 && n <= 260);
    if (nums.length >= 2 && isValidBp(nums[0], nums[1])) {
      systolic = nums[0];
      diastolic = nums[1];
      if (pulse == null && nums[2] != null && nums[2] >= 40 && nums[2] <= 180) pulse = nums[2];
    }
  }

  if (systolic == null || diastolic == null || !isValidBp(systolic, diastolic)) {
    return null;
  }

  return {
    systolic: String(Math.round(systolic)),
    diastolic: String(Math.round(diastolic)),
    pulse:
      pulse != null && pulse >= 30 && pulse <= 220
        ? String(Math.round(pulse))
        : undefined,
    confidence: 0.75,
    raw: text,
    engine: 'vlm',
  };
}

function parseGlucoseFromText(text: string): VlmHealthReading | null {
  if (isTemplateEcho(text)) return null;

  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  const isHba1c = /hba1c|%\b/i.test(normalized);
  const labeled =
    toNum(normalized.match(/\b(\d{2,3})\s*mg\s*\/?\s*dl\b/i)?.[1]) ??
    toNum(normalized.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*%/i)?.[1]);

  let value = labeled;
  if (value == null) {
    const nums = extractNumbers(normalized);
    value = nums.find((n) => (isHba1c ? n >= 3 && n <= 20 : n >= 20 && n <= 600));
  }
  if (value == null) return null;

  if (isHba1c || (value >= 3 && value <= 20)) {
    return {
      glucoseValue: String(Math.round(value * 10) / 10),
      glucoseContext: 'hba1c' as GlucoseContext,
      confidence: 0.7,
      raw: text,
      engine: 'vlm',
    };
  }

  return {
    glucoseValue: String(Math.round(value)),
    glucoseContext: 'unknown',
    confidence: 0.7,
    raw: text,
    engine: 'vlm',
  };
}

export function parseHealthVlmResponse(
  text: string,
  type: EvidenceType
): VlmHealthReading | null {
  const raw = String(text ?? '').trim();
  if (!raw || isTemplateEcho(raw)) return null;

  const json = extractJsonObject(raw);
  if (json) {
    const systolic = toNum(json.systolic);
    const diastolic = toNum(json.diastolic);
    if (type === 'blood_pressure' && systolic != null && diastolic != null && isValidBp(systolic, diastolic)) {
      const pulse = toNum(json.pulse);
      return {
        systolic: String(Math.round(systolic)),
        diastolic: String(Math.round(diastolic)),
        pulse: pulse != null ? String(Math.round(pulse)) : undefined,
        confidence: 0.7,
        raw,
        engine: 'vlm',
      };
    }
    const value = toNum(json.value);
    if (type === 'blood_glucose' && value != null) {
      return {
        glucoseValue: String(value),
        glucoseContext: json.unit === '%' ? 'hba1c' : 'unknown',
        confidence: 0.7,
        raw,
        engine: 'vlm',
      };
    }
  }

  return type === 'blood_pressure'
    ? parseBloodPressureFromText(raw)
    : parseGlucoseFromText(raw);
}
