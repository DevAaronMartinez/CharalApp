import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { models, useLLM, useOCR } from 'react-native-executorch';

import type { EvidenceType } from '@/types';
import { toLocalImagePath } from '@/utils/executorch';
import {
  HEALTH_VLM_SYSTEM_PROMPT,
  healthVlmUserPrompt,
  isTemplateEcho,
  parseHealthVlmResponse,
  parseReadingFromOcrBoxes,
  type VlmHealthReading,
} from '@/utils/healthDeviceVlm';

/** OCR latin/español — adecuado para dígitos de LCD. */
const OCR_MODEL = models.ocr.craft({ language: 'es' });
/** VLM solo como respaldo (en LCDs suele copiar el prompt). */
const VLM_MODEL = models.llm.lfm2_5_vl_1_6b();

export type HealthDeviceVlmController = {
  isReady: boolean;
  isGenerating: boolean;
  downloadProgress: number;
  error: string | null;
  engineLabel: string;
  readDevice: (
    imageUri: string,
    evidenceType: EvidenceType
  ) => Promise<VlmHealthReading | null>;
  interrupt: () => void;
};

const HealthVlmContext = createContext<HealthDeviceVlmController | null>(null);

export function useHealthVlmOptional(): HealthDeviceVlmController | null {
  return useContext(HealthVlmContext);
}

function pickResponseText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const last = [...value].reverse().find(
      (m) => m && typeof m === 'object' && (m as { role?: string }).role === 'assistant'
    ) as { content?: string } | undefined;
    if (last?.content) return String(last.content).trim();
  }
  return fallback.trim();
}

/**
 * Provider único: OCR on-device primero, VLM como fallback.
 */
export function HealthVlmProvider({ children }: { children: ReactNode }) {
  const ocr = useOCR({ model: OCR_MODEL });
  const llm = useLLM({
    model: VLM_MODEL,
    // No cargar VLM hasta que haga falta / OCR listo — reduce pelea de descargas.
    preventLoad: !ocr.isReady,
  });
  const configuredRef = useRef(false);

  useEffect(() => {
    if (!llm.isReady || configuredRef.current) return;
    configuredRef.current = true;
    llm.configure({
      chatConfig: {
        systemPrompt: HEALTH_VLM_SYSTEM_PROMPT,
      },
      generationConfig: {
        temperature: 0.0,
        topP: 0.8,
        minP: 0.05,
        repetitionPenalty: 1.1,
        outputTokenBatchSize: 12,
        batchTimeInterval: 80,
      },
    });
  }, [llm.isReady, llm.configure]);

  const readDevice = useCallback(
    async (
      imageUri: string,
      evidenceType: EvidenceType
    ): Promise<VlmHealthReading | null> => {
      const mediaPath = toLocalImagePath(imageUri);
      console.log('[device-read] imagePath:', mediaPath);

      // 1) OCR on-device (principal para monitores LCD).
      if (ocr.isReady) {
        try {
          const detections = await ocr.forward(mediaPath);
          console.log(
            '[device-read] ocr boxes:',
            detections?.map((d) => `${d.text}@(${Math.round(d.bbox.y1)})`).join(' | ')
          );
          const fromOcr = parseReadingFromOcrBoxes(
            (detections ?? []).map((d) => ({
              text: d.text,
              score: d.score,
              y1: d.bbox.y1,
              x1: d.bbox.x1,
              y2: d.bbox.y2,
            })),
            evidenceType
          );
          if (fromOcr) return fromOcr;
        } catch (err) {
          console.warn('[device-read] OCR falló:', err);
        }
      }

      // 2) VLM fallback
      if (!llm.isReady) {
        console.warn('[device-read] VLM aún no listo');
        return null;
      }
      if (llm.isGenerating) {
        llm.interrupt();
        await new Promise((r) => setTimeout(r, 200));
      }

      const userPrompt = healthVlmUserPrompt(evidenceType);
      let text = '';
      try {
        const sent = await llm.sendMessage(userPrompt, { imagePath: mediaPath });
        text = pickResponseText(sent, llm.response);
        console.log('[device-read] vlm raw:', text.slice(0, 400));
      } catch (err) {
        console.warn('[device-read] vlm sendMessage falló:', err);
      }

      if (!text || isTemplateEcho(text) || !parseHealthVlmResponse(text, evidenceType)) {
        try {
          const generated = await llm.generate([
            { role: 'system', content: HEALTH_VLM_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt, mediaPath },
          ]);
          text = pickResponseText(generated, llm.response) || text;
          console.log('[device-read] vlm generate raw:', text.slice(0, 400));
        } catch (err) {
          console.warn('[device-read] vlm generate falló:', err);
        }
      }

      if (isTemplateEcho(text)) return null;
      return parseHealthVlmResponse(text, evidenceType);
    },
    [ocr, llm]
  );

  const downloadProgress = ocr.isReady
    ? llm.isReady
      ? 1
      : 0.7 + (llm.downloadProgress ?? 0) * 0.3
    : (ocr.downloadProgress ?? 0) * 0.7;

  const engineLabel = ocr.isReady
    ? llm.isReady
      ? 'OCR + VLM on-device listos — la foto no sale del teléfono'
      : `OCR listo · descargando VLM respaldo… ${Math.round((llm.downloadProgress || 0) * 100)}%`
    : `Descargando OCR on-device… ${Math.round((ocr.downloadProgress || 0) * 100)}%`;

  const value = useMemo<HealthDeviceVlmController>(
    () => ({
      isReady: ocr.isReady,
      isGenerating: ocr.isGenerating || llm.isGenerating,
      downloadProgress,
      error: ocr.error
        ? String(ocr.error)
        : llm.error
          ? String(llm.error)
          : null,
      engineLabel,
      readDevice,
      interrupt: () => {
        if (llm.isGenerating) llm.interrupt();
      },
    }),
    [
      ocr.isReady,
      ocr.isGenerating,
      ocr.error,
      llm.isGenerating,
      llm.error,
      llm.interrupt,
      downloadProgress,
      engineLabel,
      readDevice,
    ]
  );

  return (
    <HealthVlmContext.Provider value={value}>{children}</HealthVlmContext.Provider>
  );
}

/** @deprecated Prefer HealthVlmProvider + useHealthVlmOptional */
export function useHealthDeviceVlm(_evidenceType: EvidenceType): HealthDeviceVlmController {
  const shared = useHealthVlmOptional();
  if (!shared) {
    throw new Error('useHealthDeviceVlm requiere HealthVlmProvider');
  }
  return shared;
}
