/**
 * Vincula medicamentos con enfermedades crónicas según principio activo / indicación.
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
    conditionIds: ['hipercolesterolemia'],
    terms: [
      'atorvastatina',
      'rosuvastatina',
      'simvastatina',
      'pravastatina',
      'fluvastatina',
      'pitavastatina',
      'lovastatina',
      'ezetimiba',
      'fenofibrato',
      'gemfibrozilo',
      'alirocumab',
      'evolocumab',
      'colesevelam',
      'estatina',
      'dislipidemia',
      'hipercolesterolemia',
      'ldl',
      'pcsk9',
    ],
  },
  {
    conditionIds: ['insuficiencia_cardiaca'],
    terms: [
      'sacubitril',
      'entresto',
      'carvedilol',
      'bisoprolol',
      'metoprolol',
      'ivabradina',
      'digoxina',
      'espironolactona',
      'eplerenona',
      'furosemida',
      'torasemida',
      'dobutamina',
      'milrinona',
      'insuficiencia cardiaca',
      'fraccion de eyeccion',
      'ic con fraccion',
    ],
  },
  {
    conditionIds: ['hipotiroidismo'],
    terms: [
      'levotiroxina',
      'liothyronine',
      't3',
      'euthyrox',
      'synthroid',
      'hipotiroidismo',
      'hormona tiroidea',
    ],
  },
  {
    conditionIds: ['hipertiroidismo'],
    terms: ['metimazol', 'propiltiouracilo', 'hipertiroidismo', 'tiroides hiperactivo'],
  },
  {
    conditionIds: ['asma_cronica'],
    terms: [
      'salbutamol',
      'albuterol',
      'formoterol',
      'salmeterol',
      'budesonida inhalada',
      'fluticasona inhalada',
      'beclometasona inhalada',
      'mometasona inhalada',
      'montelukast',
      'tiotropio',
      'ipratropio',
      'omalizumab',
      'teofilina',
      'asma',
      'inhalador',
      'laba',
      'lama',
    ],
  },
  {
    conditionIds: ['epoc'],
    terms: [
      'tiotropio',
      'ipratropio',
      'umeclidinio',
      'vilanterol',
      'roflumilast',
      'budesonida inhalada',
      'fluticasona inhalada',
      'formoterol',
      'salbutamol ipatropio',
      'epoc',
      'enfermedad pulmonar obstructiva',
    ],
  },
  {
    conditionIds: ['enfermedad_renal_cronica'],
    terms: [
      'sevelamer',
      'cinecalcet',
      'dapagliflozina nefropatia',
      'finerenona',
      'eritropoyetina',
      'nefroprotector',
      'enfermedad renal cronica',
      'insuficiencia renal cronica',
    ],
  },
  {
    conditionIds: ['osteoporosis'],
    terms: [
      'alendronato',
      'risedronato',
      'ibandronato',
      'zoledronico',
      'denosumab',
      'raloxifeno',
      'teriparatida',
      'abaloparatida',
      'romosozumab',
      'calcio vitamina d',
      'carbonato de calcio',
      'osteoporosis',
    ],
  },
  {
    conditionIds: ['gota'],
    terms: [
      'alopurinol',
      'febuxostat',
      'probenecid',
      'colchicina',
      'pegloticasa',
      'gota',
      'hipouricemiante',
    ],
  },
  {
    conditionIds: ['parkinson'],
    terms: [
      'levodopa',
      'carbidopa',
      'pramipexol',
      'ropinirol',
      'rotigotina',
      'rasagilina',
      'selegilina',
      'entacapona',
      'amantadina',
      'parkinson',
    ],
  },
  {
    conditionIds: ['demencia'],
    terms: [
      'donepezilo',
      'memantina',
      'galantamina',
      'rivastigmina',
      'demencia',
      'alzheimer',
    ],
  },
  {
    conditionIds: ['lupus_eritematoso'],
    terms: [
      'hidroxicloroquina',
      'cloroquina',
      'belimumab',
      'micofenolato',
      'azatioprina',
      'lupus',
      'lupico',
    ],
  },
  {
    conditionIds: ['glaucoma'],
    terms: [
      'latanoprost',
      'travoprost',
      'bimatoprost',
      'tafluprost',
      'timolol oftalm',
      'dorzolamida',
      'brimonidina oftalm',
      'brinzolamida',
      'netarsudil',
      'glaucoma',
    ],
  },
  {
    conditionIds: ['hepatitis_cronica'],
    terms: [
      'sofosbuvir',
      'ledipasvir',
      'velpatasvir',
      'ribavirina hepatitis',
      'entecavir',
      'tenofovir',
      'hepatitis b',
      'hepatitis c',
    ],
  },
];

function enrichMedicationConditions(m) {
  const haystack = medHaystack(m);
  const ids = new Set(m.conditionIds ?? []);

  for (const rule of RULES) {
    if (matchesAny(haystack, rule.terms)) {
      for (const id of rule.conditionIds) ids.add(id);
    }
  }

  // Comorbilidades frecuentes con diabetes
  if (ids.has('hipertension') || ids.has('hipercolesterolemia') || ids.has('insuficiencia_cardiaca')) {
    if (matchesAny(haystack, ['nefroprotector', 'diabetes', 'jardiance', 'empagliflozina', 'dapagliflozina'])) {
      ids.add('diabetes');
    }
  }

  const conditionIds = [...ids];
  if (conditionIds.length === (m.conditionIds ?? []).length && conditionIds.every((id, i) => id === (m.conditionIds ?? [])[i])) {
    return m;
  }
  return { ...m, conditionIds };
}

function enrichAllMedications(medications) {
  return medications.map(enrichMedicationConditions);
}

module.exports = { enrichAllMedications, enrichMedicationConditions, RULES };
