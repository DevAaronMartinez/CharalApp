import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CameraView as CameraViewType } from 'expo-camera';

import Colors from '@/constants/Colors';
import type { HealthDeviceVlmController } from '@/hooks/useHealthDeviceVlm';
import { api } from '@/services/api';
import type {
  BloodPressureContext,
  EvidenceEvaluationResult,
  EvidenceType,
  GlucoseContext,
} from '@/types';
import {
  applySuggestions,
  isConfidentBloodPressure,
  isConfidentGlucose,
  suggestFromOcrLines,
  type EvidenceSuggestions,
} from '@/utils/evidenceDetect';
import { isExpoGo } from '@/utils/executorch';
import { extractMedicationText, readImageAsBase64 } from '@/utils/medicationOcr';

type InputMode = 'photo' | 'manual';

type Props = {
  evidenceType: EvidenceType;
  tint: string;
  /** Presente solo en development builds con ExecuTorch. */
  vlm?: HealthDeviceVlmController | null;
};

const SEVERITY_COLORS: Record<string, string> = {
  success: Colors.success,
  warning: Colors.warning,
  danger: '#EF4444',
  critical: '#DC2626',
};

const GLUCOSE_CONTEXTS: { id: GlucoseContext; label: string }[] = [
  { id: 'fasting', label: 'En ayunas' },
  { id: 'postprandial', label: '2 h después de comer' },
  { id: 'hba1c', label: 'HbA1c (%)' },
  { id: 'unknown', label: 'No estoy seguro' },
];

const BP_CONTEXTS: { id: BloodPressureContext; label: string }[] = [
  { id: 'resting', label: 'En reposo' },
  { id: 'post_activity', label: 'Tras actividad' },
  { id: 'stress', label: 'Con estrés / dolor' },
  { id: 'unknown', label: 'No estoy seguro' },
];

