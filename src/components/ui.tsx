import { ReactNode, useState } from 'react';
import {
  FlatList,
  KeyboardTypeOptions,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius } from '../theme';

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Label>{props.label}</Label>
      <TextInput
        style={[s.input, props.multiline && s.multiline]}
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        autoCapitalize={props.keyboardType === 'url' ? 'none' : 'sentences'}
      />
    </View>
  );
}

export function Select(props: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.field}>
      <Label>{props.label}</Label>
      <Pressable style={s.input} onPress={() => setOpen(true)}>
        <View style={s.selectRow}>
          <Text style={props.value ? s.selectText : s.placeholder}>{props.value || props.placeholder || 'Choose'}</Text>
          <Text style={s.chevron}>▾</Text>
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{props.label}</Text>
            <FlatList
              data={props.options as string[]}
              keyExtractor={(o) => o}
              ListEmptyComponent={<Text style={s.placeholder}>No options yet. Add some in Settings.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={[s.option, item === props.value && s.optionActive]}
                  onPress={() => {
                    props.onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={s.optionText}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: ViewStyle;
}) {
  const v = props.variant ?? 'primary';
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        s.btn,
        v === 'primary' && s.btnPrimary,
        v === 'ghost' && s.btnGhost,
        v === 'danger' && s.btnDanger,
        pressed && { opacity: 0.7 },
        props.style,
      ]}
    >
      <Text style={[s.btnText, v !== 'primary' && { color: v === 'danger' ? colors.bad : colors.text }]}>
        {props.title}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Chip(props: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[s.chip, props.active && { backgroundColor: props.color ?? colors.accent, borderColor: 'transparent' }]}
    >
      <Text style={[s.chipText, props.active && { color: '#fff' }]}>{props.label}</Text>
    </Pressable>
  );
}

export function formatMoney(n: number, currency = 'EGP'): string {
  return `${Math.round(n).toLocaleString('en-US')} ${currency}`;
}

const s = StyleSheet.create({
  label: { color: colors.muted, fontSize: 13, marginBottom: 6, fontWeight: '600' },
  field: { marginBottom: 14 },
  input: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  selectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText: { color: colors.text, fontSize: 16 },
  placeholder: { color: colors.muted, fontSize: 16 },
  chevron: { color: colors.muted, fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '70%',
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  option: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10 },
  optionActive: { backgroundColor: colors.accentSoft },
  optionText: { color: colors.text, fontSize: 16 },
  btn: { borderRadius: radius, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.bad },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.card,
  },
  chipText: { color: colors.muted, fontWeight: '600' },
});
