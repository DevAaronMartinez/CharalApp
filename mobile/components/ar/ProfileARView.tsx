import { ViroARSceneNavigator } from '@reactvision/react-viro';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { ProfileARGrouped, ProfileARViroProps } from './profile-ar-types';
import ProfileARScene from './ProfileARScene';

type Props = {
  grouped: ProfileARGrouped;
  selectedId: string | null;
  onSelectCondition: (id: string) => void;
};

function ProfileARSceneWrapper(props: import('./profile-ar-types').ProfileARSceneProps) {
  return <ProfileARScene {...props} />;
}

export function ProfileARView({ grouped, selectedId, onSelectCondition }: Props) {
  const [trackingReady, setTrackingReady] = useState(false);

  useEffect(() => {
    setTrackingReady(false);
    const fallback = setTimeout(() => setTrackingReady(true), 2500);
    return () => clearTimeout(fallback);
  }, [grouped]);

  const viroAppProps: ProfileARViroProps = {
    grouped,
    selectedId,
    onSelectCondition,
    onTrackingReady: () => setTrackingReady(true),
  };

  return (
    <View style={styles.wrap} collapsable={false}>
      <ViroARSceneNavigator
        autofocus
        style={StyleSheet.absoluteFill}
        viroAppProps={viroAppProps}
        initialScene={{
          scene: ProfileARSceneWrapper as unknown as () => React.JSX.Element,
        }}
      />

      {!trackingReady && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#000',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
