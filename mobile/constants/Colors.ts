const primary = '#5B4FCF';
const primaryLight = '#7B6FE0';
const secondary = '#2EC4B6';
const accent = '#FF6B6B';
const warning = '#FFB347';
const success = '#4CAF50';

const tintColorLight = primary;
const tintColorDark = primaryLight;

export default {
  primary,
  primaryLight,
  secondary,
  accent,
  warning,
  success,
  light: {
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    background: '#F8F9FC',
    card: '#FFFFFF',
    tint: tintColorLight,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    border: '#E5E7EB',
  },
  dark: {
    text: '#F3F4F6',
    textSecondary: '#9CA3AF',
    background: '#0F0F1A',
    card: '#1A1A2E',
    tint: tintColorDark,
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
    border: '#374151',
  },
};

export const categoryLabels: Record<string, string> = {
  cronica: 'Enfermedad crónica',
  discapacidad: 'Discapacidad',
  sindrome: 'Síndrome',
};

export const serviceTypeLabels: Record<string, string> = {
  clinica: 'Clínica',
  hospital: 'Hospital',
  rehabilitacion: 'Rehabilitación',
  ong: 'ONG',
  'grupo-apoyo': 'Grupo de apoyo',
};
