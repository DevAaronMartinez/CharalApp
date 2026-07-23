import type { Condition, Recommendation, User } from '@/types';

/** Datos embebidos en la app — no requieren backend ni red. */

export const LOCAL_CONDITIONS: Condition[] = [
  {
    id: 'diabetes',
    name: 'Diabetes',
    category: 'cronica',
    description: 'Condición metabólica que afecta cómo el cuerpo procesa la glucosa.',
    icon: 'water',
  },
  {
    id: 'hipertension',
    name: 'Hipertensión Arterial',
    category: 'cronica',
    description:
      'Presión arterial elevada de forma persistente; requiere control y tratamiento continuo.',
    icon: 'pulse',
  },
];

export const LOCAL_DEMO_USER: User = {
  id: 'local-demo-user',
  name: 'María García',
  email: 'maria@example.com',
  conditionIds: ['diabetes', 'hipertension'],
  latitude: 19.431,
  longitude: -99.134,
  city: 'CDMX',
  bio: 'Diabética tipo 2 e hipertensión. Me ayuda el monitoreo continuo.',
  needsHelp: false,
  createdAt: '2025-01-15T00:00:00.000Z',
};

export const LOCAL_RECOMMENDATIONS: Record<string, Recommendation[]> = {
  diabetes: [
    {
      id: 'rec-d-1',
      title: 'Monitoreo continuo de glucosa',
      tip: 'Los sensores CGM ayudan a detectar picos y caídas antes de que sean peligrosos. Pregunta a tu endocrinólogo si es opción para ti.',
    },
    {
      id: 'rec-d-2',
      title: 'Registra tus lecturas en la app',
      tip: 'En Mi perfil de salud puedes anotar glucosa en ayunas o después de comer y recibir retroalimentación educativa al instante.',
    },
    {
      id: 'rec-d-3',
      title: 'Plato del bien comer adaptado',
      tip: 'Mitad verduras, un cuarto proteína magra y un cuarto carbohidratos integrales. Prioriza fibra para evitar picos bruscos.',
    },
    {
      id: 'rec-d-4',
      title: 'Actividad física regular',
      tip: '150 minutos semanales de caminata o ejercicio moderado mejoran la sensibilidad a la insulina. Consulta antes si tienes complicaciones.',
    },
    {
      id: 'rec-d-5',
      title: 'Plan ante hipoglucemia',
      tip: 'Si glucosa <70 mg/dL: 15 g de carbohidrato rápido (jugo, miel, tableta de glucosa), espera 15 min y vuelve a medir.',
    },
    {
      id: 'rec-d-6',
      title: 'Caminata de 10 min después de comer',
      tip: 'Un paseo ligero tras la comida principal puede bajar el pico de glucosa. No necesitas correr: constancia y ritmo cómodo.',
    },
  ],
  hipertension: [
    {
      id: 'rec-h-1',
      title: 'Monitoreo en casa',
      tip: 'Toma la presión a la misma hora, sentado, espalda apoyada y brazo a nivel del corazón, tras 5 minutos de reposo.',
    },
    {
      id: 'rec-h-2',
      title: 'Reducir sodio',
      tip: 'Limitar sal de mesa, embutidos, consomes y comida ultraprocesada puede bajar la presión varios puntos.',
    },
    {
      id: 'rec-h-3',
      title: 'Registra presión en Mi perfil',
      tip: 'Anota sistólica, diastólica y pulso tras cada medición. La app te indica si estás en rango objetivo o si conviene consultar.',
    },
    {
      id: 'rec-h-4',
      title: 'Dieta tipo DASH',
      tip: 'Aumenta frutas, verduras, granos integrales y lácteos bajos en grasa. Combina con poco sodio para un efecto aditivo sobre la presión.',
    },
    {
      id: 'rec-h-5',
      title: 'Cuándo acudir a urgencias',
      tip: 'Presión ≥180/120 con dolor de pecho, falta de aire, visión borrosa o confusión requiere atención médica inmediata.',
    },
    {
      id: 'rec-h-6',
      title: 'Manejo del estrés',
      tip: 'Respiración diafragmática, meditación breve o caminatas al aire libre ayudan a bajar picos de presión por estrés crónico.',
    },
  ],
};

export function getLocalRecommendations(conditionId: string): {
  condition: Condition | null;
  recommendations: Recommendation[];
} {
  const condition = LOCAL_CONDITIONS.find((c) => c.id === conditionId) ?? null;
  return {
    condition,
    recommendations: LOCAL_RECOMMENDATIONS[conditionId] ?? [],
  };
}
