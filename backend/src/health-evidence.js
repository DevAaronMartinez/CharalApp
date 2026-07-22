/**
 * Evalúa evidencia de presión arterial o glucosa (manual u OCR).
 * Orientación educativa — no sustituye consulta médica.
 */

const { extractRawTextFromImageBase64 } = require('./ocr');

function fixOcrDigitConfusion(text) {
  return String(text ?? '')
    .split(/[\n\r]+/)
    .map((line) => {
      const trimmed = line.trim();
      const compact = trimmed.replace(/\s/g, '');
      const looksNumeric =
        /^\d{2,4}$/.test(compact) || /^[\d\solisb|.,-]+$/i.test(trimmed);

      if (!looksNumeric) return line;

      return trimmed
        .replace(/[oO]/g, '0')
        .replace(/[lI|]/g, '1')
        .replace(/[sS]/g, '5')
        .replace(/[bB]/g, '8');
    })
    .join('\n');
}

function collapseSpacedDigits(text) {
  return String(text ?? '')
    .split(/[\n\r]+/)
    .map((line) => line.replace(/(\d)\s+(?=\d)/g, '$1'))
    .join('\n');
}

function stripUiContamination(text) {
  return String(text ?? '')
    .split(/[\n\r]+/)
    .filter((line) => {
      const normalized = normalizeText(line);
      if (!normalized.trim()) return false;
      if (
        /hipogluc|hipergluc|muy elevada|requiere atencion|lectura desde foto|evaluar y recibir|mi perfil|maria garcia|enfermedad cron|fotografia el result|retroaliment|profesional de salud|continua monitoreo|endocrinolog|antidiabet|prediabetes|manual\b|foto\b|presion valida|hipertension arterial|recomendaciones para ti|monitoreo en casa/.test(
          normalized
        )
      ) {
        return false;
      }
      return true;
    })
    .join('\n');
}

const PRIMARY_LCD_CORRECTION = {
  '3': '9',
  '8': '0',
  '0': '8',
  '9': '3',
  '6': '0',
  '5': '6',
  '1': '7',
  '7': '1',
};

function primaryLcdCorrection(value) {
  const corrected = String(value)
    .split('')
    .map((digit) => PRIMARY_LCD_CORRECTION[digit] ?? digit)
    .join('');
  const numeric = Number(corrected);
  return Number.isNaN(numeric) ? value : numeric;
}
const LCD_DIGIT_ALTS = {
  '0': ['0', '8', '6'],
  '1': ['1', '7'],
  '2': ['2', '3'],
  '3': ['3', '9', '8'],
  '4': ['4', '9'],
  '5': ['5', '6'],
  '6': ['6', '5', '8', '0'],
  '7': ['7', '1'],
  '8': ['8', '0', '3', '6'],
  '9': ['9', '3', '4', '0'],
};

function generateLcdReadingAlternatives(value) {
  const digits = String(value).split('');
  if (digits.length < 2 || digits.length > 3) return [value];

  let variants = [''];
  for (const digit of digits) {
    const options = LCD_DIGIT_ALTS[digit] ?? [digit];
    const next = [];
    for (const prefix of variants) {
      for (const option of options) {
        next.push(prefix + option);
      }
    }
    variants = next;
  }

  return [...new Set(variants.map(Number))].filter((v) => v >= 20 && v <= 600);
}

function isUiNoiseLine(line) {
  const normalized = normalizeText(line);
  return /hipogluc|hipergluc|lectura desde|evaluar y recibir|mi perfil|enfermedad cron|profesional de salud|retroaliment/.test(
    normalized
  );
}

function isInsideLongDigitRun(text, start, length) {
  const before = text[start - 1];
  const after = text[start + length];
  return (before && /\d/.test(before)) || (after && /\d/.test(after));
}

function isTimeOrDateWindow(text) {
  return (
    /\d{1,2}\s*:\s*\d{2}/.test(text) ||
    /\b(?:am|pm)\b/.test(text) ||
    /\d{1,2}\s*[-/.]\s*\d{2}\b/.test(text)
  );
}