export function EvidenceEvaluatorCore({ evidenceType, tint, vlm = null }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraViewType>(null);

  const [inputMode, setInputMode] = useState<InputMode>('photo');
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<EvidenceEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [detectionSource, setDetectionSource] = useState<'vlm' | 'ocr' | 'on_device' | null>(
    null
  );

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [bpContext, setBpContext] = useState<BloodPressureContext>('resting');
  const [glucoseValue, setGlucoseValue] = useState('');
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext>('fasting');

  const title =
    evidenceType === 'blood_pressure'
      ? 'Registrar presión arterial'
      : 'Registrar glucosa';

  const hint =
    inputMode === 'photo'
      ? evidenceType === 'blood_pressure'
        ? 'Fotografía la pantalla de tu baumanómetro. Revisamos los números y tú confirmas.'
        : 'Fotografía la pantalla de tu glucómetro o el resultado de laboratorio.'
      : evidenceType === 'blood_pressure'
        ? 'Ingresa sistólica, diastólica y pulso. Indica si mediste en reposo o en otro momento.'
        : 'Ingresa el valor que muestra tu glucómetro o resultado de laboratorio.';

  const applyDetected = useCallback(
    (
      suggestions: EvidenceSuggestions,
      source: 'vlm' | 'ocr' | 'on_device',
      confidence?: number
    ) => {
      applySuggestions(suggestions, {
        setSystolic,
        setDiastolic,
        setPulse,
        setGlucoseValue,
      });
      setDetectionSource(source);

      const confident =
        evidenceType === 'blood_pressure'
          ? isConfidentBloodPressure(suggestions)
          : isConfidentGlucose(suggestions);

      if (confident) {
        const confLabel =
          confidence != null ? ` (confianza ${(confidence * 100).toFixed(0)}%)` : '';
        const sourceLabel =
          source === 'on_device'
            ? 'Lectura detectada on-device (OCR)'
            : source === 'vlm'
              ? 'Lectura detectada con VLM'
              : 'Lectura detectada con OCR';
        setStatus(`${sourceLabel}${confLabel}. Confirma y evalúa.`);
      } else {
        setStatus('Detectamos algo, pero confirma o corrige los valores.');
      }
    },
    [evidenceType]
  );

  const detectFromPhoto = useCallback(
    async (uri: string) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setDetectionSource(null);

      try {
        if (vlm?.isReady) {
          setStatus('Leyendo pantalla on-device (OCR)…');
          try {
            const reading = await vlm.readDevice(uri, evidenceType);
            if (reading && (reading.systolic || reading.glucoseValue)) {
              if (reading.glucoseContext) {
                setGlucoseContext(reading.glucoseContext);
              }
              const source =
                reading.engine === 'vlm'
                  ? 'vlm'
                  : reading.engine === 'ocr'
                    ? 'on_device'
                    : 'on_device';
              applyDetected(reading, source, reading.confidence);
              return;
            }
            const preview = reading?.raw?.slice(0, 80);
            setStatus(
              preview
                ? `On-device no parseó números (${preview}…) — probando servidor…`
                : 'On-device no pudo leer con claridad — probando servidor…'
            );
          } catch (vlmErr) {
            console.warn('[device-read] lectura falló:', vlmErr);
            setStatus('Lectura on-device falló — probando servidor…');
          }
        } else if (vlm && !vlm.isReady) {
          setStatus(
            `Preparando OCR on-device… ${Math.round((vlm.downloadProgress || 0) * 100)}% — usando servidor`
          );
        } else {
          setStatus(
            isExpoGo()
              ? 'Analizando con OCR del servidor…'
              : 'Analizando imagen…'
          );
        }

        // OCR on-device (development build) antes del backend.
        try {
          const local = await extractMedicationText(uri);
          if (local.available && local.lines.length) {
            const localSuggestions = suggestFromOcrLines(local.lines, evidenceType);
            const ok =
              evidenceType === 'blood_pressure'
                ? isConfidentBloodPressure(localSuggestions)
                : isConfidentGlucose(localSuggestions);
            if (ok) {
              applyDetected(localSuggestions, 'ocr');
              return;
            }
          }
        } catch (ocrLocalErr) {
          console.warn('[ocr-local]', ocrLocalErr);
        }

        const imageBase64 = await readImageAsBase64(uri);
        const detected = await api.detectHealthEvidence({
          type: evidenceType,
          imageBase64,
        });

        if (detected.found && detected.suggestions) {
          const suggestions: EvidenceSuggestions = {
            systolic: detected.suggestions.systolic
              ? String(detected.suggestions.systolic)
              : undefined,
            diastolic: detected.suggestions.diastolic
              ? String(detected.suggestions.diastolic)
              : undefined,
            pulse: detected.suggestions.pulse
              ? String(detected.suggestions.pulse)
              : undefined,
            glucoseValue: detected.suggestions.value
              ? String(detected.suggestions.value)
              : undefined,
          };
          if (detected.suggestions.context) {
            setGlucoseContext(detected.suggestions.context);
          }
          applyDetected(suggestions, 'ocr');
          return;
        }

        setStatus('No se leyeron números claros — completa o corrige a mano.');
        setInputMode('manual');
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'Error al analizar la foto');
        setStatus('Falló la lectura — puedes ingresar los valores manualmente.');
        setInputMode('manual');
      } finally {
        setLoading(false);
      }
    },
    [applyDetected, evidenceType, vlm]
  );

  const capturePhoto = async () => {
    if (capturing || loading || !cameraRef.current) return;
    setCapturing(true);
    setError(null);
    setResult(null);
    setStatus('Capturando…');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        skipProcessing: Platform.OS === 'android',
      });
      const uri = photo?.uri ?? null;
      if (!uri) {
        setError('No se pudo capturar la foto');
        return;
      }
      setCapturedUri(uri);
      await detectFromPhoto(uri);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error al capturar');
    } finally {
      setCapturing(false);
    }
  };

  const evaluate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let payload: Parameters<typeof api.evaluateHealthEvidence>[0];

      if (evidenceType === 'blood_pressure') {
        const sys = Number(systolic);
        const dia = Number(diastolic);
        if (!sys || !dia) {
          setError('Ingresa sistólica y diastólica (ej. 120 y 80).');
          return;
        }
        payload = {
          type: 'blood_pressure',
          manual: {
            systolic: sys,
            diastolic: dia,
            pulse: pulse ? Number(pulse) : undefined,
            context: bpContext,
          },
        };
      } else {
        const val = Number(glucoseValue.replace(',', '.'));
        if (!val) {
          setError('Ingresa un valor de glucosa o HbA1c.');
          return;
        }
        payload = {
          type: 'blood_glucose',
          manual: {
            value: val,
            unit: glucoseContext === 'hba1c' ? '%' : 'mg/dL',
            context: glucoseContext,
          },
        };
      }

      const data = await api.evaluateHealthEvidence(payload);
      if ('error' in data && data.error) {
        setError(data.error);
        return;
      }
      setResult(data as EvidenceEvaluationResult);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al evaluar');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setStatus(null);
    setCapturedUri(null);
    setDetectionSource(null);
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setBpContext('resting');
    setGlucoseValue('');
    setGlucoseContext('fasting');
    if (vlm?.isGenerating) vlm.interrupt();
  };

  const retake = () => {
    setCapturedUri(null);
    setDetectionSource(null);
    setStatus(
      vlm
        ? vlm.isReady
          ? 'Enfoca la pantalla del monitor y captura'
          : `Preparando OCR on-device… ${Math.round((vlm.downloadProgress || 0) * 100)}%`
        : 'Enfoca la pantalla del monitor y captura'
    );
    setError(null);
    setResult(null);
  };

  const showCamera = inputMode === 'photo' && !capturedUri;
  const busy = loading || capturing || Boolean(vlm?.isGenerating);

  return (
    <View style={[styles.wrap, { borderColor: `${tint}44` }]}>
      <View style={styles.titleRow}>
        <Ionicons
          name={evidenceType === 'blood_pressure' ? 'pulse' : 'water'}
          size={20}
          color={tint}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.hint}>{hint}</Text>

      <View style={styles.modeRow}>
        {(['photo', 'manual'] as InputMode[]).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setInputMode(mode)}
            style={[
              styles.modeChip,
              inputMode === mode && { backgroundColor: tint, borderColor: tint },
            ]}
          >
            <Ionicons
              name={mode === 'photo' ? 'camera' : 'create-outline'}
              size={14}
              color={inputMode === mode ? '#fff' : 'rgba(255,255,255,0.7)'}
            />
            <Text
              style={[
                styles.modeChipText,
                inputMode === mode && { color: '#fff' },
              ]}
            >
              {mode === 'photo' ? 'Foto del monitor' : 'Manual'}
            </Text>
          </Pressable>
        ))}
      </View>

      {vlm && inputMode === 'photo' ? (
        <Text style={styles.engineHint}>
          {vlm.error
            ? `Motor on-device: ${vlm.error}`
            : vlm.engineLabel}
        </Text>
      ) : null}

      {inputMode === 'photo' && showCamera ? (
        <View style={styles.cameraBox}>
          {!permission ? (
            <ActivityIndicator color={tint} />
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>
                Necesitamos la cámara para leer tu monitor.
              </Text>
              <Pressable
                style={[styles.permissionBtn, { backgroundColor: tint }]}
                onPress={requestPermission}
              >
                <Text style={styles.permissionBtnText}>Permitir cámara</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
              <View style={[styles.cameraFrame, { borderColor: tint }]} />
              <Pressable
                style={[styles.shutter, { backgroundColor: tint }, busy && styles.disabled]}
                onPress={capturePhoto}
                disabled={busy}
              >
                {capturing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={styles.shutterText}>Capturar lectura</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {inputMode === 'photo' && capturedUri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: capturedUri }} style={styles.preview} />
          <Pressable style={styles.retakeBtn} onPress={retake} disabled={busy}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retakeText}>Otra foto</Text>
          </Pressable>
        </View>
      ) : null}

      {status ? <Text style={styles.statusText}>{status}</Text> : null}

      {detectionSource ? (
        <View style={[styles.sourceBadge, { borderColor: `${tint}66` }]}>
          <Ionicons
            name={
              detectionSource === 'ocr' ? 'cloud-outline' : 'phone-portrait-outline'
            }
            size={14}
            color={tint}
          />
          <Text style={[styles.sourceBadgeText, { color: tint }]}>
            {detectionSource === 'ocr'
              ? 'Detectado con OCR servidor'
              : detectionSource === 'vlm'
                ? 'Detectado con VLM on-device'
                : 'Detectado con OCR on-device'}
          </Text>
        </View>
      ) : null}

      {(inputMode === 'manual' || capturedUri || detectionSource) && (
        evidenceType === 'blood_pressure' ? (
          <View style={styles.manualGrid}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Sistólica (SYS)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="120"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={systolic}
                onChangeText={setSystolic}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Diastólica (DIA)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="80"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={diastolic}
                onChangeText={setDiastolic}
              />
            </View>
            <View style={[styles.field, styles.fieldWide]}>
              <Text style={styles.fieldLabel}>Pulso (opcional)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="72"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={pulse}
                onChangeText={setPulse}
              />
            </View>
            <View style={[styles.field, styles.fieldWide]}>
              <Text style={styles.fieldLabel}>Momento de la medición</Text>
              <View style={styles.contextRow}>
                {BP_CONTEXTS.map((ctx) => (
                  <Pressable
                    key={ctx.id}
                    onPress={() => setBpContext(ctx.id)}
                    style={[
                      styles.contextChip,
                      bpContext === ctx.id && { backgroundColor: tint, borderColor: tint },
                    ]}
                  >
                    <Text
                      style={[
                        styles.contextChipText,
                        bpContext === ctx.id && { color: '#fff' },
                      ]}
                    >
                      {ctx.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.manualGrid}>
            <View style={[styles.field, styles.fieldWide]}>
              <Text style={styles.fieldLabel}>
                {glucoseContext === 'hba1c' ? 'HbA1c (%)' : 'Glucosa (mg/dL)'}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder={glucoseContext === 'hba1c' ? '6.5' : '110'}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={glucoseValue}
                onChangeText={setGlucoseValue}
              />
            </View>
            <View style={[styles.field, styles.fieldWide]}>
              <Text style={styles.fieldLabel}>Tipo de medición</Text>
              <View style={styles.contextRow}>
                {GLUCOSE_CONTEXTS.map((ctx) => (
                  <Pressable
                    key={ctx.id}
                    onPress={() => setGlucoseContext(ctx.id)}
                    style={[
                      styles.contextChip,
                      glucoseContext === ctx.id && { backgroundColor: tint, borderColor: tint },
                    ]}
                  >
                    <Text
                      style={[
                        styles.contextChipText,
                        glucoseContext === ctx.id && { color: '#fff' },
                      ]}
                    >
                      {ctx.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )
      )}

      <View style={styles.actionRow}>
        {result ? (
          <Pressable style={styles.secondaryBtn} onPress={reset}>
            <Text style={styles.secondaryBtnText}>Nueva lectura</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.evaluateBtn, { backgroundColor: tint }, busy && styles.disabled]}
          onPress={evaluate}
          disabled={busy}
        >
          {loading && !capturing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={evidenceType === 'blood_pressure' ? 'pulse' : 'water'}
                size={18}
                color="#fff"
              />
              <Text style={styles.evaluateBtnText}>Evaluar y recibir retroalimentación</Text>
            </>
          )}
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={Colors.warning} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {result && (
        <View
          style={[
            styles.resultCard,
            { borderColor: SEVERITY_COLORS[result.severity] ?? tint },
          ]}
        >
          <View
            style={[
              styles.resultBadge,
              { backgroundColor: `${SEVERITY_COLORS[result.severity] ?? tint}22` },
            ]}
          >
            <Text
              style={[styles.resultBadgeText, { color: SEVERITY_COLORS[result.severity] ?? tint }]}
            >
              {result.label}
            </Text>
          </View>
          <Text style={styles.resultReading}>{result.reading}</Text>
          {result.feedback.map((tip, i) => (
            <View key={i} style={styles.feedbackRow}>
              <Ionicons name="chatbubble-ellipses" size={16} color={tint} />
              <Text style={styles.feedbackText}>{tip}</Text>
            </View>
          ))}
          <Text style={styles.disclaimer}>{result.disclaimer}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  hint: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modeChipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
  engineHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 15,
  },
  cameraBox: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0B1220',
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFrame: {
    position: 'absolute',
    top: 28,
    left: 36,
    right: 36,
    bottom: 72,
    borderWidth: 2,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  shutter: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  shutterText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  permissionBox: {
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  permissionText: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    fontSize: 13,
  },
  permissionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  retakeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 17,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 10,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  manualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  field: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  fieldWide: {
    flexBasis: '100%',
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  contextChipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    gap: 8,
  },
  evaluateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  evaluateBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    fontSize: 13,
  },
  disabled: {
    opacity: 0.65,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  errorText: {
    flex: 1,
    color: '#FCD34D',
    fontSize: 13,
    lineHeight: 18,
  },
  resultCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  resultBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  resultReading: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  feedbackText: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 19,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});
