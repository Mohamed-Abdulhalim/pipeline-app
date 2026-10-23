import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps, createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardTypeOptions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewInstance,
  ScrollViewProps,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputInstance,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brassGradient, colors, fonts, radius } from '../theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon(props: { name: IconName; size?: number; color?: string }) {
  return <Feather name={props.name} size={props.size ?? 18} color={props.color ?? colors.textDim} />;
}

export function tap() {
  Haptics.selectionAsync().catch(() => undefined);
}

export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

export function Serif({ children, size = 34, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.serif, { fontSize: size, lineHeight: size * 1.12 }, style]}>{children}</Text>;
}

export function Scale(props: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  return (
    <Pressable
      onPress={
        props.onPress
          ? () => {
              if (props.haptic !== false) tap();
              props.onPress?.();
            }
          : undefined
      }
      onLongPress={props.onLongPress}
      style={({ pressed }) => [props.style, { transform: [{ scale: pressed ? 0.975 : 1 }], opacity: pressed ? 0.92 : 1 }]}
    >
      {props.children}
    </Pressable>
  );
}

type FocusHandler = (input: TextInputInstance | null) => void;
const KeyboardScrollContext = createContext<FocusHandler | null>(null);

export function useKeyboardFocus() {
  const ref = useRef<TextInputInstance>(null);
  const report = useContext(KeyboardScrollContext);
  const onFocus = useCallback(() => report?.(ref.current), [report]);
  return { ref, onFocus };
}

