import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PROFILE_CATEGORY_COLORS } from '@/components/ar/profile-ar-types';
import { EvidenceEvaluator } from '@/components/health/EvidenceEvaluator';
import Colors, { categoryLabels } from '@/constants/Colors';
import type { Condition, ConditionCategory, EvidenceType } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');

const CONDITION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  water: 'water',
  body: 'body',
  people: 'people',
  medical: 'medical',
  cloudy: 'cloudy',
  heart: 'heart',
  'hand-left': 'hand-left-outline',
  'eye-off': 'eye-off-outline',
  accessibility: 'accessibility-outline',
  flash: 'flash',
  pulse: 'pulse',
  analytics: 'analytics-outline',
  thermometer: 'thermometer-outline',
  cloud: 'cloud-outline',
};

function getIcon(icon: string): keyof typeof Ionicons.glyphMap {
  return CONDITION_ICONS[icon] ?? 'medical-outline';
}

type Props = {
  userName: string;
  items: Condition[];
  onBack: () => void;
};

function HeroBackdrop({ tint }: { tint: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.glowOrb, styles.glowOrbPrimary, { backgroundColor: tint }]} />
      <View style={[styles.glowOrb, styles.glowOrbSecondary, { backgroundColor: Colors.secondary }]} />
      <View style={styles.scrim} />
    </View>
  );
}

function evidenceTypeForCondition(conditionId: string): EvidenceType | null {
  if (conditionId === 'hipertension') return 'blood_pressure';
  if (conditionId === 'diabetes') return 'blood_glucose';
  return null;
}

function shortConditionName(name: string): string {
  if (name.toLowerCase().includes('hipertensión') || name.toLowerCase().includes('hipertension')) {
    return 'Hipertensión';
  }
  return name;
}

function ConditionPage({ item }: { item: Condition }) {
  const tint = PROFILE_CATEGORY_COLORS[item.category];
  const evidenceType = evidenceTypeForCondition(item.id);

  return (
    <ScrollView
      style={{ width: SCREEN_W, flex: 1 }}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      bounces
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.heroCard, { borderColor: `${tint}55` }]}>
        <View style={[styles.categoryBadge, { backgroundColor: `${tint}22` }]}>
          <Text style={[styles.categoryBadgeText, { color: tint }]}>
            {categoryLabels[item.category]}
          </Text>
        </View>

        <View style={[styles.iconRing, { borderColor: `${tint}66`, backgroundColor: `${tint}18` }]}>
          <Ionicons name={getIcon(item.icon)} size={42} color={tint} />
        </View>

        <Text style={styles.heroTitle}>{item.name}</Text>
        <Text style={styles.heroDescription}>{item.description}</Text>
      </View>

      {evidenceType && <EvidenceEvaluator evidenceType={evidenceType} tint={tint} />}
    </ScrollView>
  );
}

export function HealthProfileExplorer({ userName, items, onBack }: Props) {
  const listRef = useRef<FlatList<Condition>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const active = items[activeIndex] ?? items[0];
  const tint = active ? PROFILE_CATEGORY_COLORS[active.category] : Colors.primary;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (index !== activeIndex && index >= 0 && index < items.length) {
      setActiveIndex(index);
    }
  };

  const jumpTo = (index: number) => {
    setActiveIndex(index);
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  const categoriesPresent = [...new Set(items.map((i) => i.category))] as ConditionCategory[];

  return (
    <View style={styles.root}>
      <HeroBackdrop tint={tint} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Mi perfil de salud
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {userName}
            </Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          {categoriesPresent.map((cat) => (
            <View key={cat} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PROFILE_CATEGORY_COLORS[cat] }]} />
              <Text style={styles.legendLabel}>{categoryLabels[cat]}</Text>
            </View>
          ))}
        </View>

        {items.length > 1 && (
          <View style={styles.segmentBar}>
            {items.map((item, index) => {
              const activeTab = index === activeIndex;
              const color = PROFILE_CATEGORY_COLORS[item.category];
              return (
                <Pressable
                  key={item.id}
                  onPress={() => jumpTo(index)}
                  style={[
                    styles.segment,
                    activeTab
                      ? { backgroundColor: color, borderColor: color }
                      : styles.segmentIdle,
                  ]}
                >
                  <Ionicons
                    name={getIcon(item.icon)}
                    size={18}
                    color={activeTab ? '#fff' : 'rgba(255,255,255,0.75)'}
                  />
                  <Text
                    style={[styles.segmentText, { color: activeTab ? '#fff' : 'rgba(255,255,255,0.9)' }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {shortConditionName(item.name)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.listWrap}>
          <FlatList
            ref={listRef}
            style={styles.list}
            data={items}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            renderItem={({ item }) => <ConditionPage item={item} />}
            getItemLayout={(_, index) => ({
              length: SCREEN_W,
              offset: SCREEN_W * index,
              index,
            })}
          />
        </View>

        {items.length > 2 && (
          <View style={styles.dots}>
            {items.map((item, index) => (
              <Pressable key={item.id} onPress={() => jumpTo(index)} hitSlop={8}>
                <View
                  style={[
                    styles.dot,
                    index === activeIndex && { backgroundColor: tint, width: 18 },
                  ]}
                />
              </Pressable>
            ))}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  safe: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.35,
  },
  glowOrbPrimary: {
    width: 280,
    height: 280,
    top: -40,
    right: -60,
  },
  glowOrbSecondary: {
    width: 220,
    height: 220,
    bottom: 120,
    left: -80,
    opacity: 0.2,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 15, 26, 0.55)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
    zIndex: 2,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  segmentBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 12,
    flexShrink: 0,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    maxHeight: 56,
  },
  segmentIdle: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});
