import type {
  BloodPressureContext,
  EvidenceEvaluationResult,
  EvidenceSeverity,
  GlucoseContext,
} from '@/types';

const DISCLAIMER =
  'Esta evaluación es orientativa y no reemplaza la valoración de un profesional de salud.';

type BpInput = {
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  context?: BloodPressureContext;
};

type GlucoseInput = {
  value: number;
  unit?: string;
  context?: GlucoseContext;
  mmolPerL?: number | null;
};

export function evaluateBloodPressure({
  systolic,
  diastolic,
  pulse,
  context = 'resting',
}: BpInput): EvidenceEvaluationResult {
  let level = 'normal';
  let label = 'Presión en rango objetivo';
  let severity: EvidenceSeverity = 'success';

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

  const feedback: string[] = [];

  if (level === 'crisis') {
    feedback.push(
      'Busca atención médica urgente si tienes dolor de pecho, falta de aire o visión borrosa.'
    );
    feedback.push('No suspendas ni dupliques antihipertensivos sin indicación médica.');
  } else if (level === 'stage2' || level === 'stage1') {
    feedback.push('Registra tus lecturas a la misma hora, sentado y en reposo 5 minutos.');
    feedback.push(
      'Reduce sodio, alcohol y estrés; mantén actividad física moderada si tu médico lo autoriza.'
    );
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
    if (pulse > 100) {
      feedback.push(`Pulso ${pulse} lpm: elevado en reposo — menciónalo con tu cardiólogo.`);
    } else if (pulse < 60) {
      feedback.push(
        `Pulso ${pulse} lpm: puede ser normal en atletas; consulta si hay mareo.`
      );
    }
  }

  if (context === 'post_activity') {
    feedback.push(
      'Lectura tras actividad: repite en reposo 5 minutos sentado para comparar con tu objetivo.'
    );
  } else if (context === 'stress') {
    feedback.push(
      'Estrés o dolor pueden elevar la presión; si persiste en reposo, coméntalo con tu médico.'
    );
  } else if (context === 'unknown') {
    feedback.push(
      'Para registros útiles, mide en reposo, misma hora y brazo, sin hablar durante la lectura.'
    );
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
    source: 'manual',
  };
}

export function evaluateGlucose({
  value,
  unit,
  context = 'fasting',
  mmolPerL,
}: GlucoseInput): EvidenceEvaluationResult {
  let level = 'normal';
  let label = 'Glucosa en rango';
  let severity: EvidenceSeverity = 'success';

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
  } else if (value >= 300) {
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

  const feedback: string[] = [];
  const displayUnit = unit === '%' ? '%' : 'mg/dL';

  if (level === 'critical' && value >= 250) {
    feedback.push(
      'Glucosa muy alta: hidrátate, no omitas insulina y contacta a tu médico o urgencias si hay náusea, vómito o aliento acetónico.'
    );
    feedback.push('No hagas ejercicio intenso hasta normalizar con indicación médica.');
  } else if (level === 'critical' || level === 'low') {
    feedback.push(
      'Si tienes temblor, sudor o confusión, consume 15 g de carbohidrato rápido y repite medición.'
    );
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
    source: 'manual',
  };
}

export function evaluateManualEvidence(input: {
  type: 'blood_pressure' | 'blood_glucose';
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  bpContext?: BloodPressureContext;
  glucoseValue?: number;
  glucoseContext?: GlucoseContext;
  unit?: string;
}): EvidenceEvaluationResult | { error: string } {
  if (input.type === 'blood_pressure') {
    const sys = Number(input.systolic);
    const dia = Number(input.diastolic);
    if (!sys || !dia) {
      return { error: 'Ingresa sistólica y diastólica (ej. 120 y 80).' };
    }
    return evaluateBloodPressure({
      systolic: sys,
      diastolic: dia,
      pulse: input.pulse,
      context: input.bpContext ?? 'resting',
    });
  }

  const val = Number(input.glucoseValue);
  if (!val) {
    return { error: 'Ingresa un valor de glucosa o HbA1c.' };
  }
  const context = input.glucoseContext ?? 'fasting';
  return evaluateGlucose({
    value: val,
    unit: input.unit ?? (context === 'hba1c' ? '%' : 'mg/dL'),
    context,
  });
}
