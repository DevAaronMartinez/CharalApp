import { File } from 'expo-file-system';
import Constants from 'expo-constants';
import { api } from '@/services/api';

/** Expo Go no incluye el módulo nativo ExpoTextExtractor. */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export type OcrResult = {
  lines: string[];
  available: boolean;
};

export async function readImageAsBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

/**
 * OCR on-device. En Expo Go devuelve available:false sin cargar el módulo nativo.
 */
export async function extractMedicationText(uri: string): Promise<OcrResult> {
  if (isExpoGo()) {
    return { lines: [], available: false };
  }

  try {
    const mod = require('expo-text-extractor') as {
      isSupported: boolean;
      extractTextFromImage: (imageUri: string) => Promise<string[]>;
    };

    if (!mod.isSupported) {
      return { lines: [], available: false };
    }

    const lines = await mod.extractTextFromImage(uri);
    return { lines, available: true };
  } catch {
    return { lines: [], available: false };
  }
}

/**
 * OCR local vía backend (Tesseract en tu Mac). Funciona en Expo Go.
 */
export async function identifyMedicationFromPhoto(
  uri: string,
  conditionId?: string
) {
  const imageBase64 = await readImageAsBase64(uri);
  return api.identifyMedicationFromImage(imageBase64, conditionId);
}
