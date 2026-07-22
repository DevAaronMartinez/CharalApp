import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { isViroNativeAvailable } from '@/utils/viro';
import type { ProfileARGrouped } from './profile-ar-types';

type Props = {
  grouped: ProfileARGrouped;
  selectedId: string | null;
  onSelectCondition: (id: string) => void;
};

/** Carga ViroReact solo en development build (nunca en Expo Go). */
export function ProfileARViewLoader(props: Props) {
  const ARView = useMemo(() => {
    if (!isViroNativeAvailable()) return null;
    const mod = require('./ProfileARView') as {
      ProfileARView: ComponentType<Props>;
    };
    return mod.ProfileARView;
  }, []);

  if (!ARView) return null;

  return <ARView {...props} />;
}