function parseGlucoseNearMgDl(text) {
  const lines = normalizeText(collapseSpacedDigits(fixOcrDigitConfusion(text))).split(/[\n\r]+/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const inlineBefore = line.match(/(\d{2,3})\s*mg\s*\/?\s*dl\b/);
    if (inlineBefore) {
      const value = Number(inlineBefore[1]);
      if (value >= 20 && value <= 600) {
        return { value, unit: 'mg/dL', context: 'unknown', source: 'ocr' };
      }
    }

    const inlineAfter = line.match(/\bmg\s*\/?\s*dl[^\d]{0,10}(\d{2,3})\b/);
    if (inlineAfter) {
      const value = Number(inlineAfter[1]);
      if (value >= 20 && value <= 600) {
        return { value, unit: 'mg/dL', context: 'unknown', source: 'ocr' };
      }
    }

    if (!/\bmg\s*\/?\s*dl\b/.test(line)) continue;

    for (const j of [i - 1, i + 1, i - 2, i + 2]) {
      if (j < 0 || j >= lines.length) continue;
      const digits = lines[j].trim().replace(/\s/g, '');
      if (!/^\d{2,3}$/.test(digits)) continue;
      const value = Number(digits);
      if (value >= 20 && value <= 600) {
        return { value, unit: 'mg/dL', context: 'unknown', source: 'ocr' };
      }
    }
  }

  return null;
}

function collectGlucoseCandidates(text) {
  const cleaned = stripUiContamination(text);
  const collapsed = collapseSpacedDigits(fixOcrDigitConfusion(cleaned));
  const haystack = normalizeText(collapsed);
  const lines = haystack.split(/[\n\r]+/);
  const tallies = new Map();

  const addCandidate = (value, meta) => {
    if (value < 20 || value > 600) return;
    const key = String(value);
    const prev = tallies.get(key) ?? {
      value,
      frequency: 0,
      nearMgDl: false,
      standaloneLine: false,
      digitOnlyLine: false,
      inTimeContext: false,
      inLongRun: false,
      lcdCorrected: false,
    };
    prev.frequency += 1;
    prev.nearMgDl ||= meta.nearMgDl;
    prev.standaloneLine ||= meta.standaloneLine;
    prev.digitOnlyLine ||= meta.digitOnlyLine;
    prev.inTimeContext ||= meta.inTimeContext;
    prev.inLongRun ||= meta.inLongRun;
    prev.lcdCorrected ||= meta.lcdCorrected;
    tallies.set(key, prev);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (isUiNoiseLine(line)) continue;
    const digitsOnly = line.replace(/\s/g, '');
    const nearMgDl =
      /\bmg\s*\/?\s*dl\b/.test(line) ||
      (i > 0 && /\bmg\s*\/?\s*dl\b/.test(lines[i - 1])) ||
      (i + 1 < lines.length && /\bmg\s*\/?\s*dl\b/.test(lines[i + 1]));

    if (/^\d{2,3}$/.test(digitsOnly)) {
      const value = Number(digitsOnly);
      addCandidate(value, {
        nearMgDl,
        standaloneLine: true,
        digitOnlyLine: true,
        inTimeContext: isTimeOrDateWindow(line),
      });
      for (const alt of generateLcdReadingAlternatives(value)) {
        if (alt !== value) {
          addCandidate(alt, {
            nearMgDl,
            standaloneLine: true,
            digitOnlyLine: false,
            inTimeContext: false,
            lcdCorrected: true,
          });
        }
      }
    }
  }

  const withoutBp = haystack.replace(/\d{2,3}\s*[/\-\\|]\s*\d{2,3}/g, ' ');
  const tokenRe = /\d{2,3}/g;
  let match;
  while ((match = tokenRe.exec(withoutBp)) !== null) {
    const value = Number(match[0]);
    const window = withoutBp.slice(Math.max(0, match.index - 18), match.index + match[0].length + 18);
    if (isUiNoiseLine(window)) continue;
    addCandidate(value, {
      nearMgDl: /\bmg\s*\/?\s*dl\b/.test(window),
      standaloneLine: false,
      digitOnlyLine: false,
      inTimeContext: isTimeOrDateWindow(window),
      inLongRun: isInsideLongDigitRun(withoutBp, match.index, match[0].length),
    });
  }

  return [...tallies.values()];
}

