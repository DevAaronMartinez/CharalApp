import type { EvidenceType } from '@/types';

export type EvidenceSuggestions = {
  systolic?: string;
  diastolic?: string;
  pulse?: string;
  glucoseValue?: string;
};

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isValidBp(sys: number, dia: number) {
  return sys >= 70 && sys <= 260 && dia >= 40 && dia <= 160 && sys > dia;
}

export function isConfidentBloodPressure(suggestions: EvidenceSuggestions): boolean {
  const sys = Number(suggestions.systolic);
  const dia = Number(suggestions.diastolic);
  if (!sys || !dia || !isValidBp(sys, dia)) return false;
  if (sys < 100 || sys - dia < 15) return false;
  return true;
}

export function isConfidentGlucose(suggestions: EvidenceSuggestions): boolean {
  const value = Number(suggestions.glucoseValue);
  return value >= 20 && value <= 600;
}

function isDeviceMetadataLine(line: string) {
  return /omron|hem[-\s]?\d{3,}|tensio|monitor|modelo/.test(normalize(line));
}

function extractOrderedStandaloneNumbers(lines: string[]) {
  const numbers: number[] = [];
  for (const raw of lines) {
    const line = normalize(raw).trim();
    if (isDeviceMetadataLine(line)) continue;
    const compact = line.replace(/\s/g, '');
    if (/^\d{2,3}$/.test(compact)) {
      numbers.push(Number(compact));
    }
  }
  return numbers;
}

function suggestBloodPressure(lines: string[]): EvidenceSuggestions {
  const normalizedLines = lines.map((l) => normalize(l).trim());

  let systolic: number | undefined;
  let diastolic: number | undefined;
  let pulse: number | undefined;

  const readNearby = (startIndex: number, kind: 'sys' | 'dia' | 'pulse') => {
    const candidates: number[] = [];
    for (const j of [startIndex + 1, startIndex + 2, startIndex + 3, startIndex + 4]) {
      if (j >= normalizedLines.length) continue;
      if (isDeviceMetadataLine(normalizedLines[j])) continue;
      const compact = normalizedLines[j].replace(/\s/g, '');
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

  for (let i = 0; i < normalizedLines.length; i += 1) {
    const line = normalizedLines[i];
    if (isDeviceMetadataLine(line)) continue;

    if (/\bsys\b|sistol|sistolic|\btas\b/.test(line) && !/\bdia\b|diast/.test(line)) {
      systolic = readNearby(i, 'sys');
    }
    if (/(?:\bdia\b|diast|diastolic|\bpad\b)(?!bet)/.test(line)) {
      diastolic = readNearby(i, 'dia');
    }
    if (/\bpulse\b|\bpulso\b|\/min\b/.test(line)) {
      pulse = readNearby(i, 'pulse');
    }
  }

  const ordered = extractOrderedStandaloneNumbers(lines);

  if (!systolic && diastolic) {
    const candidates = ordered.filter(
      (n) => n !== diastolic && n !== pulse && isValidBp(n, diastolic)
    );
    if (candidates.length) systolic = Math.max(...candidates);
  }

  if (systolic && !diastolic) {
    const candidates = ordered.filter(
      (n) => n !== systolic && n !== pulse && isValidBp(systolic, n)
    );
    if (candidates.length) diastolic = Math.max(...candidates);
  }

  if (systolic && diastolic && !pulse) {
    pulse = ordered.find(
      (n) => n >= 40 && n <= 120 && n !== systolic && n !== diastolic
    );
  }

  if (!systolic || !diastolic) {
    for (let i = 0; i <= ordered.length - 3; i += 1) {
      const [sys, dia, p] = ordered.slice(i, i + 3);
      if (isValidBp(sys, dia) && sys >= 100 && p >= 40 && p <= 120 && sys - dia >= 10) {
        systolic = sys;
        diastolic = dia;
        pulse = p;
        break;
      }
    }
  }

  if (!systolic || !diastolic || !isValidBp(systolic, diastolic)) {
    return {};
  }

  return {
    systolic: String(systolic),
    diastolic: String(diastolic),
    pulse: pulse ? String(pulse) : undefined,
  };
}

/** Sugerencia on-device — puede ser imprecisa; validar con isConfident*. */
export function suggestFromOcrLines(
  lines: string[],
  evidenceType: EvidenceType
): EvidenceSuggestions {
  if (evidenceType === 'blood_pressure') {
    return suggestBloodPressure(lines);
  }

  const text = normalize(lines.join('\n'));
  const mgMatch =
    text.match(/(\d{2,3})\s*mg\s*\/?\s*dl/) ??
    text.match(/mg\s*\/?\s*dl[^\d]{0,10}(\d{2,3})/);

  if (mgMatch) {
    return { glucoseValue: mgMatch[1] };
  }

  for (const line of lines) {
    const digits = line.trim().replace(/\s/g, '');
    if (/^\d{2,3}$/.test(digits)) {
      const value = Number(digits);
      if (value >= 20 && value <= 600) {
        return { glucoseValue: digits };
      }
    }
  }

  return {};
}

export function mergeBloodPressureSuggestions(
  local: EvidenceSuggestions,
  remote: EvidenceSuggestions
): EvidenceSuggestions {
  const localSys = Number(local.systolic);
  const remoteSys = Number(remote.systolic);
  const localDia = Number(local.diastolic);
  const remoteDia = Number(remote.diastolic);

  const localValid = localSys && localDia && isValidBp(localSys, localDia);
  const remoteValid = remoteSys && remoteDia && isValidBp(remoteSys, remoteDia);

  if (localValid && remoteValid) {
    if (localSys >= remoteSys) {
      return {
        systolic: local.systolic,
        diastolic: local.diastolic,
        pulse: local.pulse ?? remote.pulse,
      };
    }
    return {
      systolic: remote.systolic,
      diastolic: remote.diastolic,
      pulse: remote.pulse ?? local.pulse,
    };
  }

  return {
    systolic: local.systolic ?? remote.systolic,
    diastolic: local.diastolic ?? remote.diastolic,
    pulse: local.pulse ?? remote.pulse,
  };
}

export function applySuggestions(
  suggestions: EvidenceSuggestions,
  setters: {
    setSystolic: (v: string) => void;
    setDiastolic: (v: string) => void;
    setPulse: (v: string) => void;
    setGlucoseValue: (v: string) => void;
  }
) {
  if (suggestions.systolic) setters.setSystolic(suggestions.systolic);
  if (suggestions.diastolic) setters.setDiastolic(suggestions.diastolic);
  if (suggestions.pulse) setters.setPulse(suggestions.pulse);
  if (suggestions.glucoseValue) setters.setGlucoseValue(suggestions.glucoseValue);
}
