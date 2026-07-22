import { Platform, StatusBar as RNStatusBar, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
}

function getTopPadding(insetTop: number) {
  if (Platform.OS === 'android') {
    const statusBarHeight = RNStatusBar.currentHeight ?? 0;
    // Fallback extra para notch/isla cuando Expo Go no reporta insets
    return Math.max(insetTop, statusBarHeight, 36) + 4;
  }
  return Math.max(insetTop, 12);
}

export function Screen({ children, style, edges = ['top', 'left', 'right'] }: ScreenProps) {
  const insets = useSafeAreaInsets();

  const paddingTop = edges.includes('top') ? getTopPadding(insets.top) : 0;
  const paddingBottom = edges.includes('bottom') ? insets.bottom : 0;
  const paddingLeft = edges.includes('left') ? insets.left : 0;
  const paddingRight = edges.includes('right') ? insets.right : 0;

  return (
    <View
      style={[
        styles.screen,
        style,
        { paddingTop, paddingBottom, paddingLeft, paddingRight },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
