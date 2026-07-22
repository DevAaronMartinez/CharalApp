import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { api } from '@/services/api';
import type {
  BloodPressureContext,
  EvidenceEvaluationResult,
  EvidenceType,
  GlucoseContext,
} from '@/types';

type Props = {
  evidenceType: EvidenceType;
  tint: string;
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

export function EvidenceEvaluator({ evidenceType, tint }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvidenceEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    evidenceType === 'blood_pressure'
      ? 'Ingresa sistólica, diastólica y pulso. Indica si mediste en reposo o en otro momento.'
      : 'Ingresa el valor que muestra tu glucómetro o resultado de laboratorio.';

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al evaluar');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setBpContext('resting');
    setGlucoseValue('');
  };

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

      {evidenceType === 'blood_pressure' ? (
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
      )}

      <View style={styles.actionRow}>
        {result ? (
          <Pressable style={styles.secondaryBtn} onPress={reset}>
            <Text style={styles.secondaryBtnText}>Nueva lectura</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.evaluateBtn, { backgroundColor: tint }, loading && styles.disabled]}
          onPress={evaluate}
          disabled={loading}
        >
          {loading ? (
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
