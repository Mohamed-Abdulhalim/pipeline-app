import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  compactMoney,
  Eyebrow,
  Fab,
  formatMoney,
  GlowCard,
  Icon,
  Input,
  Scale,
  Select,
  Serif,
  SheetHeader,
  success,
} from '../components/ui';
import { CURRENCIES, Currency, deleteIncome, getIncomeBetween, getSettings, Income, insertIncome } from '../db';
import { colors, fonts } from '../theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PALETTE = ['#D9AE62', '#7FA6D9', '#7CCB9A', '#A99BE0', '#D98585', '#6CC3C9', '#C9A0C4'];

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const prev = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  return { start, end, prev, month: MONTHS[start.getMonth()], year: start.getFullYear() };
}

export default function IncomeScreen(props: {
  version: number;
  sources: string[];
  bump: () => void;
  bottomSpace: number;
}) {
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Income[]>([]);
  const [prevTotal, setPrevTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const range = useMemo(() => monthRange(offset), [offset]);

  const load = useCallback(async () => {
    const [cur, prev] = await Promise.all([
      getIncomeBetween(range.start.getTime(), range.end.getTime()),
      getIncomeBetween(range.prev.getTime(), range.start.getTime()),
    ]);
    setRows(cur);
    setPrevTotal(prev.reduce((a, r) => a + r.amount_egp, 0));
  }, [range]);

  useEffect(() => {
    load();
  }, [load, props.version]);

  const total = rows.reduce((a, r) => a + r.amount_egp, 0);
  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.source, (m.get(r.source) ?? 0) + r.amount_egp);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    bySource.forEach(([name], i) => m.set(name, PALETTE[i % PALETTE.length]));
    return m;
  }, [bySource]);
  const topShare = total > 0 && bySource.length ? bySource[0][1] / total : 0;
  const delta = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const remove = (r: Income) => {
    Alert.alert('Delete entry?', `${formatMoney(r.amount, r.currency)} from ${r.source}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteIncome(r.id);
          props.bump();
        },
      },
    ]);
  };

  const header = (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={styles.monthRow}>
        <Scale onPress={() => setOffset(offset - 1)} style={styles.navBtn}>
          <Icon name="chevron-left" size={20} color={colors.text} />
        </Scale>
        <View style={{ alignItems: 'center' }}>
          <Serif size={24}>{range.month}</Serif>
          <Text style={styles.year}>{range.year}</Text>
        </View>
        <Scale onPress={() => offset < 0 && setOffset(offset + 1)} style={[styles.navBtn, offset >= 0 && { opacity: 0.3 }]}>
          <Icon name="chevron-right" size={20} color={colors.text} />
        </Scale>
      </View>

      <GlowCard style={{ marginBottom: 14 }}>
        <Eyebrow style={{ color: colors.brass }}>Received</Eyebrow>
        <View style={styles.heroRow}>
          <Serif size={52}>{compactMoney(total)}</Serif>
          <Text style={styles.heroUnit}>EGP</Text>
        </View>
        {delta !== null && (
          <View style={[styles.delta, { backgroundColor: delta >= 0 ? colors.goodSoft : colors.badSoft }]}>
            <Icon name={delta >= 0 ? 'arrow-up-right' : 'arrow-down-right'} size={13} color={delta >= 0 ? colors.good : colors.bad} />
            <Text style={[styles.deltaText, { color: delta >= 0 ? colors.good : colors.bad }]}>
              {Math.abs(delta)}% vs last month
            </Text>
          </View>
        )}
        {bySource.length > 0 && (
          <>
            <View style={styles.stack}>
              {bySource.map(([name, amt]) => (
                <View key={name} style={{ flex: amt, backgroundColor: colorOf.get(name), marginRight: 2 }} />
              ))}
            </View>
            <View style={styles.depRow}>
              <Icon
                name={topShare >= 0.7 ? 'alert-triangle' : 'shield'}
                size={14}
                color={topShare >= 0.7 ? colors.warn : colors.good}
              />
              <Text style={[styles.depText, { color: topShare >= 0.7 ? colors.warn : colors.good }]}>
                {Math.round(topShare * 100)}% from {bySource[0][0]}
                {topShare >= 0.7 ? '. Too dependent on one source.' : '. Healthy spread.'}
              </Text>
            </View>
          </>
        )}
      </GlowCard>

      {bySource.length > 0 && (
        <View style={styles.card}>
          <Eyebrow style={{ marginBottom: 12 }}>By source</Eyebrow>
          {bySource.map(([name, amt], i) => (
            <View key={name} style={[styles.sourceRow, i === bySource.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.swatch, { backgroundColor: colorOf.get(name) }]} />
              <Text style={styles.sourceName} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.sourcePct}>{Math.round((amt / total) * 100)}%</Text>
              <Text style={styles.sourceAmt}>{formatMoney(amt)}</Text>
            </View>
          ))}
        </View>
      )}

      {rows.length > 0 && <Eyebrow style={{ marginTop: 22, marginBottom: 10, marginLeft: 2 }}>Entries · hold to delete</Eyebrow>}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: props.bottomSpace + 70 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="trending-up" size={26} color={colors.brass} />
            </View>
            <Serif size={26}>No income yet</Serif>
            <Text style={styles.emptyText}>Log money the day it lands. The picture of where it comes from builds itself.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Scale onLongPress={() => remove(item)} style={{ paddingHorizontal: 20 }}>
            <View style={styles.entry}>
              <View style={[styles.entryIcon, { backgroundColor: `${colorOf.get(item.source) ?? colors.brass}1F` }]}>
                <Icon name="arrow-down-left" size={16} color={colorOf.get(item.source) ?? colors.brass} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entrySource}>{item.source}</Text>
                <Text style={styles.entryMeta} numberOfLines={1}>
                  {new Date(item.received_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {item.note ? ` · ${item.note}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>+{formatMoney(item.amount_egp)}</Text>
                {item.currency !== 'EGP' && <Text style={styles.entryMeta}>{formatMoney(item.amount, item.currency)}</Text>}
              </View>
            </View>
          </Scale>
        )}
      />
      <Fab icon="plus" bottom={props.bottomSpace} onPress={() => setFormOpen(true)} />
      <IncomeForm
        visible={formOpen}
        sources={props.sources}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          setOffset(0);
          props.bump();
        }}
      />
    </View>
  );
}

