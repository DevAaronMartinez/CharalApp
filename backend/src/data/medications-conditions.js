/**
 * Vincula medicamentos con enfermedades crónicas según principio activo / indicación.
 * Catálogo limitado a diabetes e hipertensión.
 */

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function medHaystack(m) {
  return normalize(
    [
      m.name,
      m.description,
      m.clinicalUse,
      ...(m.brandNames ?? []),
      ...(m.activeIngredients ?? []),
      ...(m.ocrKeywords ?? []),
    ].join(' ')
  );
}

function matchesAny(haystack, terms) {
  return terms.some((t) => haystack.includes(normalize(t)));
}

const RULES = [
  {
    conditionIds: ['hipertension'],
    terms: [
      'losartan',
      'enalapril',
      'amlodipino',
      'amlodipine',
      'valsartan',
      'telmisartan',
      'olmesartan',
      'irbesartan',
      'candesartan',
      'captopril',
      'lisinopril',
      'ramipril',
      'perindopril',
      'benazepril',
      'fosinopril',
      'quinapril',
      'trandolapril',
      'moexipril',
      'nifedipino',
      'diltiazem',
      'verapamilo',
      'felodipino',
      'isradipino',
      'nicardipino',
      'atenolol',
      'propranolol',
      'carvedilol',
      'bisoprolol',
      'nebivolol',
      'metoprolol',
      'labetalol',
      'nadolol',
      'acebutolol',
      'betaxolol',
      'hidroclorotiazida',
      'hctz',
      'clortalidona',
      'indapamida',
      'furosemida',
      'torasemida',
      'bumetanida',
      'espironolactona',
      'eplerenona',
      'amilorida',
      'triamterene',
      'triamtereno',
      'hidralazina',
      'doxazosina',
      'terazosina',
      'prazosina',
      'clonidina',
      'nitroprusiato',
      'hipertension arterial',
      'antihipertensivo',
    ],
  },
  {
    conditionIds: ['diabetes'],
    terms: [
      'metformina',
      'metformin',
      'insulina',
      'insulin',
      'glargina',
      'lantus',
      'empagliflozina',
      'jardiance',
      'dapagliflozina',
      'forxiga',
      'canagliflozina',
      'sitagliptina',
      'januvia',
      'linagliptina',
      'glimepirida',
      'glibenclamida',
      'glipizida',
      'pioglitazona',
      'semaglutida',
      'ozempic',
      'liraglutida',
      'victoza',
      'exenatida',
      'repaglinida',
      'acarbose',
      'diabetes',
      'antidiabetico',
      'hipoglucemiante',
      'isglt2',
      'sglt2',
      'dpp-4',
      'sulfonilurea',
      'biguanida',
    ],
  },
];

const ALLOWED_CONDITIONS = new Set(['diabetes', 'hipertension']);

function restrictConditionIds(ids) {
  return [...new Set(ids.filter((id) => ALLOWED_CONDITIONS.has(id)))];
}

function enrichMedicationConditions(m) {
  const haystack = medHaystack(m);
  const ids = new Set(restrictConditionIds(m.conditionIds ?? []));

  for (const rule of RULES) {
    if (matchesAny(haystack, rule.terms)) {
      for (const id of rule.conditionIds) ids.add(id);
    }
  }

  // Comorbilidad frecuente: ARA-II y iSGLT2 suelen indicarse en diabetes con hipertensión
  if (ids.has('hipertension') && matchesAny(haystack, ['nefroprotector', 'losartan', 'valsartan', 'irbesartan'])) {
    ids.add('diabetes');
  }

  const conditionIds = restrictConditionIds([...ids]);
  if (
    conditionIds.length === (m.conditionIds ?? []).length &&
    conditionIds.every((id, i) => id === (m.conditionIds ?? [])[i])
  ) {
    return m;
  }
  return { ...m, conditionIds };
}

function enrichAllMedications(medications) {
  return medications.map(enrichMedicationConditions);
}

module.exports = { enrichAllMedications, enrichMedicationConditions, RULES };