function scoreGlucoseCandidate(candidate) {
  let score = 0;
  const { value, frequency, nearMgDl, standaloneLine, digitOnlyLine, inTimeContext, inLongRun, lcdCorrected } =
    candidate;

  if (nearMgDl) score += 220;
  if (digitOnlyLine) score += 180;
  if (standaloneLine) score += 140;
  if (frequency > 1) score += 35 * (frequency - 1);
  if (value >= 70 && value <= 140) score += 85;
  else if (value >= 40 && value <= 250) score += 50;
  if (String(value).length === 2) score += 40;
  if (lcdCorrected) score += 45;
  if (inTimeContext) score -= 180;
  if (inLongRun) score -= 220;
  if (value < 54 && !digitOnlyLine && frequency < 2) score -= 160;
  if (value < 54 && digitOnlyLine && frequency < 2) score -= 90;
  if (value >= 350 && !standaloneLine) score -= 90;
  if (value >= 500 && !standaloneLine) score -= 120;

  return score;
}

function pickBestGlucoseCandidate(text) {
  const candidates = collectGlucoseCandidates(text);
  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const scoreDiff = scoreGlucoseCandidate(b) - scoreGlucoseCandidate(a);
    if (scoreDiff !== 0) return scoreDiff;
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    const aDist = Math.abs(a.value - 110);
    const bDist = Math.abs(b.value - 110);
    return aDist - bDist;
  });

  const best = candidates[0];

  if (best.value < 54 && (best.nearMgDl || best.standaloneLine || best.digitOnlyLine)) {
    const primary = primaryLcdCorrection(best.value);
    if (primary !== best.value && primary >= 54 && primary <= 600) {
      return primary;
    }

    const normalAlt = candidates.find(
      (c) => c.lcdCorrected && c.value >= 70 && c.value <= 180 && c.nearMgDl
    );
    if (normalAlt) return normalAlt.value;
  }

  return best.value;
}

function extractStandaloneGlucoseValue(text) {
  return pickBestGlucoseCandidate(text);
}

const DISCLAIMER =
  'Esta evaluación es orientativa y no reemplaza la valoración de un profesional de salud.';

function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isDeviceMetadataLine(line) {
  return /omron|hem[-\s]?\d{3,}|tensio|monitor|modelo/.test(normalizeText(line));
}

function extractOrderedStandaloneNumbers(text) {
  const lines = normalizeText(stripUiContamination(text))
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const numbers = [];
  for (const line of lines) {
    if (isUiNoiseLine(line) || isDeviceMetadataLine(line)) continue;
    const compact = line.replace(/\s/g, '');
    if (/^\d{2,3}$/.test(compact)) {
      numbers.push(Number(compact));
    }
  }
  return numbers;
}

function inferMissingSystolic(allNums, diastolic, pulse) {
  const candidates = allNums.filter(
    (n) => n !== diastolic && n !== pulse && isValidBp(n, diastolic)
  );
  return candidates.length ? Math.max(...candidates) : undefined;
}

