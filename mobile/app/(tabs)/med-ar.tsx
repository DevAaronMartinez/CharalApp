import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CameraView as CameraViewType } from 'expo-camera';
import { MedicationARViewLoader } from '@/components/ar/MedicationARViewLoader';
import type { MedicationARViewHandle, MedicationScanPhase } from '@/components/ar/med-ar-types';
import { Screen } from '@/components/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import type { Medication } from '@/types';
import {
  extractMedicationText,
  identifyMedicationFromPhoto,
  isExpoGo,
} from '@/utils/medicationOcr';
import { isViroNativeAvailable } from '@/utils/viro';

const USE_VIRO_AR = isViroNativeAvailable();

type Mode = 'camera' | 'search';

export default function MedARScreen() {
  const { user, conditions, selectedConditionId } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraViewType>(null);
  const arRef = useRef<MedicationARViewHandle>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  const [mode, setMode] = useState<Mode>('camera');
  const [scanPhase, setScanPhase] = useState<MedicationScanPhase>('idle');
  const [capturing, setCapturing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(
    USE_VIRO_AR
      ? 'Apunta al envase del medicamento para activar AR'
      : 'Enfoca el nombre del medicamento en el recuadro'
  );
  const [query, setQuery] = useState('');
  const [detectedLines, setDetectedLines] = useState<string[]>([]);
  const [manualName, setManualName] = useState('');
  const [showManualPrompt, setShowManualPrompt] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [selected, setSelected] = useState<Medication | null>(null);
  const [matches, setMatches] = useState<Medication[]>([]);
  const [scanSession, setScanSession] = useState(0);
  const scanBusyRef = useRef(false);

  const userConditionId =
    selectedConditionId ?? user?.conditionIds?.[0] ?? undefined;

  useEffect(() => {
    if (capturedImageUri) return;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, capturedImageUri]);

  const applyResults = (results: Medication[], lines: string[] = []) => {
    setMatches(results);
    setDetectedLines(lines);
    setSelected(results.length === 1 ? results[0] : null);
  };

  const identifyFromText = useCallback(
    async (text: string, lines: string[] = []): Promise<Medication[]> => {
      setLoading(true);
      try {
        const data = await api.identifyMedicationFromOcr(text, userConditionId);
        const results = data.matches ?? (data.match ? [data.match] : []);
        applyResults(results, lines.length ? lines : data.detectedLines ?? []);
        if (results.length > 0) setScanPhase('success');
        setStatus(
          results.length
            ? `Encontramos ${results.length} coincidencia(s)`
            : 'No reconocimos el medicamento — prueba búsqueda manual'
        );
        return results;
      } catch (e) {
        console.error(e);
        applyResults([]);
        setStatus('Error al identificar. Intenta de nuevo.');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [userConditionId]
  );

  const searchByName = useCallback(
    async (text: string): Promise<Medication[]> => {
      const q = text.trim();
      if (q.length < 2) {
        setMatches([]);
        setSelected(null);
        return [];
      }
      setLoading(true);
      try {
        const data = await api.identifyMedication({ q, conditionId: userConditionId });
        const results = data.matches ?? (data.match ? [data.match] : []);
        applyResults(results);
        return results;
      } catch (e) {
        console.error(e);
        applyResults([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [userConditionId]
  );

  const processPhoto = useCallback(
    async (uri: string) => {
      if (scanBusyRef.current) return;

      scanBusyRef.current = true;
      setShowManualPrompt(false);

      try {
        setStatus('Leyendo texto del envase...');

        const { lines, available } = await extractMedicationText(uri);
        const localText = lines.join('\n');

        if (available && localText.trim()) {
          setDetectedLines(lines);
          const results = await identifyFromText(localText, lines);
          if (results.length > 0) return;
        }

        setLoading(true);
        setStatus('Analizando imagen con OCR local...');

        const data = await identifyMedicationFromPhoto(uri, userConditionId);
        const results = data.matches ?? (data.match ? [data.match] : []);
        const ocrLines = data.detectedLines ?? lines;

        applyResults(results, ocrLines);

        if (results.length > 0) {
          setScanPhase('success');
          setStatus(`Detectado: ${results[0].name}`);
          return;
        }

        setShowManualPrompt(true);
        setScanPhase('idle');
        setStatus(
          ocrLines.length
            ? 'Texto leído pero sin coincidencia — escribe el nombre'
            : isExpoGo()
              ? 'Apunta al nombre del envase o escríbelo abajo'
              : 'No se leyó texto — escribe el nombre del envase'
        );
      } catch (e) {
        console.error(e);
        setShowManualPrompt(true);
        setScanPhase('idle');
        setStatus('Error al analizar — escribe el nombre del medicamento');
      } finally {
        setLoading(false);
        scanBusyRef.current = false;
      }
    },
    [identifyFromText, userConditionId]
  );

  const resetScan = () => {
    setCapturedImageUri(null);
    setScanPhase('idle');
    setSelected(null);
    setMatches([]);
    setDetectedLines([]);
    setShowManualPrompt(false);
    setManualName('');
    setScanSession((n) => n + 1);
    setStatus('Apunta al envase del medicamento para activar AR');
  };

  const handleArTrackingReady = useCallback(() => {
    setStatus('Mueve el teléfono lentamente sobre el envase o la mesa');
  }, []);

  const handleArTargetLocked = useCallback((locked: boolean) => {
    if (locked) {
      setStatus('AR activo — centra el nombre del medicamento y captura');
    }
  }, []);

  const realignArFrame = useCallback(() => {
    setScanSession((n) => n + 1);
    setStatus('Apunta de nuevo al nombre en el envase');
  }, []);

  useEffect(() => {
    if (mode !== 'search') return;
    const timer = setTimeout(() => searchByName(query), 350);
    return () => clearTimeout(timer);
  }, [query, mode, searchByName]);

  const captureAndIdentify = async () => {
    if (capturing || capturedImageUri) return;
    if (!USE_VIRO_AR && !cameraRef.current) return;

    setCapturing(true);
    setScanPhase('capturing');
    setStatus('Capturando imagen...');
    setSelected(null);
    setMatches([]);
    setShowManualPrompt(false);
    setManualName('');

    try {
      let photoUri: string | null = null;

      if (USE_VIRO_AR) {
        const shot = await arRef.current?.takeScreenshot(`med-${Date.now()}`);
        if (shot?.success && shot.url) {
          photoUri = shot.url.startsWith('file://') ? shot.url : `file://${shot.url}`;
        }
      } else {
        const photo = await cameraRef.current!.takePictureAsync({
          quality: 0.8,
          skipProcessing: Platform.OS === 'android',
        });
        photoUri = photo?.uri ?? null;
      }

      if (!photoUri) {
        setStatus('No se pudo capturar la foto');
        setScanPhase('idle');
        return;
      }

      setCapturedImageUri(photoUri);
      await processPhoto(photoUri);
    } catch (e) {
      console.error(e);
      setCapturedImageUri(null);
      setScanPhase('idle');
      setShowManualPrompt(true);
      setStatus('Escribe el nombre del medicamento que ves en el envase');
    } finally {
      setCapturing(false);
    }
  };

  const identifyManualName = async () => {
    const name = manualName.trim();
    if (name.length < 2) return;
    setShowManualPrompt(false);
    setStatus('Buscando medicamento...');
    const results = await searchByName(name);
    setStatus(
      results.length > 0
        ? 'Resultados según el nombre ingresado'
        : 'Sin coincidencias — revisa la ortografía'
    );
  };

  const scanLineY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 160] });

  if (!permission) {
    return (
      <Screen style={{ backgroundColor: colors.background }}>
        <ActivityIndicator style={{ marginTop: 80 }} color={Colors.primary} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen style={{ backgroundColor: colors.background }}>
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={56} color={Colors.primary} />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            Identificar con cámara
          </Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
            Apunta al nombre del medicamento en el envase. La cámara lee el texto y lo busca en el
            catálogo.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Permitir cámara</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (USE_VIRO_AR && mode === 'camera' && !capturedImageUri) {
    return (
      <View style={styles.arFullscreen} collapsable={false}>
        <MedicationARViewLoader
          ref={arRef}
          capturedUri={null}
          scanPhase={scanPhase}
          showOverlay
          scanSession={scanSession}
          onArTrackingReady={handleArTrackingReady}
          onArTargetLocked={handleArTargetLocked}
        />

        <SafeAreaView edges={['top', 'bottom']} style={styles.arChrome} pointerEvents="box-none">
          <View style={styles.arTopBar}>
            <Text style={styles.arTitle}>Escanear medicamento</Text>
            <Pressable
              style={styles.arModeBtn}
              onPress={() => {
                setMode('search');
                resetScan();
              }}
            >
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={styles.arModeBtnText}>Buscar</Text>
            </Pressable>
          </View>

          <View style={styles.arBottomPanel}>
            <Text style={styles.arStatusText}>{status}</Text>

            {status.includes('AR activo') && (
              <Pressable style={styles.realignBtn} onPress={realignArFrame}>
                <Ionicons name="scan-outline" size={16} color="#c4b5fd" />
                <Text style={styles.realignBtnText}>Reajustar marco</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.captureBtn, (capturing || loading) && styles.captureBtnDisabled]}
              onPress={captureAndIdentify}
              disabled={capturing || loading}
            >
              {capturing || loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="camera" size={22} color="#fff" />
                  <Text style={styles.captureBtnText}>Capturar e identificar</Text>
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <Screen style={{ backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Identificar medicamento</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {USE_VIRO_AR
              ? 'Realidad aumentada + OCR para identificar el envase'
              : 'Cámara + OCR local (Tesseract en tu Mac)'}
          </Text>
          {isExpoGo() && (
            <Text style={[styles.arHint, { color: Colors.primary }]}>
              Para AR completo: compila con npx expo run:ios o run:android
            </Text>
          )}
        </View>

        <View style={[styles.modeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ModeChip label="Cámara" icon="camera" active={mode === 'camera'} onPress={() => setMode('camera')} colors={colors} />
          <ModeChip
            label="Búsqueda"
            icon="search"
            active={mode === 'search'}
            onPress={() => {
              setMode('search');
              setCapturedImageUri(null);
            }}
            colors={colors}
          />
        </View>

        {mode === 'camera' ? (
          <>
            <View style={[styles.cameraWrap, USE_VIRO_AR && styles.cameraWrapAr]}>
              {USE_VIRO_AR ? (
                <MedicationARViewLoader
                  ref={arRef}
                  capturedUri={capturedImageUri}
                  scanPhase={scanPhase}
                  showOverlay={!capturedImageUri}
                  scanSession={scanSession}
                  onArTrackingReady={handleArTrackingReady}
                  onArTargetLocked={handleArTargetLocked}
                />
              ) : capturedImageUri ? (
                <Image source={{ uri: capturedImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
              )}

              {!USE_VIRO_AR && !capturedImageUri && (
                <View style={styles.arOverlay} pointerEvents="none">
                  <View style={styles.hudBadge}>
                    <Ionicons name="scan" size={14} color="#fff" />
                    <Text style={styles.hudText}>LECTURA DE ENVASE</Text>
                  </View>
                  <CornerBracket style={styles.cornerTL} />
                  <CornerBracket style={[styles.cornerTR, styles.flipX]} />
                  <CornerBracket style={[styles.cornerBL, styles.flipY]} />
                  <CornerBracket style={[styles.cornerBR, styles.flipX, styles.flipY]} />
                  <View style={styles.scanWindow}>
                    <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
                  </View>
                  <Text style={styles.frameHint}>Coloca aquí el nombre del medicamento</Text>
                </View>
              )}
            </View>

            <Text style={[styles.statusText, { color: colors.textSecondary }]}>{status}</Text>

            {capturedImageUri && (
              <Pressable style={styles.rescanBtn} onPress={resetScan}>
                <Ionicons name="refresh" size={18} color={Colors.primary} />
                <Text style={styles.rescanBtnText}>Escanear otro medicamento</Text>
              </Pressable>
            )}

            {!capturedImageUri && (
              <Pressable
                style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
                onPress={captureAndIdentify}
                disabled={capturing || loading}
              >
                {capturing || loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="camera" size={22} color="#fff" />
                    <Text style={styles.captureBtnText}>Capturar e identificar</Text>
                  </>
                )}
              </Pressable>
            )}

            {showManualPrompt && (
              <View style={[styles.manualBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.manualTitle, { color: colors.text }]}>
                  ¿Qué nombre ves en el envase?
                </Text>
                <TextInput
                  style={[styles.manualInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Ej. Metformina, Keppra..."
                  placeholderTextColor={colors.textSecondary}
                  value={manualName}
                  onChangeText={setManualName}
                  autoCapitalize="words"
                  returnKeyType="search"
                  onSubmitEditing={identifyManualName}
                />
                <Pressable style={styles.manualBtn} onPress={identifyManualName}>
                  <Text style={styles.manualBtnText}>Buscar medicamento</Text>
                </Pressable>
              </View>
            )}

          </>
        ) : (
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Nombre del medicamento..."
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCapitalize="words"
            />
          </View>
        )}

        {matches.length > 1 && !selected && (
          <View style={styles.resultsBlock}>
            <Text style={[styles.resultsTitle, { color: colors.textSecondary }]}>
              Selecciona el medicamento correcto
            </Text>
            {matches.map((med) => (
              <Pressable
                key={med.id}
                style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelected(med)}
              >
                <Text style={[styles.resultName, { color: colors.text }]}>{med.name}</Text>
                <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>
                  {med.brandNames.slice(0, 2).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {selected && (
          <>
            {matches.length > 1 && (
              <Pressable style={styles.backLink} onPress={() => setSelected(null)}>
                <Ionicons name="arrow-back" size={16} color={Colors.primary} />
                <Text style={styles.backLinkText}>Ver todas las coincidencias</Text>
              </Pressable>
            )}
            <MedicationCard
              medication={selected}
              userConditionIds={user?.conditionIds ?? []}
              conditions={conditions}
              colors={colors}
            />
          </>
        )}

        <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
          Información educativa. Verifica siempre con tu médico y el empaque oficial.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function ModeChip({
  label,
  icon,
  active,
  onPress,
  colors,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  colors: (typeof Colors)['light'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeChip,
        {
          backgroundColor: active ? `${Colors.primary}22` : 'transparent',
          borderColor: active ? Colors.primary : colors.border,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? Colors.primary : colors.textSecondary} />
      <Text style={{ color: active ? Colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CornerBracket({ style }: { style: object }) {
  return <View style={[styles.cornerBracket, style]} />;
}

function MedicationCard({
  medication,
  userConditionIds,
  conditions,
  colors,
}: {
  medication: Medication;
  userConditionIds: string[];
  conditions: { id: string; name: string }[];
  colors: (typeof Colors)['light'];
}) {
  const relevant = medication.conditionIds.some((id) => userConditionIds.includes(id));
  const conditionNames = medication.conditionIds
    .map((id) => conditions.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  const indicationText =
    medication.clinicalUse || conditionNames || 'Consultar prospecto o indicación médica';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: Colors.primary }]}>
      <Text style={[styles.medName, { color: colors.text }]}>{medication.name}</Text>
      <Text style={[styles.medBrands, { color: colors.textSecondary }]}>
        {medication.brandNames.join(' · ')}
      </Text>

      {relevant ? (
        <View style={[styles.badge, { backgroundColor: `${Colors.success}22` }]}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>
            Relacionado con tu condición
          </Text>
        </View>
      ) : medication.clinicalUse ? (
        <View style={[styles.badge, { backgroundColor: `${Colors.primary}18` }]}>
          <Ionicons name="information-circle" size={16} color={Colors.primary} />
          <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600', flex: 1 }}>
            Uso agudo — verifica dosis en el empaque con tu médico
          </Text>
        </View>
      ) : userConditionIds.length > 0 ? (
        <View style={[styles.badge, { backgroundColor: `${Colors.warning}22` }]}>
          <Ionicons name="alert-circle" size={16} color={Colors.warning} />
          <Text style={{ color: Colors.warning, fontSize: 12, fontWeight: '600' }}>
            Verifica con tu médico
          </Text>
        </View>
      ) : null}

      <InfoRow label="Dosis usual" value={medication.dosage} colors={colors} />
      <InfoRow label="Forma" value={`${medication.form} — ${medication.shape}`} colors={colors} />
      <InfoRow label="Indicado para" value={indicationText} colors={colors} />
      <Text style={[styles.medDesc, { color: colors.textSecondary }]}>{medication.description}</Text>

      {medication.warnings.map((w) => (
        <Text key={w} style={[styles.warnItem, { color: colors.text }]}>
          ⚠ {w}
        </Text>
      ))}
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  arFullscreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  arChrome: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  arTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  arTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  arModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  arModeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  arBottomPanel: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  realignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  realignBtnText: {
    color: '#c4b5fd',
    fontWeight: '600',
    fontSize: 13,
  },
  arStatusText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  container: { flex: 1 },
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  modeRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cameraWrap: {
    height: 300,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cameraWrapAr: {
    height: 360,
    borderWidth: 1,
    borderColor: 'rgba(123, 108, 246, 0.35)',
  },
  arHint: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  arOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanWindow: {
    width: 260,
    height: 160,
    borderWidth: 1,
    borderColor: 'rgba(91, 79, 207, 0.4)',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 24,
  },
  scanLine: {
    height: 2,
    width: '100%',
    backgroundColor: Colors.secondary,
  },
  cornerBracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.secondary,
    borderWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 4,
  },
  cornerTL: { top: 48, left: 28 },
  cornerTR: { top: 48, right: 28 },
  cornerBL: { bottom: 48, left: 28 },
  cornerBR: { bottom: 48, right: 28 },
  flipX: { transform: [{ scaleX: -1 }] },
  flipY: { transform: [{ scaleY: -1 }] },
  hudBadge: {
    position: 'absolute',
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(91, 79, 207, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  hudText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  frameHint: {
    position: 'absolute',
    bottom: 16,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { textAlign: 'center', fontSize: 13, marginTop: 10, paddingHorizontal: 20 },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
  },
  rescanBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  captureBtnDisabled: { opacity: 0.7 },
  captureBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  manualBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  manualTitle: { fontSize: 14, fontWeight: '700' },
  manualInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  manualBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  manualBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16 },
  resultsBlock: { marginTop: 12, paddingHorizontal: 16, gap: 8 },
  resultsTitle: { fontSize: 12, fontWeight: '600' },
  resultItem: { padding: 14, borderRadius: 12, borderWidth: 1 },
  resultName: { fontSize: 15, fontWeight: '700' },
  resultMeta: { fontSize: 12, marginTop: 2 },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
  },
  backLinkText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 2,
    padding: 16,
  },
  medName: { fontSize: 18, fontWeight: '800' },
  medBrands: { fontSize: 12, marginTop: 2, marginBottom: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  infoRow: { marginBottom: 6 },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, marginTop: 1 },
  medDesc: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  warnItem: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    lineHeight: 16,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  permissionText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
