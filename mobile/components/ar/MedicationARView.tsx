import { Ionicons } from '@expo/vector-icons';
import { ViroARSceneNavigator } from '@reactvision/react-viro';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { MedicationScanPhase } from './med-ar-types';
import type { MedicationARViewHandle, ViroScreenshotResult } from './med-ar-types';
import MedicationScanScene from './MedicationScanScene';

export type { MedicationARViewHandle } from './med-ar-types';

type Props = {
  capturedUri: string | null;
  scanPhase: MedicationScanPhase;
  showOverlay: boolean;
  scanSession?: number;
  hideHudChrome?: boolean;
  onArTrackingReady?: () => void;
  onArTargetLocked?: (locked: boolean) => void;
};

function MedicationScanSceneWrapper(props: import('./med-ar-types').MedicationScanSceneProps) {
  return <MedicationScanScene {...props} />;
}

export const MedicationARView = forwardRef<MedicationARViewHandle, Props>(function MedicationARView(
  {
    capturedUri,
    scanPhase,
    showOverlay,
    scanSession = 0,
    hideHudChrome = false,
    onArTrackingReady,
    onArTargetLocked,
  },
  ref
) {
  const navigatorRef = useRef<InstanceType<typeof ViroARSceneNavigator> | null>(null);
  const [arReady, setArReady] = useState(false);
  const [targetLocked, setTargetLocked] = useState(false);

  useImperativeHandle(ref, () => ({
    takeScreenshot: async (fileName: string) => {
      const nav = navigatorRef.current?.arSceneNavigator;
      if (!nav?.takeScreenshot) return null;
      try {
        return (await nav.takeScreenshot(fileName, false)) as ViroScreenshotResult;
      } catch {
        return null;
      }
    },
  }));

  useEffect(() => {
    if (capturedUri) return;
    setArReady(false);
    setTargetLocked(false);
    const timer = setTimeout(() => setArReady(true), 800);
    return () => clearTimeout(timer);
  }, [capturedUri, scanSession]);

  const handleTargetLocked = (locked: boolean) => {
    setTargetLocked(locked);
    onArTargetLocked?.(locked);
  };

  return (
    <View style={styles.wrap}>
      {!capturedUri ? (
        <ViroARSceneNavigator
          ref={navigatorRef}
          autofocus
          style={StyleSheet.absoluteFill}
          viroAppProps={{
            scanPhase,
            scanSession,
            onArTrackingReady,
            onArTargetLocked: handleTargetLocked,
          }}
          initialScene={{
            scene: MedicationScanSceneWrapper as unknown as () => React.JSX.Element,
          }}
        />
      ) : (
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      {showOverlay && !capturedUri && (
        <View style={styles.hud} pointerEvents="none">
          {!hideHudChrome && (
            <View style={styles.hudTop}>
              <View style={styles.hudBadge}>
                <Ionicons name="scan-circle" size={14} color="#fff" />
                <Text style={styles.hudBadgeText}>AR · MEDICAMENTO</Text>
              </View>
              {!arReady && (
                <View style={styles.trackingPill}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.trackingText}>Inicializando…</Text>
                </View>
              )}
              {arReady && !targetLocked && (
                <View style={[styles.trackingPill, styles.trackingPillScan]}>
                  <Ionicons name="move-outline" size={14} color="#fff" />
                  <Text style={styles.trackingText}>Apunta al envase</Text>
                </View>
              )}
              {targetLocked && (
                <View style={[styles.trackingPill, styles.trackingPillLocked]}>
                  <Ionicons name="checkmark-circle" size={14} color="#86efac" />
                  <Text style={styles.trackingText}>AR activo</Text>
                </View>
              )}
            </View>
          )}

          {!targetLocked && (
            <>
              <View style={styles.reticle}>
                <View style={styles.reticleH} />
                <View style={styles.reticleV} />
              </View>
              <Text style={[styles.frameHint, hideHudChrome && styles.frameHintRaised]}>
                Enfoca el nombre en el centro
              </Text>
            </>
          )}
        </View>
      )}

      {scanPhase === 'capturing' && (
        <View style={styles.captureFlash} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.captureFlashText}>Capturando…</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#000',
  },
  hud: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(91, 79, 207, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  hudBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  trackingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trackingPillScan: {
    backgroundColor: 'rgba(91, 79, 207, 0.75)',
  },
  trackingPillLocked: {
    backgroundColor: 'rgba(22, 101, 52, 0.75)',
  },
  trackingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  reticle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleH: {
    position: 'absolute',
    width: 28,
    height: 2,
    backgroundColor: 'rgba(123, 108, 246, 0.85)',
    borderRadius: 1,
  },
  reticleV: {
    position: 'absolute',
    width: 2,
    height: 28,
    backgroundColor: 'rgba(123, 108, 246, 0.85)',
    borderRadius: 1,
  },
  frameHint: {
    position: 'absolute',
    bottom: 16,
    maxWidth: '88%',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  frameHintRaised: {
    bottom: 120,
  },
  captureFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(91, 79, 207, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  captureFlashText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
