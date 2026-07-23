import { EvidenceEvaluatorCore } from '@/components/health/EvidenceEvaluatorCore';
import { useHealthVlmOptional } from '@/hooks/useHealthDeviceVlm';
import type { EvidenceType } from '@/types';

type Props = {
  evidenceType: EvidenceType;
  tint: string;
};

/** Solo montar bajo HealthVlmProvider (development build). */
export function EvidenceEvaluatorWithVlm({ evidenceType, tint }: Props) {
  const vlm = useHealthVlmOptional();
  return <EvidenceEvaluatorCore evidenceType={evidenceType} tint={tint} vlm={vlm} />;
}