export function KeyboardScroll(props: ScrollViewProps & { children: ReactNode }) {
  const { children, onScroll, ...rest } = props;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const focused = useRef<TextInputInstance | null>(null);
  const [space, setSpace] = useState(0);

  const reveal = useCallback(() => {
    const input = focused.current;
    const top = keyboardTop.current;
    if (!input || top === null || !scrollRef.current) return;
    input.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const limit = top - 24;
      if (y + h > limit) {
        scrollRef.current?.scrollTo({ y: offset.current + (y + h - limit), animated: true });
      } else if (y < 90) {
        scrollRef.current?.scrollTo({ y: Math.max(0, offset.current - (90 - y)), animated: true });
      }
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setSpace(e.endCoordinates.height);
      setTimeout(reveal, 60);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setSpace(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [reveal]);

  const report = useCallback<FocusHandler>(
    (input) => {
      focused.current = input;
      if (keyboardTop.current !== null) setTimeout(reveal, 60);
    },
    [reveal],
  );

  return (
    <KeyboardScrollContext.Provider value={report}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          offset.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        {...rest}
      >
        {children}
        <View style={{ height: space }} />
      </ScrollView>
    </KeyboardScrollContext.Provider>
  );
}

export function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  icon?: IconName;
}) {
  const [focused, setFocused] = useState(false);
  const kb = useKeyboardFocus();
  return (
    <View style={s.field}>
      <Eyebrow style={s.fieldLabel}>{props.label}</Eyebrow>
      <View style={[s.inputWrap, focused && s.inputFocused, props.multiline && s.multiline]}>
        {props.icon && (
          <View style={s.inputIcon}>
            <Icon name={props.icon} size={16} color={focused ? colors.brass : colors.muted} />
          </View>
        )}
        <TextInput
          ref={kb.ref}
          style={[s.input, props.multiline && { textAlignVertical: 'top', minHeight: 86 }]}
          value={props.value}
          onChangeText={props.onChange}
          placeholder={props.placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={props.keyboardType}
          multiline={props.multiline}
          selectionColor={colors.brass}
          cursorColor={colors.brass}
          onFocus={() => {
            setFocused(true);
            kb.onFocus();
          }}
          onBlur={() => setFocused(false)}
          autoCapitalize={props.keyboardType === 'url' ? 'none' : 'sentences'}
        />
      </View>
    </View>
  );
}

export function Select(props: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: IconName;
  dot?: (v: string) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const dotColor = props.value && props.dot ? props.dot(props.value) : undefined;
  return (
    <View style={s.field}>
      <Eyebrow style={s.fieldLabel}>{props.label}</Eyebrow>
      <Scale onPress={() => setOpen(true)} style={s.inputWrap}>
        {props.icon && (
          <View style={s.inputIcon}>
            <Icon name={props.icon} size={16} color={colors.muted} />
          </View>
        )}
        <View style={s.selectRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {dotColor && <View style={[s.dot, { backgroundColor: dotColor }]} />}
            <Text style={props.value ? s.selectText : s.placeholder} numberOfLines={1}>
              {props.value || props.placeholder || 'Choose'}
            </Text>
          </View>
          <Icon name="chevron-down" size={16} color={colors.muted} />
        </View>
      </Scale>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.handle} />
            <Eyebrow style={{ marginBottom: 12, marginLeft: 6 }}>{props.label}</Eyebrow>
            <FlatList
              data={props.options as string[]}
              keyExtractor={(o) => o}
              ListEmptyComponent={<Text style={[s.placeholder, { padding: 12 }]}>No options yet. Add some in Settings.</Text>}
              renderItem={({ item }) => {
                const active = item === props.value;
                const d = props.dot?.(item);
                return (
                  <Scale
                    style={[s.option, active && s.optionActive]}
                    onPress={() => {
                      props.onChange(item);
                      setOpen(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      {d && <View style={[s.dot, { backgroundColor: d }]} />}
                      <Text style={[s.optionText, active && { color: colors.brassHi }]}>{item}</Text>
                    </View>
                    {active && <Icon name="check" size={18} color={colors.brass} />}
                  </Scale>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const v = props.variant ?? 'primary';
  const fg = v === 'primary' ? colors.onBrass : v === 'danger' ? colors.bad : colors.text;
  const content = (
    <View style={s.btnInner}>
      {props.icon && <Icon name={props.icon} size={17} color={fg} />}
      <Text style={[s.btnText, { color: fg }, props.icon && { marginLeft: 8 }]}>{props.title}</Text>
    </View>
  );
  return (
    <Scale onPress={props.onPress} style={[s.btn, v === 'ghost' && s.btnGhost, v === 'danger' && s.btnDanger, props.style]}>
      {v === 'primary' ? (
        <LinearGradient colors={brassGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btnGradient}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Scale>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function GlowCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.glowOuter, style]}>
      <LinearGradient
        colors={['#1E2533', '#141924', '#10141C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.glowInner}
      >
        <LinearGradient
          colors={['rgba(217,174,98,0.18)', 'rgba(217,174,98,0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.3, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </LinearGradient>
    </View>
  );
}

export function Chip(props: { label: string; count?: number; active: boolean; onPress: () => void; color?: string }) {
  const c = props.color ?? colors.brass;
  return (
    <Scale onPress={props.onPress} style={[s.chip, props.active && { backgroundColor: colors.surfaceHi, borderColor: c }]}>
      <View style={[s.chipDot, { backgroundColor: c, opacity: props.active ? 1 : 0.45 }]} />
      <Text style={[s.chipText, props.active && { color: colors.text }]}>{props.label}</Text>
      {props.count !== undefined && (
        <Text style={[s.chipCount, props.active && { color: c }]}>{props.count}</Text>
      )}
    </Scale>
  );
}

export function Fab(props: { icon: IconName; onPress: () => void; bottom: number }) {
  return (
    <Scale onPress={props.onPress} style={[s.fab, { bottom: props.bottom }]}>
      <LinearGradient colors={brassGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fabInner}>
        <Feather name={props.icon} size={26} color={colors.onBrass} />
      </LinearGradient>
    </Scale>
  );
}

export function SheetHeader(props: { title: string; onClose: () => void; onSave?: () => void; top: number }) {
  return (
    <View style={[s.sheetHeader, { paddingTop: props.top + 10 }]}>
      <Scale onPress={props.onClose} style={s.roundBtn}>
        <Icon name="x" size={20} color={colors.text} />
      </Scale>
      <Serif size={24}>{props.title}</Serif>
      {props.onSave ? (
        <Scale onPress={props.onSave} style={[s.roundBtn, { backgroundColor: colors.brass, borderColor: colors.brass }]}>
          <Icon name="check" size={20} color={colors.onBrass} />
        </Scale>
      ) : (
        <View style={{ width: 42 }} />
      )}
    </View>
  );
}

export function formatMoney(n: number, currency = 'EGP'): string {
  return `${Math.round(n).toLocaleString('en-US')} ${currency}`;
}

export function compactMoney(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 10_000) return `${Math.round(n / 1000)}K`;
  return Math.round(n).toLocaleString('en-US');
}

const s = StyleSheet.create({
  eyebrow: {
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  serif: { color: colors.text, fontFamily: fonts.serif },
  field: { marginBottom: 18 },
  fieldLabel: { marginBottom: 8, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 52,
  },
  inputFocused: { borderColor: colors.brass, backgroundColor: colors.surfaceHi },
  multiline: { alignItems: 'flex-start', paddingTop: 4 },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  selectRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  selectText: { color: colors.text, fontSize: 16, fontFamily: fonts.medium, flexShrink: 1 },
  placeholder: { color: colors.muted, fontSize: 16, fontFamily: fonts.medium },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(3,4,7,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 14,
    paddingTop: 10,
    maxHeight: '72%',
    borderWidth: 1,
    borderColor: colors.line,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 2,
  },
  optionActive: { backgroundColor: colors.brassSoft },
  optionText: { color: colors.text, fontSize: 16, fontFamily: fonts.semibold },
  btn: { borderRadius: 16, overflow: 'hidden', minHeight: 54, justifyContent: 'center' },
  btnGradient: { minHeight: 54, justifyContent: 'center', borderRadius: 16 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnGhost: { backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.line },
  btnDanger: { backgroundColor: colors.badSoft, borderWidth: 1, borderColor: 'rgba(224,122,122,0.3)' },
  btnText: { fontSize: 16, fontFamily: fonts.bold, letterSpacing: 0.2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  glowOuter: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(217,174,98,0.22)',
    overflow: 'hidden',
  },
  glowInner: { padding: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  chipText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 14 },
  chipCount: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13, marginLeft: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 62,
    height: 62,
    borderRadius: 22,
    shadowColor: colors.brass,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  fabInner: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
