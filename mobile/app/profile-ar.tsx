import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HealthProfileExplorer } from '@/components/health/HealthProfileExplorer';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { useSafeBack } from '@/utils/navigation';

export default function ProfileHealthScreen() {
  const goBack = useSafeBack('/(tabs)/profile');
  const { user, conditions } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const userConditions = useMemo(
    () => conditions.filter((c) => user?.conditionIds?.includes(c.id)),
    [conditions, user?.conditionIds]
  );

  if (!user) return null;

  if (userConditions.length === 0) {
    return (
      <SafeAreaView style={[styles.emptyWrap, { backgroundColor: colors.background }]}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.emptyBody}>
          <Ionicons name="heart-outline" size={56} color={Colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Aún no tienes condiciones
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Selecciona tus padecimientos en Perfil para ver tu resumen personalizado aquí.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={goBack}>
            <Text style={styles.primaryBtnText}>Configurar perfil</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <HealthProfileExplorer
      userName={user.name}
      items={userConditions}
      onBack={goBack}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1 },
  backBtn: { padding: 16 },
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
