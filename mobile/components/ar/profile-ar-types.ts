import type { ConditionCategory } from '@/types';

export type ProfileConditionCard = {
  id: string;
  name: string;
  category: ConditionCategory;
  description: string;
};

export type ProfileARGrouped = Partial<Record<ConditionCategory, ProfileConditionCard[]>>;

export type ProfileARViroProps = {
  grouped: ProfileARGrouped;
  selectedId: string | null;
  onSelectCondition?: (id: string) => void;
  onTrackingReady?: () => void;
};

export type ProfileARSceneProps = {
  arSceneNavigator?: {
    viroAppProps?: ProfileARViroProps;
  };
};

export const PROFILE_CATEGORY_COLORS: Record<ConditionCategory, string> = {
  cronica: '#5B4FCF',
  discapacidad: '#2EC4B6',
  sindrome: '#FF6B6B',
};

export const PROFILE_CATEGORY_ORDER: ConditionCategory[] = [
  'cronica',
  'discapacidad',
  'sindrome',
];
