import { useEffect, useMemo } from 'react';
import {
  ViroARScene,
  ViroAmbientLight,
  ViroAnimations,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroSphere,
  ViroSpotLight,
  ViroTrackingStateConstants,
} from '@reactvision/react-viro';

import {
  PROFILE_CATEGORY_COLORS,
  PROFILE_CATEGORY_ORDER,
  type ProfileARGrouped,
  type ProfileARSceneProps,
  type ProfileConditionCard,
} from './profile-ar-types';

export type { ProfileARSceneProps } from './profile-ar-types';

let materialsReady = false;

function ensureMaterials() {
  if (materialsReady) return;
  materialsReady = true;

  const mats: Record<string, object> = {
    glow: {
      diffuseColor: '#FFFFFF',
      lightingModel: 'Constant',
      opacity: 0.18,
    },
    ring: {
      diffuseColor: '#FFFFFF',
      lightingModel: 'Constant',
      opacity: 0.85,
    },
    floor: {
      diffuseColor: '#7B6CF6',
      lightingModel: 'Constant',
      opacity: 0.12,
    },
  };

  for (const cat of PROFILE_CATEGORY_ORDER) {
    const color = PROFILE_CATEGORY_COLORS[cat];
    mats[`orb_${cat}`] = {
      diffuseColor: color,
      lightingModel: 'Constant',
    };
    mats[`orb_${cat}_dim`] = {
      diffuseColor: color,
      lightingModel: 'Constant',
      opacity: 0.55,
    };
  }

  ViroMaterials.createMaterials(mats);

  ViroAnimations.registerAnimations({
    orbFloat: {
      properties: { positionY: 0.018 },
      easing: 'EaseInEaseOut',
      duration: 2200,
    },
    glowPulse: {
      properties: { scaleX: 1.15, scaleY: 1.15, scaleZ: 1.15, opacity: 0.28 },
      easing: 'EaseInEaseOut',
      duration: 1200,
    },
  });
}

function flattenCards(grouped: ProfileARGrouped): ProfileConditionCard[] {
  return PROFILE_CATEGORY_ORDER.flatMap((cat) => grouped[cat] ?? []);
}

function markerLayout(total: number, index: number): [number, number, number] {
  const z = -0.72;
  const y = 0.06;
  if (total <= 1) return [0, y, z];
  const span = Math.min(0.5, 0.22 * (total - 1));
  const x = -span / 2 + (index / (total - 1)) * span;
  return [x, y, z];
}

function ConditionMarker({
  card,
  index,
  total,
  selected,
  onSelect,
}: {
  card: ProfileConditionCard;
  index: number;
  total: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const mat = selected ? `orb_${card.category}` : `orb_${card.category}_dim`;
  const position = markerLayout(total, index);

  return (
    <ViroNode
      position={position}
      onClick={() => onSelect(card.id)}
      animation={{ name: 'orbFloat', run: !selected, loop: true }}
    >
      {selected && (
        <ViroNode animation={{ name: 'glowPulse', run: true, loop: true }}>
          <ViroSphere radius={0.1} materials={['glow']} />
          <ViroBox scale={[0.14, 0.003, 0.14]} materials={['ring']} />
        </ViroNode>
      )}

      <ViroBox position={[0, -0.04, 0]} scale={[0.004, 0.045, 0.004]} materials={[mat]} />

      <ViroSphere radius={selected ? 0.042 : 0.032} materials={[mat]} />
    </ViroNode>
  );
}

export default function ProfileARScene(props: ProfileARSceneProps) {
  ensureMaterials();

  const viroProps = props.arSceneNavigator?.viroAppProps;
  const grouped = viroProps?.grouped ?? {};
  const selectedId = viroProps?.selectedId ?? null;

  const cards = useMemo(() => flattenCards(grouped), [grouped]);

  const onSelect = (id: string) => {
    viroProps?.onSelectCondition?.(id);
  };

  const onTrackingUpdated = (state: number) => {
    if (
      state === ViroTrackingStateConstants.TRACKING_NORMAL ||
      state === ViroTrackingStateConstants.TRACKING_LIMITED
    ) {
      viroProps?.onTrackingReady?.();
    }
  };

  useEffect(() => {
    ensureMaterials();
  }, []);

  return (
    <ViroARScene onTrackingUpdated={onTrackingUpdated}>
      <ViroAmbientLight color="#FFFFFF" intensity={480} />
      <ViroSpotLight
        innerAngle={40}
        outerAngle={70}
        direction={[0, -0.15, -1]}
        position={[0, 0.5, 0.15]}
        color="#FFFFFF"
        intensity={200}
        castsShadow={false}
      />

      <ViroNode position={[0, -0.02, -0.55]}>
        <ViroBox scale={[0.9, 0.002, 0.45]} materials={['floor']} />
      </ViroNode>

      {cards.map((card, index) => (
        <ConditionMarker
          key={card.id}
          card={card}
          index={index}
          total={cards.length}
          selected={selectedId === card.id}
          onSelect={onSelect}
        />
      ))}
    </ViroARScene>
  );
}
