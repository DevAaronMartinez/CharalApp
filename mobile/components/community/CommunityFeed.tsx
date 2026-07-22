import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PostCard } from '@/components/PostCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { api } from '@/services/api';

type Props = {
  selectedConditionId: string | null;
  conditionMap: Record<string, string>;
};

export function CommunityFeed({ selectedConditionId, conditionMap }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [posts, setPosts] = useState<Awaited<ReturnType<typeof api.getPosts>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const postsData = await api.getPosts(selectedConditionId ?? undefined);
    setPosts(postsData);
  }, [selectedConditionId]);

  useEffect(() => {
    setLoading(true);
    loadData()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    try {
      const updated = await api.likePost(postId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} color={Colors.primary} />;
  }

  return (
    <FlatList
      style={styles.list}
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          conditionName={conditionMap[item.conditionId]}
          onLike={() => handleLike(item.id)}
        />
      )}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          No hay publicaciones aún. ¡Sé el primero en compartir!
        </Text>
      }
      contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 88 }]}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingTop: 4 },
  loader: { marginTop: 40 },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
    fontSize: 14,
  },
});
