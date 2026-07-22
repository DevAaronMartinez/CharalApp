import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

/** Expo Go no incluye el módulo nativo de ViroReact. */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** Viro solo funciona en development build / binario nativo. */
export function isViroNativeAvailable(): boolean {
  if (isExpoGo()) return false;
  return Boolean(
    NativeModules.VRTARSceneNavigatorModule ||
      NativeModules.VRTARSceneModule ||
      NativeModules.ViroCameraModule
  );
}

export type { ViroScreenshotResult } from '@/components/ar/med-ar-types';