function parseBloodPressureNearLabels(text) {
  const lines = normalizeText(stripUiContamination(text))
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  let systolic;
  let diastolic;
  let pulse;

  const readNearbyNumber = (startIndex, kind) => {
    const candidates = [];
    for (const j of [startIndex + 1, startIndex + 2, startIndex + 3, startIndex + 4]) {
      if (j >= lines.length) continue;
      if (isDeviceMetadataLine(lines[j])) continue;
      const compact = lines[j].replace(/\s/g, '');
      if (!/^\d{2,3}$/.test(compact)) continue;
      const value = Number(compact);
      if (kind === 'sys' && value >= 80 && value <= 220) candidates.push(value);
      if (kind === 'dia' && value >= 45 && value <= 130) candidates.push(value);
      if (kind === 'pulse' && value >= 40 && value <= 120) candidates.push(value);
    }
    if (!candidates.length) return undefined;
    if (kind === 'sys') return Math.max(...candidates);
    return candidates[0];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isDeviceMetadataLine(line)) continue;

    if (/\bsys\b|sistol|sistolic|\btas\b/.test(line) && !/\bdia\b|diast/.test(line)) {
      const inline = line.match(/\b(\d{2,3})\b/);
      const inlineVal = inline ? Number(inline[1]) : undefined;
      systolic =
        inlineVal && inlineVal >= 80 && inlineVal <= 220
          ? inlineVal
          : readNearbyNumber(i, 'sys');
    }
    if (/(?:\bdia\b|diast|diastolic|\bpad\b)(?!bet)/.test(line)) {
      const inline = line.match(/\b(\d{2,3})\b/);
      const inlineVal = inline ? Number(inline[1]) : undefined;
      diastolic =
        inlineVal && inlineVal >= 45 && inlineVal <= 130
          ? inlineVal
          : readNearbyNumber(i, 'dia');
    }
    if (/\bpulse\b|\bpulso\b|\blpm\b|\bppm\b/.test(line) || /\/min\b/.test(line)) {
      const inline = line.match(/\b(\d{2,3})\b/);
      const inlineVal = inline ? Number(inline[1]) : undefined;
      pulse =
        inlineVal && inlineVal >= 40 && inlineVal <= 120
          ? inlineVal
          : readNearbyNumber(i, 'pulse');
    }
  }

  const ordered = extractOrderedStandaloneNumbers(text);

  if (!systolic && diastolic) {
    systolic = inferMissingSystolic(ordered, diastolic, pulse);
  }

  if (systolic && !diastolic && ordered.length >= 2) {
    const diaCandidates = ordered.filter(
      (n) => n !== systolic && n !== pulse && isValidBp(systolic, n)
    );
    if (diaCandidates.length) diastolic = Math.max(...diaCandidates);
  }

  if (systolic && diastolic && !pulse) {
    pulse = ordered.find(
      (n) => n >= 40 && n <= 120 && n !== systolic && n !== diastolic
    );
  }

  if (!isValidBp(systolic, diastolic)) return null;

  return {
    systolic,
    diastolic,
    pulse: pulse && pulse >= 40 && pulse <= 200 ? pulse : undefined,
    source: 'ocr',
  };
}

function parseBloodPressureFromOrderedStack(text) {
  const numbers = extractOrderedStandaloneNumbers(text);
  if (numbers.length < 3) return null;

  for (let i = 0; i <= numbers.length - 3; i += 1) {
    const [sys, dia, pulse] = numbers.slice(i, i + 3);
    if (isValidBp(sys, dia) && pulse >= 40 && pulse <= 120 && sys - dia >= 10 && sys >= 100) {
      return { systolic: sys, diastolic: dia, pulse, source: 'ocr' };
    }
  }

  return null;
}

function pickBloodPressureFromPairs(text) {
  const numbers = extractOrderedStandaloneNumbers(text);
  if (numbers.length < 2) return null;

  const maxNum = Math.max(...numbers);
  let best = null;

  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = 0; j < numbers.length; j += 1) {
      if (i === j) continue;
      const sys = numbers[i];
      const dia = numbers[j];
      if (!isValidBp(sys, dia)) continue;
      if (sys < 100) continue;

      const indexGap = Math.abs(i - j);
      const score =
        (sys === maxNum ? 12 : 0) +
        (sys >= 100 && sys <= 200 ? 4 : 0) +
        (dia >= 55 && dia <= 120 ? 4 : 0) +
        (sys - dia >= 20 ? 3 : 0) +
        (indexGap === 1 ? 5 : 0);

      if (!best || score > best.score) {
        best = { systolic: sys, diastolic: dia, score, sysIndex: i, diaIndex: j };
      }
    }
  }

  if (!best) return null;

  const used = new Set([best.systolic, best.diastolic]);
  const afterDia = numbers.slice(Math.max(best.sysIndex, best.diaIndex) + 1);
  const pulseFromOrder = afterDia.find((n) => !used.has(n) && n >= 40 && n <= 120);
  const pulse = pulseFromOrder ?? numbers.find((n) => !used.has(n) && n >= 40 && n <= 120);

  return {
    systolic: best.systolic,
    diastolic: best.diastolic,
    pulse: pulse && pulse >= 40 && pulse <= 200 ? pulse : undefined,
    source: 'ocr',
  };
}

