import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommunityFeed } from '@/components/community/CommunityFeed';
import { RecommendationsFeed } from '@/components/community/RecommendationsFeed';
import { ConditionPicker } from '@/components/ConditionPicker';
import { Screen } from '@/components/Screen';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';

type HubSection = 'community' | 'recommendations';

export default function HubScreen() {
  const { conditions, selectedConditionId, setSelectedConditionId } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [section, setSection] = useState<HubSection>('community');

  const conditionMap = Object.fromEntries(conditions.map((c) => [c.id, c.name]));
  const recommendationsConditionId =
    selectedConditionId ?? conditions[0]?.id ?? null;

  const sectionHint =
    section === 'community'
      ? 'Publicaciones de la comunidad según tu condición'
      : 'Consejos personalizados según tu condición';

  return (
    <Screen style={{ backgroundColor: colors.background }}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>+VIDA</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{sectionHint}</Text>
        </View>

        <View style={styles.sectionRow}>
          <Pressable
            style={[styles.sectionBtn, section === 'community' && styles.sectionBtnActive]}
            onPress={() => setSection('community')}
          >
            <Ionicons
              name="people"
              size={16}
              color={section === 'community' ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.sectionBtnText,
                { color: section === 'community' ? '#fff' : colors.textSecondary },
              ]}
            >
              Comunidad
            </Text>
          </Pressable>
          <Pressable
            style={[styles.sectionBtn, section === 'recommendations' && styles.sectionBtnActive]}
            onPress={() => setSection('recommendations')}
          >
            <Ionicons
              name="bulb"
              size={16}
              color={section === 'recommendations' ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.sectionBtnText,
                { color: section === 'recommendations' ? '#fff' : colors.textSecondary },
              ]}
            >
              Recomendaciones
            </Text>
          </Pressable>
        </View>

        <ConditionPicker
          conditions={conditions}
          selectedId={section === 'community' ? selectedConditionId : recommendationsConditionId}
          onSelect={setSelectedConditionId}
          showAll={section === 'community'}
        />

        {section === 'community' ? (
          <CommunityFeed
            selectedConditionId={selectedConditionId}
            conditionMap={conditionMap}
          />
        ) : (
          <RecommendationsFeed activeConditionId={recommendationsConditionId} />
        )}

        {section === 'community' && (
          <View style={[styles.fabWrap, { bottom: 12 }]} pointerEvents="box-none">
            <View style={styles.fabGlow} />
            <View style={styles.fabRing} />
            <Link href="/create-post" asChild>
              <Pressable
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                accessibilityRole="button"
                accessibilityLabel="Publicar consejo"
              >
                <Ionicons name="document-text" size={26} color="#fff" />
                <View style={styles.fabBadge}>
                  <Ionicons name="add" size={14} color={Colors.primary} />
                </View>
              </Pressable>
            </Link>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  sectionRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#E5E7EB22',
    gap: 4,
  },
  sectionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  sectionBtnActive: {
    backgroundColor: Colors.primary,
  },
  sectionBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  fabWrap: {
    position: 'absolute',
    right: 18,
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  fabGlow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primary,
    opacity: 0.4,
    transform: [{ scale: 1.18 }],
  },
  fabRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 14,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.94 }],
  },
  fabBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
});