function dayOptions() {
  const out: string[] = [];
  for (let i = 0; i < 45; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(
      i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    );
  }
  return out;
}

function IncomeForm(props: { visible: boolean; sources: string[]; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('EGP');
  const [day, setDay] = useState('Today');
  const [note, setNote] = useState('');
  const [rate, setRate] = useState(50);
  const days = useMemo(dayOptions, [props.visible]);

  useEffect(() => {
    if (!props.visible) return;
    setSource(props.sources[0] ?? '');
    setAmount('');
    setCurrency('EGP');
    setDay('Today');
    setNote('');
    getSettings().then((s) => setRate(s.usdRate));
  }, [props.visible, props.sources]);

  const n = Number(amount.replace(/,/g, '')) || 0;
  const egp = currency === 'USD' ? n * rate : n;

  const save = async () => {
    if (!source || n <= 0) {
      Alert.alert('Missing info', 'Pick a source and enter an amount.');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() - days.indexOf(day));
    d.setHours(12, 0, 0, 0);
    await insertIncome({ source, amount: n, currency, amount_egp: egp, received_at: d.getTime(), note: note.trim() });
    success();
    props.onSaved();
  };

  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="height">
        <SheetHeader title="Log income" onClose={props.onClose} onSave={save} top={insets.top} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.preview}>
            <Eyebrow>Amount in EGP</Eyebrow>
            <Serif size={48} style={{ marginTop: 4 }}>
              {formatMoney(egp, '').trim() || '0'}
            </Serif>
            {currency === 'USD' && <Text style={styles.entryMeta}>at {rate} EGP per USD</Text>}
          </View>
          <Select label="Source" value={source} options={props.sources} onChange={setSource} icon="briefcase" />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1.6, marginRight: 10 }}>
              <Input label="Amount" value={amount} onChange={setAmount} keyboardType="numeric" icon="dollar-sign" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="Currency" value={currency} options={CURRENCIES} onChange={(v) => setCurrency(v as Currency)} />
            </View>
          </View>
          <Select label="Received" value={day} options={days} onChange={setDay} icon="calendar" />
          <Input label="Note" value={note} onChange={setNote} icon="edit-3" placeholder="Optional" />
          <Button title="Save income" icon="check" onPress={save} style={{ marginTop: 6 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, marginTop: 4 },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  year: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  heroUnit: { color: colors.textDim, fontFamily: fonts.semibold, fontSize: 15, marginLeft: 8, marginBottom: 10 },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 8,
  },
  deltaText: { fontFamily: fonts.bold, fontSize: 12, marginLeft: 5 },
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 20 },
  depRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  depText: { fontFamily: fonts.semibold, fontSize: 13, marginLeft: 8, flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  swatch: { width: 10, height: 10, borderRadius: 3, marginRight: 12 },
  sourceName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, flex: 1 },
  sourcePct: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13, width: 46, textAlign: 'right' },
  sourceAmt: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, width: 110, textAlign: 'right' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
  entryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  entrySource: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  entryMeta: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  amount: { color: colors.good, fontFamily: fonts.bold, fontSize: 15 },
  empty: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 30 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.brassSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  preview: {
    alignItems: 'center',
    paddingVertical: 22,
    marginBottom: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
