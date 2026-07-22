import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ConditionPicker } from '@/components/ConditionPicker';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

export default function CreatePostScreen() {
  const { conditions, user } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const [conditionId, setConditionId] = useState(
    user?.conditionIds?.[0] ?? conditions[0]?.id ?? ''
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!conditionId || !title.trim() || !content.trim()) {
      Alert.alert('Campos requeridos', 'Selecciona una condición, título y contenido.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPost({
        conditionId,
        title: title.trim(),
        content: content.trim(),
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      Alert.alert('¡Publicado!', 'Tu consejo ya está visible para la comunidad.');
      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo publicar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.text }]}>Condición</Text>
        <ConditionPicker
          conditions={conditions}
          selectedId={conditionId}
          onSelect={(id) => id && setConditionId(id)}
          showAll={false}
        />

        <Text style={[styles.label, { color: colors.text }]}>Título</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="¿Qué te ayudó?"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.label, { color: colors.text }]}>Tu experiencia</Text>
        <TextInput
          style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="Comparte detalles que puedan ayudar a otros..."
          placeholderTextColor={colors.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
        />

        <Text style={[styles.label, { color: colors.text }]}>Etiquetas (separadas por coma)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="productos, transporte, educación"
          placeholderTextColor={colors.textSecondary}
          value={tags}
          onChangeText={setTags}
        />

        <Pressable
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? 'Publicando...' : 'Publicar consejo'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 8,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
