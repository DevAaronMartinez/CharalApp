/**
 * Fábrica compacta para generar entradas del catálogo de medicamentos.
 */
function med(id, data) {
  return { id: `med-${id}`, ...data };
}

let barcodeSeq = 390000;

function nextBarcode() {
  barcodeSeq += 1;
  return String(barcodeSeq);
}

const CLASS_DEFAULTS = {
  analgesic: {
    clinical: 'Dolor leve-moderado',
    warns: ['No exceder la dosis máxima diaria', 'Precaución en insuficiencia renal o hepática'],
  },
  aine: {
    clinical: 'Dolor e inflamación',
    warns: ['Tomar con alimentos si hay molestia gástrica', 'Precaución cardiovascular con uso prolongado'],
    interactions: ['Anticoagulantes', 'Otros AINEs'],
  },
  antibiotic: {
    clinical: 'Infección bacteriana — solo con prescripción médica',
    warns: ['Completar el tratamiento', 'Informar alergias a antibióticos'],
  },
  antihypertensive: {
    clinical: 'Hipertensión arterial y/o protección cardiovascular',
    conditions: ['hipertension'],
    warns: ['No suspender abruptamente sin indicación médica'],
  },
  psychiatric: {
    clinical: 'Trastorno psiquiátrico según prescripción',
    warns: ['No suspender de golpe', 'Puede causar somnolencia al inicio'],
    interactions: ['Alcohol', 'Depresores del SNC'],
  },
  antidiabetic: {
    conditions: ['diabetes'],
    warns: ['Riesgo de hipoglucemia según fármaco', 'Control glucémico regular'],
  },
  anticonvulsant: {
    conditions: ['epilepsia'],
    warns: ['No suspender abruptamente', 'Control de niveles si aplica'],
  },
  respiratory: {
    clinical: 'Enfermedad respiratoria o síntomas respiratorios',
    warns: ['Usar según indicación médica'],
  },
  gi: {
    clinical: 'Trastornos digestivos',
    warns: ['Leer contraindicaciones del prospecto'],
  },
  derm: {
    clinical: 'Afecciones de la piel',
    form: 'Crema o gel',
    warns: ['Uso externo', 'Evitar contacto con ojos'],
  },
  hormone: {
    clinical: 'Trastorno hormonal — ajuste según laboratorios',
    conditions: ['hipotiroidismo'],
    warns: ['Tomar a la misma hora', 'No automedicarse'],
  },
  vitamin: {
    clinical: 'Deficiencia vitamínica o suplemento',
    warns: ['Respetar dosis recomendada'],
  },
  oncologic: {
    clinical: 'Enfermedad oncológica — esquema especializado',
    warns: ['Seguimiento hematológico estricto', 'Teratogénico en muchos casos'],
  },
  immunosuppressant: {
    clinical: 'Enfermedad autoinmune o trasplante',
    conditions: ['lupus_eritematoso', 'artritis_reumatoide'],
    warns: ['Riesgo infeccioso', 'Vacunas vivas contraindicadas'],
  },
  urology: {
    clinical: 'Síntomas urinarios o urológicos',
    warns: ['Hidratación adecuada', 'Consultar retención urinaria'],
  },
  ophthalmic: {
    form: 'Gotas o ungüento oftálmico',
    clinical: 'Enfermedad ocular',
    warns: ['No tocar gotero con el ojo', 'Retirar lentes de contacto si aplica'],
  },
  otc: {
    clinical: 'Autocuidado — leer empaque',
    warns: ['Consultar al médico si persisten síntomas'],
  },
};

/**
 * @param {string} id
 * @param {string} name
 * @param {object} opts
 */
function entry(id, name, opts = {}) {
  const cls = opts.class ? CLASS_DEFAULTS[opts.class] || {} : {};
  const ingredients = opts.ingredients ?? [name.split(/[/+]/)[0].trim()];
  const brands = opts.brands ?? [name.split('(')[0].trim()];

  return med(id, {
    name,
    brandNames: brands,
    activeIngredients: ingredients,
    ocrKeywords: opts.keywords ?? [],
    barcode: nextBarcode(),
    conditionIds: opts.conditions ?? cls.conditions ?? [],
    ...(opts.clinical || cls.clinical ? { clinicalUse: opts.clinical ?? cls.clinical } : {}),
    dosage: opts.dose ?? 'Según prospecto o indicación médica',
    form: opts.form ?? cls.form ?? 'Tableta',
    color: '#FFFFFF',
    shape: 'Ver empaque oficial',
    warnings: opts.warns ?? cls.warns ?? ['Verificar prospecto', 'Consultar a tu médico'],
    description: opts.desc ?? `${name}. Información educativa — confirmar con empaque y profesional de salud.`,
    interactions: opts.interactions ?? cls.interactions ?? [],
  });
}

/** Genera entradas desde filas compactas: [id, name, class, brands?, dose?, form?, desc?] */
function fromRows(rows) {
  return rows.map(([id, name, cls, brands, dose, form, desc, extra = {}]) =>
    entry(id, name, {
      class: cls,
      brands: brands ? (Array.isArray(brands) ? brands : brands.split('|').map((s) => s.trim())) : undefined,
      dose,
      form,
      desc,
      ...extra,
    })
  );
}

module.exports = { entry, fromRows, med, CLASS_DEFAULTS };
