import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Expo Go no incluye módulos nativos de ExecuTorch. */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * VLM on-device requiere development build (igual que Viro).
 * No usar en Expo Go ni en web.
 */
export function canUseOnDeviceVlm(): boolean {
  return Platform.OS !== 'web' && !isExpoGo();
}

let initialized = false;

/** Llama una sola vez en el entry nativo, antes de usar hooks de ExecuTorch. */
export function initOnDeviceExecutorch(): boolean {
  if (initialized) return true;
  if (Platform.OS === 'web' || isExpoGo()) return false;

  try {
    const { initExecutorch } = require('react-native-executorch') as {
      initExecutorch: (cfg: { resourceFetcher: unknown }) => void;
    };
    const { ExpoResourceFetcher } = require(
      'react-native-executorch-expo-resource-fetcher/lib/index.js'
    ) as { ExpoResourceFetcher: unknown };

    initExecutorch({ resourceFetcher: ExpoResourceFetcher });
    initialized = true;
    return true;
  } catch (err) {
    console.warn('[executorch] init falló:', err);
    return false;
  }
}

/** Ruta local para mediaPath / imagePath del VLM (siempre con file://). */
export function toLocalImagePath(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}
