import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Colors, { serviceTypeLabels } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { User } from '@/types';

export function UserCard({ user, conditionNames }: { user: User; conditionNames: string[] }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.avatar, user.needsHelp && styles.avatarHelp]}>
          <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
          {user.city && (
            <Text style={[styles.city, { color: colors.textSecondary }]}>
              <Ionicons name="location-outline" size={12} /> {user.city}
            </Text>
          )}
        </View>
        {user.needsHelp && (
          <View style={styles.helpBadge}>
            <Ionicons name="hand-left" size={12} color="#fff" />
            <Text style={styles.helpText}>Necesita ayuda</Text>
          </View>
        )}
      </View>
      {user.bio && (
        <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={2}>
          {user.bio}
        </Text>
      )}
      <View style={styles.tags}>
        {conditionNames.map((name) => (
          <View key={name} style={[styles.tag, { backgroundColor: `${Colors.secondary}18` }]}>
            <Text style={[styles.tagText, { color: Colors.secondary }]}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ServiceCard({
  name,
  type,
  address,
  description,
}: {
  name: string;
  type: string;
  address: string;
  description: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const label = serviceTypeLabels[type] ?? type;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.serviceHeader}>
        <Ionicons name="medical" size={20} color={Colors.primary} />
        <Text style={[styles.name, { color: colors.text, marginLeft: 8 }]}>{name}</Text>
      </View>
      <View style={[styles.typeBadge, { backgroundColor: `${Colors.primary}15` }]}>
        <Text style={[styles.typeText, { color: Colors.primary }]}>{label}</Text>
      </View>
      <Text style={[styles.address, { color: colors.textSecondary }]}>{address}</Text>
      <Text style={[styles.bio, { color: colors.textSecondary }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHelp: {
    backgroundColor: Colors.accent,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  city: {
    fontSize: 12,
    marginTop: 2,
  },
  helpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  helpText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  bio: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 19,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  address: {
    fontSize: 12,
    marginTop: 6,
  },
});
