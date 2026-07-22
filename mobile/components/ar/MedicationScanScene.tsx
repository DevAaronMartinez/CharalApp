import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ViroARScene,
  ViroAmbientLight,
  ViroAnimations,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
  ViroSpotLight,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';
import type { ViroARHitTestResult, ViroCameraARHitTest } from '@reactvision/react-viro';

import type { MedicationScanPhase, MedicationScanSceneProps } from './med-ar-types';

export type { MedicationScanPhase, MedicationScanSceneProps } from './med-ar-types';

const ACCENT = '#7B6CF6';
const SUCCESS = '#22C55E';

/** Priorizar el envase (feature points) sobre mesa/monitor detrás. */
const HIT_PRIORITY: ViroARHitTestResult['type'][] = [
  'FeaturePoint',
  'DepthPoint',
  'ExistingPlaneUsingExtent',
  'ExistingPlane',
  'EstimatedHorizontalPlane',
];

const STABLE_FRAMES = 5;
const MIN_DISTANCE_M = 0.12;
const MAX_DISTANCE_M = 1.4;
const STABLE_DELTA_M = 0.035;

let materialsReady = false;

function ensureMaterials() {
  if (materialsReady) return;
  materialsReady = true;

  ViroMaterials.createMaterials({
    scanLine: {
      diffuseColor: ACCENT,
      lightingModel: 'Constant',
    },
    cornerGlow: {
      diffuseColor: ACCENT,
      lightingModel: 'Constant',
    },
    scanLineSuccess: {
      diffuseColor: SUCCESS,
      lightingModel: 'Constant',
    },
  });

  ViroAnimations.registerAnimations({
    scanSweep: {
      properties: { positionY: 0.12 },
      easing: 'Linear',
      duration: 1600,
    },
  });
}

const FRAME = {
  halfW: 0.09,
  halfH: 0.055,
};

