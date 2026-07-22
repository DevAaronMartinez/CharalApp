import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ConditionPicker } from '@/components/ConditionPicker';
import { PostCard } from '@/components/PostCard';
import { Screen } from '@/components/Screen';
import { UserCard } from '@/components/UserCard';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import type { Post, User } from '@/types';

export default function CommunityScreen() {
  const { conditions, selectedConditionId, setSelectedConditionId } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [posts, setPosts] = useState<Post[]>([]);
  const [usersNeedingHelp, setUsersNeedingHelp] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'posts' | 'help'>('posts');

  const conditionMap = Object.fromEntries(conditions.map((c) => [c.id, c.name]));

  const loadData = useCallback(async () => {
    const [postsData, helpUsers] = await Promise.all([
      api.getPosts(selectedConditionId ?? undefined),
      api.getUsers({
        conditionId: selectedConditionId ?? undefined,
        needsHelp: true,
      }),
    ]);
    setPosts(postsData);
    setUsersNeedingHelp(helpUsers);
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

  return (
    <Screen style={{ backgroundColor: colors.background }}>
      <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Comunidad Salud</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Comparte lo que te ayuda y conecta con personas que te entienden
        </Text>
        <Link href="/create-post" asChild>
          <Pressable style={styles.createBtn}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Publicar consejo</Text>
          </Pressable>
        </Link>
      </View>

      <ConditionPicker
        conditions={conditions}
        selectedId={selectedConditionId}
        onSelect={setSelectedConditionId}
      />

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'posts' && styles.tabActive]}
          onPress={() => setTab('posts')}
        >
          <Text style={[styles.tabText, tab === 'posts' && styles.tabTextActive]}>
            Publicaciones
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'help' && styles.tabActive]}
          onPress={() => setTab('help')}
        >
          <Text style={[styles.tabText, tab === 'help' && styles.tabTextActive]}>
            Necesitan ayuda ({usersNeedingHelp.length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      ) : tab === 'posts' ? (
        <FlatList
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
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={usersNeedingHelp}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              conditionNames={item.conditionIds.map((id) => conditionMap[id] ?? id)}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              Nadie ha marcado que necesita ayuda en esta condición.
            </Text>
          }
          contentContainerStyle={styles.list}
        />
      )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    padding: 20,
    paddingTop: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#E5E7EB33',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontWeight: '600',
    fontSize: 13,
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  loader: { marginTop: 40 },
  list: { paddingBottom: 24 },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
    fontSize: 14,
  },
});
