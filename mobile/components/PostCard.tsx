import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  conditionName?: string;
  onLike?: () => void;
}

export function PostCard({ post, conditionName, onLike }: PostCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const date = new Date(post.createdAt).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{post.userName.charAt(0)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.userName, { color: colors.text }]}>{post.userName}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {conditionName ?? post.conditionId} · {date}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>
      <Text style={[styles.content, { color: colors.textSecondary }]}>{post.content}</Text>

      {post.tags.length > 0 && (
        <View style={styles.tags}>
          {post.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: `${Colors.primary}15` }]}>
              <Text style={[styles.tagText, { color: Colors.primary }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Pressable style={styles.likeBtn} onPress={onLike}>
          <Ionicons name="heart" size={18} color={Colors.accent} />
          <Text style={[styles.likeCount, { color: colors.textSecondary }]}>{post.likes}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontWeight: '700',
    fontSize: 15,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  content: {
    fontSize: 14,
    lineHeight: 21,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: '600',
  },
});
