import type { ComponentType, ReactNode } from 'react';

import {
  canUseOnDeviceVlm,
  initOnDeviceExecutorch,
} from '@/utils/executorch';

type Props = {
  children: ReactNode;
};

/**
 * Envuelve hijos con un único HealthVlmProvider nativo.
 * En Expo Go / web es un no-op (children sin provider).
 */
export function MaybeHealthVlmProvider({ children }: Props) {
  if (canUseOnDeviceVlm() && initOnDeviceExecutorch()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { HealthVlmProvider } = require('@/hooks/useHealthDeviceVlm') as {
        HealthVlmProvider: ComponentType<{ children: ReactNode }>;
      };
      return <HealthVlmProvider>{children}</HealthVlmProvider>;
    } catch (err) {
      console.warn('[vlm] provider no disponible:', err);
    }
  }

  return <>{children}</>;
}
