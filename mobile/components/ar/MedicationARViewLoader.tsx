import React, { forwardRef, useMemo } from 'react';
import { isViroNativeAvailable } from '@/utils/viro';
import type { MedicationARViewHandle, MedicationScanPhase } from './med-ar-types';

type Props = {
  capturedUri: string | null;
  scanPhase: MedicationScanPhase;
  showOverlay: boolean;
  scanSession?: number;
  hideHudChrome?: boolean;
  onArTrackingReady?: () => void;
  onArTargetLocked?: (locked: boolean) => void;
};

/**
 * Carga ViroReact solo en development build (nunca en Expo Go).
 * Evita importar @reactvision/react-viro al iniciar el bundle.
 */
export const MedicationARViewLoader = forwardRef<MedicationARViewHandle, Props>(
  function MedicationARViewLoader(props, ref) {
    const ARView = useMemo(() => {
      if (!isViroNativeAvailable()) return null;
      const mod = require('./MedicationARView') as {
        MedicationARView: React.ForwardRefExoticComponent<
          Props & React.RefAttributes<MedicationARViewHandle>
        >;
      };
      return mod.MedicationARView;
    }, []);

    if (!ARView) return null;

    return <ARView ref={ref} {...props} />;
  }
);
