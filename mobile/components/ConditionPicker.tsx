import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Colors, { categoryLabels } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { Condition } from '@/types';

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

function getConditionIcon(icon: string): keyof typeof Ionicons.glyphMap {
  return CONDITION_ICONS[icon] ?? 'medical-outline';
}

interface ConditionPickerProps {
  conditions: Condition[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showAll?: boolean;
}

function ConditionChip({
  label,
  active,
  onPress,
  icon,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  colors: (typeof Colors)['light'];
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: active ? 'rgba(255,255,255,0.2)' : 'rgba(91,79,207,0.15)' }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? Colors.primary : colors.chipBg,
          borderColor: active ? Colors.primary : colors.chipBorder,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={active ? '#fff' : Colors.secondary}
          style={styles.icon}
        />
      ) : null}
      <Text
        style={[
          styles.chipText,
          { color: active ? '#fff' : colors.chipText },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ConditionPicker({
  conditions,
  selectedId,
  onSelect,
  showAll = true,
}: ConditionPickerProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const chipColors = {
    ...colors,
    chipBg: scheme === 'dark' ? '#252540' : colors.card,
    chipBorder: scheme === 'dark' ? '#4B5563' : colors.border,
    chipText: colors.text,
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {showAll && (
        <ConditionChip
          label="Todas"
          active={!selectedId}
          onPress={() => onSelect(null)}
          colors={chipColors}
        />
      )}
      {conditions.map((condition) => (
        <ConditionChip
          key={condition.id}
          label={condition.name}
          active={selectedId === condition.id}
          onPress={() => onSelect(condition.id)}
          icon={getConditionIcon(condition.icon)}
          colors={chipColors}
        />
      ))}
    </ScrollView>
  );
}

export function ConditionBadge({ condition }: { condition: Condition }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${Colors.secondary}22` }]}>
      <Text style={[styles.badgeText, { color: Colors.secondary }]}>
        {categoryLabels[condition.category] ?? condition.category}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 2,
    alignItems: 'flex-start',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    flexShrink: 0,
    minHeight: 36,
    ...Platform.select({
      android: {
        elevation: 1,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
    }),
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    ...Platform.select({
      android: {
        includeFontPadding: false,
        textAlignVertical: 'center',
      },
    }),
  },
  icon: {
    marginRight: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