function parseBloodPressure(text) {
  const cleaned = stripUiContamination(text);
  const haystack = normalizeText(cleaned);
  let systolic;
  let diastolic;

  const nearLabels = parseBloodPressureNearLabels(cleaned);
  if (nearLabels) return nearLabels;

  const ordered = parseBloodPressureFromOrderedStack(cleaned);
  if (ordered) return ordered;

  const paired =
    haystack.match(/(\d{2,3})\s*[/\-\\|]\s*(\d{2,3})/) ??
    haystack.match(
      /(?:sys|sist[oó]l|tas|ps)[^\d]{0,12}(\d{2,3})[^\d]{0,20}(?:dia|diast|pad|pd)[^\d]{0,12}(\d{2,3})/
    );

  if (paired) {
    systolic = Number(paired[1]);
    diastolic = Number(paired[2]);
  } else {
    const sysOnly = haystack.match(/(?:sist[oó]l|sistolica|sys|tas|ps)[^\d]{0,10}(\d{2,3})/);
    const diaOnly = haystack.match(/(?:diast[oó]l|diastolica|dia|pad|pd)[^\d]{0,10}(\d{2,3})/);
    if (sysOnly && diaOnly) {
      systolic = Number(sysOnly[1]);
      diastolic = Number(diaOnly[1]);
    }
  }

  if (isValidBp(systolic, diastolic)) {
    const pulseMatch = haystack.match(/(?:pulse|pulso|lpm|ppm|heart|\/min)[^\d]{0,8}(\d{2,3})/);
    const pulse = pulseMatch ? Number(pulseMatch[1]) : undefined;
    return {
      systolic,
      diastolic,
      pulse: pulse && pulse >= 40 && pulse <= 200 ? pulse : undefined,
      source: 'ocr',
    };
  }

  return pickBloodPressureFromPairs(cleaned);
}

function isValidBp(sys, dia) {
  return sys >= 70 && sys <= 260 && dia >= 40 && dia <= 160 && sys > dia;
}

