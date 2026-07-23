import type { ComponentType } from 'react';

import { EvidenceEvaluatorCore } from '@/components/health/EvidenceEvaluatorCore';
import type { EvidenceType } from '@/types';
import { canUseOnDeviceVlm } from '@/utils/executorch';

type Props = {
  evidenceType: EvidenceType;
  tint: string;
};

/**
 * Entrada pública: VLM compartido (si hay provider) o OCR/manual.
 */
export function EvidenceEvaluator({ evidenceType, tint }: Props) {
  if (canUseOnDeviceVlm()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { EvidenceEvaluatorWithVlm } = require('./EvidenceEvaluatorWithVlm') as {
        EvidenceEvaluatorWithVlm: ComponentType<Props>;
      };
      return <EvidenceEvaluatorWithVlm evidenceType={evidenceType} tint={tint} />;
    } catch (err) {
      console.warn('[vlm] fallback a OCR/manual:', err);
    }
  }

  return <EvidenceEvaluatorCore evidenceType={evidenceType} tint={tint} vlm={null} />;
}
