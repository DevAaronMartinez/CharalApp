import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ConditionBadge } from '@/components/ConditionPicker';
import { RecommendationCard } from '@/components/RecommendationCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api } from '@/services/api';
import type { Condition, Recommendation } from '@/types';

type Props = {
  activeConditionId: string | null;
};

export function RecommendationsFeed({ activeConditionId }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const requestRef = useRef(0);
  const tabBarHeight = useBottomTabBarHeight();

  const [condition, setCondition] = useState<Condition | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!activeConditionId) {
      setCondition(null);
      setRecommendations([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    setLoading(true);

    api
      .getRecommendations(activeConditionId)
      .then((data) => {
        if (requestId !== requestRef.current) return;
        setCondition(data.condition);
        setRecommendations(data.recommendations);
      })
      .catch((error) => {
        console.error(error);
        if (requestId !== requestRef.current) return;
        setCondition(null);
        setRecommendations([]);
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      });
  }, [activeConditionId]);

  const onRefresh = async () => {
    if (!activeConditionId) return;
    setRefreshing(true);
    try {
      const data = await api.getRecommendations(activeConditionId);
      setCondition(data.condition);
      setRecommendations(data.recommendations);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!activeConditionId) {
    return (
      <Text style={[styles.empty, { color: colors.textSecondary }]}>
        Selecciona una condición para ver recomendaciones personalizadas.
      </Text>
    );
  }

  const listHeader = condition ? (
    <View
      style={[styles.conditionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Text style={[styles.conditionName, { color: colors.text }]}>{condition.name}</Text>
      <ConditionBadge condition={condition} />
      <Text style={[styles.conditionDesc, { color: colors.textSecondary }]}>
        {condition.description}
      </Text>
    </View>
  ) : null;

  return (
    <View style={styles.listWrapper}>
      <FlatList
        style={styles.list}
        data={recommendations}
        keyExtractor={(item) => item.id}
        extraData={`${activeConditionId}-${recommendations.length}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={listHeader}
        renderItem={({ item, index }) => <RecommendationCard item={item} index={index} />}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android' ? false : undefined}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              Pronto habrá más consejos para esta condición.
            </Text>
          ) : null
        }
      />

      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: `${colors.background}CC` }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Cargando recomendaciones...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listWrapper: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  conditionCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  conditionName: {
    fontSize: 18,
    fontWeight: '800',
  },
  conditionDesc: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 19,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
    fontSize: 14,
  },
});
