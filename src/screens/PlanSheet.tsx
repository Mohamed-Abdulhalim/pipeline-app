import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Eyebrow, formatMoney, Icon, IconName, KeyboardScroll, SheetHeader, success, useKeyboardFocus } from '../components/ui';
import { getPlan, PlanKind, savePlan } from '../db';
import { colors, fonts } from '../theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const PLAN_HORIZON = 12;

export function monthName(key: string) {
  return MONTHS[Number(key.slice(5, 7)) - 1] ?? key;
}



const k = (kind: PlanKind, label: string) => `${kind}|${label}`;
const num = (v: string | undefined) => Number((v ?? '').replace(/,/g, '')) || 0;

function AmountRow(props: { label: string; value: string; onChange: (v: string) => void; accent: string }) {
  const kb = useKeyboardFocus();
  const [editing, setEditing] = useState(false);
  return (
    <Pressable onPress={() => setEditing(true)} style={[styles.row, editing && { borderColor: props.accent }]}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {props.label}
      </Text>
      {editing ? (
        <TextInput
          ref={kb.ref}
          autoFocus
          selectTextOnFocus
          style={styles.rowInput}
          value={props.value}
          onChangeText={props.onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.muted}
          selectionColor={props.accent}
          cursorColor={props.accent}
          onFocus={kb.onFocus}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <Text style={[styles.rowInput, styles.rowValue, !props.value && { color: colors.muted }]} numberOfLines={1}>
          {props.value || '0'}
        </Text>
      )}
      <Text style={styles.rowUnit}>EGP</Text>
    </Pressable>
  );
}

function Section(props: { title: string; icon: IconName; total: number; accent: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: `${props.accent}1F` }]}>
          <Icon name={props.icon} size={15} color={props.accent} />
        </View>
        <Eyebrow style={{ flex: 1, color: colors.textDim }}>{props.title}</Eyebrow>
        <Text style={[styles.sectionTotal, { color: props.accent }]}>{formatMoney(props.total)}</Text>
      </View>
      {props.children}
    </View>
  );
}

export default function PlanSheet(props: {
  visible: boolean;
  initialMonth: string;
  sources: string[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [monthKeyState, setMonthKeyState] = useState(props.initialMonth);
  const [values, setValues] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] });
  const month = { key: monthKeyState, name: monthName(monthKeyState) };

  useEffect(() => {
    if (props.visible) setMonthKeyState(props.initialMonth);
  }, [props.visible, props.initialMonth]);

  useEffect(() => {
    if (!props.visible) return;
    getPlan(month.key).then((lines) => {
      const v: Record<string, string> = {};
      for (const l of lines) v[k(l.kind, l.label)] = String(Math.round(l.amount));
      setValues(v);
      setExtra({
        income: lines.filter((l) => l.kind === 'income' && !props.sources.includes(l.label)).map((l) => l.label),
        expense: lines.filter((l) => l.kind === 'expense' && !props.categories.includes(l.label)).map((l) => l.label),
      });
    });
  }, [props.visible, month.key, props.sources, props.categories]);

  const incomeLabels = useMemo(() => [...props.sources, ...extra.income], [props.sources, extra.income]);
  const expenseLabels = useMemo(() => [...props.categories, ...extra.expense], [props.categories, extra.expense]);

  const income = incomeLabels.reduce((a, l) => a + num(values[k('income', l)]), 0);
  const spending = expenseLabels.reduce((a, l) => a + num(values[k('expense', l)]), 0);
  const saving = num(values[k('saving', 'Savings')]);
  const left = income - spending - saving;
  const leftColor = left < 0 ? colors.bad : left > 0 ? colors.warn : colors.good;

  const set = (key: string) => (v: string) => setValues((cur) => ({ ...cur, [key]: v.replace(/[^0-9.,]/g, '') }));

  const buildLines = () => [
    ...incomeLabels.map((label) => ({ kind: 'income' as PlanKind, label, amount: num(values[k('income', label)]) })),
    ...expenseLabels.map((label) => ({ kind: 'expense' as PlanKind, label, amount: num(values[k('expense', label)]) })),
    { kind: 'saving' as PlanKind, label: 'Savings', amount: saving },
  ];

  const save = async () => {
    await savePlan(month.key, buildLines());
    success();
    props.onSaved();
  };

  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SheetHeader title={`Plan ${month.name} ${month.key.slice(0, 4)}`} onClose={props.onClose} onSave={save} top={insets.top} />
        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.summary}>
            <View style={styles.sumCol}>
              <Text style={[styles.sumNum, { color: colors.good }]}>{formatMoney(income, '').trim()}</Text>
              <Text style={styles.sumLabel}>Expected</Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumCol}>
              <Text style={styles.sumNum}>{formatMoney(spending + saving, '').trim()}</Text>
              <Text style={styles.sumLabel}>Assigned</Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumCol}>
              <Text style={[styles.sumNum, { color: leftColor }]}>
                {left < 0 ? '−' : ''}
                {formatMoney(Math.abs(left), '').trim()}
              </Text>
              <Text style={styles.sumLabel}>{left < 0 ? 'Over-assigned' : 'Left to assign'}</Text>
            </View>
          </View>
        </View>
        <KeyboardScroll contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: insets.bottom + 40 }}>
          <Section title="Expected income" icon="arrow-down-left" total={income} accent={colors.good}>
            {incomeLabels.map((l) => (
              <AmountRow key={l} label={l} value={values[k('income', l)] ?? ''} onChange={set(k('income', l))} accent={colors.good} />
            ))}
          </Section>
          <Section title="Spending budget" icon="arrow-up-right" total={spending} accent={colors.bad}>
            {expenseLabels.map((l) => (
              <AmountRow key={l} label={l} value={values[k('expense', l)] ?? ''} onChange={set(k('expense', l))} accent={colors.bad} />
            ))}
          </Section>
          <Section title="Savings" icon="archive" total={saving} accent={colors.brass}>
            <AmountRow label="Put aside" value={values[k('saving', 'Savings')] ?? ''} onChange={set(k('saving', 'Savings'))} accent={colors.brass} />
          </Section>
          <Text style={styles.hint}>
            Leave a field empty to skip it. Add sources and categories in Settings. Amounts are in EGP.
          </Text>
          <Button title={`Save ${month.name} plan`} icon="check" onPress={save} />
        </KeyboardScroll>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
  },
  toggleItem: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: colors.brassSoft },
  toggleText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13 },
  summary: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  sumCol: { flex: 1, alignItems: 'center' },
  sumNum: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  sumLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  sumDivider: { width: 1, backgroundColor: colors.line },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brassSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  bannerText: { color: colors.brass, fontFamily: fonts.semibold, fontSize: 13, marginLeft: 10, flex: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sectionTotal: { fontFamily: fonts.bold, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingLeft: 14,
    paddingRight: 12,
    height: 54,
    marginBottom: 8,
  },
  rowLabel: { flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginRight: 10 },
  rowInput: {
    width: 120,
    textAlign: 'right',
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    paddingVertical: 8,
  },
  rowValue: { paddingVertical: 10 },
  rowUnit: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, marginLeft: 6 },
  hint: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, marginBottom: 16 },
});