function parseGlucose(text) {
  const cleaned = stripUiContamination(text);
  const haystack = normalizeText(cleaned);
  let context = 'unknown';

  if (/hba1c|hemoglobina glicosilada|\ba1c\b/.test(haystack) && /%/.test(haystack)) context = 'hba1c';
  else if (/ayunas|en ayunas|fasting|basal/.test(haystack)) context = 'fasting';
  else if (/postprand|2\s*h|dos horas|despu[eé]s de comer/.test(haystack)) context = 'postprandial';

  const hba1cMatch = haystack.match(/(?:hba1c|a1c|hemoglobina glicosilada)[^\d]{0,12}(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  if (hba1cMatch) {
    const value = parseFloat(hba1cMatch[1].replace(',', '.'));
    if (value >= 4 && value <= 20) {
      return { value, unit: '%', context: 'hba1c', source: 'ocr' };
    }
  }

  const mmolMatch = haystack.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*mmol\s*\/?\s*l/);
  if (mmolMatch) {
    const mmol = parseFloat(mmolMatch[1].replace(',', '.'));
    if (mmol >= 2 && mmol <= 35) {
      return {
        value: Math.round(mmol * 18.018),
        unit: 'mg/dL',
        mmolPerL: mmol,
        context,
        source: 'ocr',
      };
    }
  }

  const best = extractStandaloneGlucoseValue(cleaned);
  if (best != null) {
    return { value: best, unit: 'mg/dL', context, source: 'ocr' };
  }

  const nearMgDl = parseGlucoseNearMgDl(cleaned);
  if (nearMgDl) return nearMgDl;

  return null;
}

function evaluateBloodPressure({ systolic, diastolic, pulse, context = 'resting' }) {
  let level = 'normal';
  let label = 'Presión en rango objetivo';
  let severity = 'success';

  if (systolic >= 180 || diastolic >= 120) {
    level = 'crisis';
    label = 'Crisis hipertensiva — urgencia médica';
    severity = 'critical';
  } else if (systolic >= 140 || diastolic >= 90) {
    level = 'stage2';
    label = 'Hipertensión estadio 2';
    severity = 'danger';
  } else if (systolic >= 130 || diastolic >= 80) {
    level = 'stage1';
    label = 'Hipertensión estadio 1';
    severity = 'warning';
  } else if (systolic >= 120 && diastolic < 80) {
    level = 'elevated';
    label = 'Presión elevada';
    severity = 'warning';
  } else if (systolic < 90 || diastolic < 60) {
    level = 'low';
    label = 'Presión baja';
    severity = 'warning';
  }

  const feedback = [];

  if (level === 'crisis') {
    feedback.push('Busca atención médica urgente si tienes dolor de pecho, falta de aire o visión borrosa.');
    feedback.push('No suspendas ni dupliques antihipertensivos sin indicación médica.');
  } else if (level === 'stage2' || level === 'stage1') {
    feedback.push('Registra tus lecturas a la misma hora, sentado y en reposo 5 minutos.');
    feedback.push('Reduce sodio, alcohol y estrés; mantén actividad física moderada si tu médico lo autoriza.');
    feedback.push('Comenta estas cifras en tu próxima consulta para ajustar tratamiento.');
  } else if (level === 'elevated') {
    feedback.push('Revisa dieta baja en sodio y aumenta caminata o ejercicio ligero.');
    feedback.push('Monitorea 3 veces por semana y lleva un registro para tu médico.');
  } else if (level === 'low') {
    feedback.push('Si tienes mareo o debilidad, siéntate, hidrátate y consulta si persiste.');
  } else {
    feedback.push('¡Buen control! Sigue con medicación, dieta y monitoreo según tu plan.');
  }

  if (pulse != null) {
    if (pulse > 100) feedback.push(`Pulso ${pulse} lpm: elevado en reposo — menciónalo con tu cardiólogo.`);
    else if (pulse < 60) feedback.push(`Pulso ${pulse} lpm: puede ser normal en atletas; consulta si hay mareo.`);
  }

  if (context === 'post_activity') {
    feedback.push('Lectura tras actividad: repite en reposo 5 minutos sentado para comparar con tu objetivo.');
  } else if (context === 'stress') {
    feedback.push('Estrés o dolor pueden elevar la presión; si persiste en reposo, coméntalo con tu médico.');
  } else if (context === 'unknown') {
    feedback.push('Para registros útiles, mide en reposo, misma hora y brazo, sin hablar durante la lectura.');
  }

  return {
    type: 'blood_pressure',
    values: { systolic, diastolic, pulse: pulse ?? null },
    reading: `${systolic}/${diastolic} mmHg`,
    level,
    label,
    severity,
    feedback,
    disclaimer: DISCLAIMER,
  };
}

function evaluateGlucose({ value, unit, context, mmolPerL }) {
  let level = 'normal';
  let label = 'Glucosa en rango';
  let severity = 'success';

  if (context === 'hba1c' || unit === '%') {
    if (value >= 6.5) {
      level = 'diabetes';
      label = 'HbA1c en rango de diabetes';
      severity = 'danger';
    } else if (value >= 5.7) {
      level = 'prediabetes';
      label = 'HbA1c en rango de prediabetes';
      severity = 'warning';
    } else {
      level = 'normal';
      label = 'HbA1c en rango objetivo';
      severity = 'success';
    }
  } else if (context === 'postprandial') {
    if (value >= 200) {
      level = 'high';
      label = 'Glucosa postprandial muy elevada';
      severity = 'danger';
    } else if (value >= 140) {
      level = 'elevated';
      label = 'Glucosa postprandial elevada';
      severity = 'warning';
    } else if (value < 70) {
      level = 'low';
      label = 'Posible hipoglucemia';
      severity = 'critical';
    }
  } else {
    if (value >= 300) {
      level = 'critical';
      label = 'Glucosa muy elevada — busca atención médica';
      severity = 'critical';
    } else if (value >= 200) {
      level = 'high';
      label = 'Glucosa muy elevada';
      severity = 'danger';
    } else if (value >= 126) {
      level = 'diabetes';
      label = 'Glucosa en ayunas en rango de diabetes';
      severity = 'danger';
    } else if (value >= 100) {
      level = 'prediabetes';
      label = 'Glucosa en ayunas elevada (prediabetes)';
      severity = 'warning';
    } else if (value < 70) {
      level = 'low';
      label = 'Hipoglucemia — requiere atención';
      severity = 'critical';
    }
  }

  const feedback = [];
  const displayUnit = unit === '%' ? '%' : 'mg/dL';

  if (level === 'critical' && value >= 250) {
    feedback.push('Glucosa muy alta: hidrátate, no omitas insulina y contacta a tu médico o urgencias si hay náusea, vómito o aliento acetónico.');
    feedback.push('No hagas ejercicio intenso hasta normalizar con indicación médica.');
  } else if (level === 'critical' || level === 'low') {
    feedback.push('Si tienes temblor, sudor o confusión, consume 15 g de carbohidrato rápido y repite medición.');
    feedback.push('Informa a tu médico sobre episodios de glucosa baja.');
  } else if (level === 'diabetes' || level === 'high') {
    feedback.push('Revisa adherencia a medicación, alimentación y actividad física.');
    feedback.push('Lleva este resultado a tu endocrinólogo para ajustar el plan.');
    feedback.push('Mantén hidratación y evita omitir dosis de insulina o antidiabéticos.');
  } else if (level === 'prediabetes' || level === 'elevated') {
    feedback.push('Prioriza fibra, porciones controladas y caminata después de comer.');
    feedback.push('Un registro de 7 días ayuda a detectar patrones antes de la consulta.');
  } else {
    feedback.push('Continúa monitoreo según tu plan (ayunas o según indicación).');
    feedback.push('Identifica medicamentos en la pestaña Medicinas si tienes dudas.');
  }

  const reading =
    unit === '%'
      ? `${value}% (HbA1c)`
      : mmolPerL
        ? `${value} mg/dL (${mmolPerL} mmol/L)`
        : `${value} mg/dL`;

  return {
    type: 'blood_glucose',
    values: { value, unit: displayUnit, context, mmolPerL: mmolPerL ?? null },
    reading,
    level,
    label,
    severity,
    feedback,
    disclaimer: DISCLAIMER,
  };
}

function mergeOcrSources(...parts) {
  const seen = new Set();
  const merged = [];

  for (const part of parts) {
    for (const line of String(part ?? '').split(/[\n\r]+/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(trimmed);
    }
  }

  return merged.join('\n');
}

async function gatherEvidenceOcr(payload) {
  const { imageBase64, ocrText: clientOcrText } = payload ?? {};
  let detectedLines = [];
  let ocrText = String(clientOcrText ?? '').trim();
  let deviceText = ocrText;

  if (imageBase64) {
    const raw = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
    const ocr = await extractRawTextFromImageBase64(raw);
    detectedLines = ocr.lines;
    const digitHint =
      ocr.digitLines?.length ? `mg/dl\n${ocr.digitLines.join('\n')}` : '';
    deviceText = mergeOcrSources(clientOcrText, digitHint, ocr.displayText);
    ocrText = mergeOcrSources(deviceText, ocr.text, ocr.rawText);
  }

  return { detectedLines, ocrText, deviceText };
}

function isConfidentBloodPressure(parsed) {
  if (!parsed?.systolic || !parsed?.diastolic) return false;
  const sys = Number(parsed.systolic);
  const dia = Number(parsed.diastolic);
  if (!isValidBp(sys, dia)) return false;
  if (sys < 100 || sys - dia < 15) return false;
  return true;
}

async function detectHealthEvidence(payload) {
  const { type, imageBase64, ocrText: clientOcrText } = payload ?? {};

  if (!type || !['blood_pressure', 'blood_glucose'].includes(type)) {
    return { error: 'type debe ser blood_pressure o blood_glucose' };
  }

  if (!imageBase64 && !clientOcrText) {
    return { error: 'Se requiere imagen u ocrText' };
  }

  const { detectedLines, ocrText, deviceText } = await gatherEvidenceOcr(payload);

  let suggestions = null;
  if (type === 'blood_pressure') {
    suggestions =
      (deviceText && parseBloodPressure(deviceText)) ||
      (ocrText && parseBloodPressure(ocrText));
  } else {
    suggestions =
      (deviceText && parseGlucose(deviceText)) ||
      (ocrText && parseGlucose(ocrText));
  }

  return {
    type,
    found: Boolean(suggestions),
    confident: type === 'blood_pressure'
      ? isConfidentBloodPressure(suggestions)
      : Boolean(suggestions?.value),
    suggestions,
    detectedLines,
  };
}

async function evaluateHealthEvidence(payload) {
  const { type, imageBase64, manual, ocrText: clientOcrText } = payload ?? {};

  if (!type || !['blood_pressure', 'blood_glucose'].includes(type)) {
    return { error: 'type debe ser blood_pressure o blood_glucose' };
  }

  let detectedLines = [];
  let ocrText = String(clientOcrText ?? '').trim();
  let deviceText = ocrText;

  if (imageBase64) {
    const gathered = await gatherEvidenceOcr(payload);
    detectedLines = gathered.detectedLines;
    ocrText = gathered.ocrText;
    deviceText = gathered.deviceText;
  }

  if (type === 'blood_pressure') {
    let parsed =
      manual?.systolic != null && manual?.diastolic != null
        ? {
            systolic: Number(manual.systolic),
            diastolic: Number(manual.diastolic),
            pulse: manual.pulse != null ? Number(manual.pulse) : undefined,
            context: manual.context ?? 'resting',
            source: 'manual',
          }
        : null;

    if (!parsed && deviceText) {
      parsed = parseBloodPressure(deviceText);
    }
    if (!parsed && ocrText) {
      parsed = parseBloodPressure(ocrText);
    }

    if (!parsed || !isValidBp(parsed.systolic, parsed.diastolic)) {
      return {
        error: 'Ingresa sistólica y diastólica válidas (ej. 120 y 80).',
        detectedLines,
        ocrText,
      };
    }

    return {
      ...evaluateBloodPressure(parsed),
      source: parsed.source,
      detectedLines,
    };
  }

  let parsed =
    manual?.value != null
      ? {
          value: Number(manual.value),
          unit: manual.unit === '%' ? '%' : 'mg/dL',
          context: manual.context ?? 'fasting',
          source: 'manual',
        }
      : null;

  if (!parsed && (deviceText || ocrText)) {
    if (deviceText) {
      parsed = parseGlucose(deviceText);
    }
    if (!parsed && ocrText) {
      parsed = parseGlucose(ocrText);
    }
  }

  if (!parsed || parsed.value == null || Number.isNaN(parsed.value)) {
    return {
      error: 'Ingresa un valor de glucosa o HbA1c válido.',
      detectedLines,
      ocrText,
    };
  }

  return {
    ...evaluateGlucose(parsed),
    source: parsed.source,
    detectedLines,
  };
}

module.exports = {
  evaluateHealthEvidence,
  detectHealthEvidence,
  parseBloodPressure,
  parseGlucose,
  evaluateBloodPressure,
  evaluateGlucose,
};
