import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, conditions, logout, updateProfile } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [bio, setBio] = useState(user?.bio ?? '');
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    user?.conditionIds ?? []
  );
  const [saving, setSaving] = useState(false);

  const toggleCondition = (id: string) => {
    setSelectedConditions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const updateLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu ubicación.');
      return;
    }
    const location = await Location.getCurrentPositionAsync({});
    let city = user?.city ?? 'Mi ciudad';
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      city = place?.city ?? place?.subregion ?? city;
    } catch {
      // Sin red: guardamos coordenadas y dejamos la ciudad anterior.
    }
    await updateProfile({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      city,
    });
    Alert.alert('Ubicación guardada', 'Quedó en este celular (sin enviar a un servidor).');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        bio,
        conditionIds: selectedConditions,
      });
      Alert.alert('Perfil actualizado', 'Tus cambios quedaron guardados en este celular.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Screen style={{ backgroundColor: colors.background }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Sobre mí</Text>
        <TextInput
          style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          value={bio}
          onChangeText={setBio}
          placeholder="Cuéntanos tu experiencia..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>Mis condiciones</Text>
        {(user.conditionIds?.length ?? 0) > 0 && (
          <Pressable style={styles.arProfileBtn} onPress={() => router.push('/profile-ar')}>
            <Ionicons name="analytics-outline" size={22} color="#fff" />
            <View style={styles.arProfileBtnText}>
              <Text style={styles.arProfileTitle}>Evaluar mi evidencia de salud</Text>
              <Text style={styles.arProfileHint}>
                Presión arterial, glucosa o laboratorio con retroalimentación
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
          </Pressable>
        )}
        <View style={styles.conditionGrid}>
          {conditions.map((c) => {
            const active = selectedConditions.includes(c.id);
            return (
              <Pressable
                key={c.id}
                style={[
                  styles.conditionItem,
                  {
                    backgroundColor: active ? Colors.primary : colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => toggleCondition(c.id)}
              >
                <Text
                  style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}
                  numberOfLines={2}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable style={styles.locationBtn} onPress={updateLocation}>
        <Ionicons name="location" size={18} color={Colors.secondary} />
        <Text style={styles.locationText}>Guardar mi ubicación en el celular</Text>
      </Pressable>

      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar en este celular'}</Text>
      </Pressable>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="refresh-outline" size={18} color={Colors.accent} />
        <Text style={styles.logoutText}>Restablecer perfil demo</Text>
      </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  rowText: { flex: 1, minWidth: 0, paddingRight: 12 },
  card: {
    alignItems: 'center',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', marginTop: 12 },
  email: { fontSize: 14, marginTop: 4 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  arProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  arProfileBtnText: { flex: 1 },
  arProfileTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  arProfileHint: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  conditionItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: '100%',
    flexBasis: '48%',
    flexGrow: 1,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: `${Colors.secondary}18`,
  },
  locationText: { color: Colors.secondary, fontWeight: '700', fontSize: 14 },
  saveBtn: {
    marginHorizontal: 16,
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    marginTop: 8,
    marginBottom: 32,
    padding: 14,
  },
  logoutText: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
});
