import Constants from 'expo-constants';

import {
  identifyFromOcrText,
  identifyMedicationFromPhotoLocal,
  identifyMedications,
} from '@/utils/medicationIdentify';
import type { MedicationIdentifyResult } from '@/types';

/** Expo Go no incluye el módulo nativo ExpoTextExtractor. */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export type OcrResult = {
  lines: string[];
  available: boolean;
};

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

/** Match local contra el catálogo embebido (sin red). */
export function identifyMedicationFromOcr(
  text: string,
  conditionId?: string
): MedicationIdentifyResult {
  return identifyFromOcrText(text, conditionId);
}

/** Búsqueda local por nombre / código. */
export function identifyMedication(params?: {
  q?: string;
  barcode?: string;
  conditionId?: string;
}): MedicationIdentifyResult {
  return identifyMedications({
    query: params?.q,
    barcode: params?.barcode,
    conditionId: params?.conditionId,
  });
}

/**
 * OCR on-device + identificación local. Sin backend.
 */
export async function identifyMedicationFromPhoto(
  uri: string,
  conditionId?: string
): Promise<MedicationIdentifyResult> {
  return identifyMedicationFromPhotoLocal(uri, conditionId, extractMedicationText);
}