function distance3(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function Corner({ x, y, rotZ }: { x: number; y: number; rotZ: number }) {
  return (
    <ViroNode position={[x, y, 0.001]} rotation={[0, 0, rotZ]}>
      <ViroBox position={[0.012, 0, 0]} scale={[0.024, 0.0025, 0.001]} materials={['cornerGlow']} />
      <ViroBox position={[0, 0.012, 0]} scale={[0.0025, 0.024, 0.001]} materials={['cornerGlow']} />
    </ViroNode>
  );
}

function ScanFrame({
  scanPhase,
  success,
}: {
  scanPhase: MedicationScanPhase;
  success: boolean;
}) {
  const lineMat = success ? 'scanLineSuccess' : 'scanLine';
  const h = FRAME.halfH * 2;
  const framePoints: [number, number, number][] = [
    [-FRAME.halfW, -FRAME.halfH, 0],
    [FRAME.halfW, -FRAME.halfH, 0],
    [FRAME.halfW, FRAME.halfH, 0],
    [-FRAME.halfW, FRAME.halfH, 0],
    [-FRAME.halfW, -FRAME.halfH, 0],
  ];

  return (
    <ViroNode>
      <ViroPolyline points={framePoints} thickness={0.0018} materials={[lineMat]} />

      <Corner x={-FRAME.halfW} y={-FRAME.halfH} rotZ={0} />
      <Corner x={FRAME.halfW} y={-FRAME.halfH} rotZ={90} />
      <Corner x={FRAME.halfW} y={FRAME.halfH} rotZ={180} />
      <Corner x={-FRAME.halfW} y={FRAME.halfH} rotZ={270} />

      {scanPhase === 'idle' && (
        <ViroNode
          position={[0, -FRAME.halfH + 0.01, 0.002]}
          animation={{ name: 'scanSweep', run: true, loop: true }}
        >
          <ViroBox scale={[FRAME.halfW * 2, 0.0015, 0.001]} materials={[lineMat]} />
        </ViroNode>
      )}
    </ViroNode>
  );
}

export default function MedicationScanScene(props: MedicationScanSceneProps) {
  ensureMaterials();

  const viroProps = props.arSceneNavigator?.viroAppProps;
  const scanPhase = viroProps?.scanPhase ?? 'idle';
  const scanSession = viroProps?.scanSession ?? 0;
  const success = scanPhase === 'success';

  const [targetLocked, setTargetLocked] = useState(false);
  const [anchor, setAnchor] = useState<{
    position: [number, number, number];
    rotation: [number, number, number];
  } | null>(null);

  const lockedRef = useRef(false);
  const trackingReadyRef = useRef(false);
  const stableCountRef = useRef(0);
  const candidateRef = useRef<{
    position: [number, number, number];
    rotation: [number, number, number];
  } | null>(null);

  useEffect(() => {
    lockedRef.current = false;
    trackingReadyRef.current = false;
    stableCountRef.current = 0;
    candidateRef.current = null;
    setTargetLocked(false);
    setAnchor(null);
  }, [scanSession]);

  const pickHit = useCallback(
    (event: ViroCameraARHitTest, cameraPos: [number, number, number]) => {
      const inRange = (hit: ViroARHitTestResult) => {
        if (!hit.transform?.position) return false;
        const d = distance3(cameraPos, hit.transform.position);
        return d >= MIN_DISTANCE_M && d <= MAX_DISTANCE_M;
      };

      for (const type of HIT_PRIORITY) {
        const hit = event.hitTestResults.find((r) => r.type === type && inRange(r));
        if (hit) return hit;
      }

      return event.hitTestResults.find(inRange) ?? null;
    },
    []
  );

  const onCameraARHitTest = useCallback(
    (event: ViroCameraARHitTest) => {
      if (scanPhase === 'capturing' || lockedRef.current) return;

      const cameraPos = event.cameraOrientation.position as [number, number, number];
      const hit = pickHit(event, cameraPos);
      if (!hit?.transform?.position) {
        stableCountRef.current = 0;
        candidateRef.current = null;
        return;
      }

      const next = {
        position: hit.transform.position as [number, number, number],
        rotation: hit.transform.rotation as [number, number, number],
      };

      const prev = candidateRef.current;
      if (prev && distance3(prev.position, next.position) < STABLE_DELTA_M) {
        stableCountRef.current += 1;
      } else {
        stableCountRef.current = 1;
        candidateRef.current = next;
      }

      if (stableCountRef.current < STABLE_FRAMES) return;

      lockedRef.current = true;
      setAnchor(next);
      setTargetLocked(true);
      viroProps?.onArTargetLocked?.(true);
    },
    [pickHit, scanPhase, viroProps]
  );

  const onTrackingUpdated = useCallback(
    (state: number) => {
      if (trackingReadyRef.current) return;
      if (
        state === ViroTrackingStateConstants.TRACKING_NORMAL ||
        state === ViroTrackingStateConstants.TRACKING_LIMITED
      ) {
        trackingReadyRef.current = true;
        viroProps?.onArTrackingReady?.();
      }
    },
    [viroProps]
  );

  useEffect(() => {
    ensureMaterials();
  }, []);

  return (
    <ViroARScene
      anchorDetectionTypes={['PlanesHorizontal', 'PlanesVertical', 'FeaturePoints']}
      onCameraARHitTest={onCameraARHitTest}
      onTrackingUpdated={onTrackingUpdated}
    >
      <ViroAmbientLight color="#FFFFFF" intensity={500} />
      <ViroSpotLight
        innerAngle={30}
        outerAngle={60}
        direction={[0, 0, -1]}
        position={[0, 0.2, 0.3]}
        color="#FFFFFF"
        castsShadow={false}
        intensity={200}
      />

      {targetLocked && anchor && (
        <ViroNode position={anchor.position} rotation={anchor.rotation}>
          <ScanFrame scanPhase={scanPhase} success={success} />
        </ViroNode>
      )}
    </ViroARScene>
  );
}
