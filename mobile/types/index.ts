export type ConditionCategory = 'cronica' | 'discapacidad' | 'sindrome';

export interface Condition {
  id: string;
  name: string;
  category: ConditionCategory;
  description: string;
  icon: string;
}

export interface Recommendation {
  id: string;
  title: string;
  tip: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  conditionIds: string[];
  latitude?: number;
  longitude?: number;
  city?: string;
  needsHelp: boolean;
  bio?: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  conditionId: string;
  title: string;
  content: string;
  tags: string[];
  likes: number;
  createdAt: string;
}

export interface HealthService {
  id: string;
  name: string;
  type: string;
  conditionIds: string[];
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  description: string;
}

export interface LocationCluster {
  latitude: number;
  longitude: number;
  count: number;
  city?: string;
  conditionIds: string[];
}

export interface Medication {
  id: string;
  name: string;
  brandNames: string[];
  barcode: string;
  conditionIds: string[];
  /** Indicación clínica real cuando no aplica a condiciones crónicas del perfil */
  clinicalUse?: string;
  activeIngredients?: string[];
  dosage: string;
  form: string;
  color: string;
  shape: string;
  warnings: string[];
  description: string;
  interactions: string[];
}

export interface MedicationIdentifyResult {
  mode: 'barcode' | 'search' | 'list' | 'ocr';
  match: Medication | null;
  matches?: Medication[];
  suggestions?: Medication[];
  detectedLines?: string[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export type EvidenceType = 'blood_pressure' | 'blood_glucose';

export type GlucoseContext = 'fasting' | 'postprandial' | 'hba1c' | 'unknown';

export type BloodPressureContext = 'resting' | 'post_activity' | 'stress' | 'unknown';

export type EvidenceSeverity = 'success' | 'warning' | 'danger' | 'critical';

export interface EvidenceEvaluationResult {
  type: EvidenceType;
  reading: string;
  label: string;
  level: string;
  severity: EvidenceSeverity;
  feedback: string[];
  disclaimer: string;
  source?: 'manual' | 'ocr';
  values?: Record<string, unknown>;
  detectedLines?: string[];
}

export interface EvidenceDetectionResult {
  type: EvidenceType;
  found: boolean;
  confident?: boolean;
  suggestions?: {
    systolic?: number;
    diastolic?: number;
    pulse?: number;
    value?: number;
    unit?: string;
    context?: GlucoseContext;
  };
  detectedLines?: string[];
}

export interface EvidenceEvaluationError {
  error: string;
  detectedLines?: string[];
  ocrText?: string;
}
