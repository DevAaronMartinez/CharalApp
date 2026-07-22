export type MedicationScanPhase = 'idle' | 'capturing' | 'success';

export type ViroScreenshotResult = {
  success?: boolean;
  url?: string;
  errorCode?: number;
};

export type MedicationARViewHandle = {
  takeScreenshot: (fileName: string) => Promise<ViroScreenshotResult | null>;
};

export type MedicationScanSceneProps = {
  arSceneNavigator?: {
    viroAppProps?: {
      scanPhase?: MedicationScanPhase;
      scanSession?: number;
      onArTrackingReady?: () => void;
      onArTargetLocked?: (locked: boolean) => void;
    };
  };
};
