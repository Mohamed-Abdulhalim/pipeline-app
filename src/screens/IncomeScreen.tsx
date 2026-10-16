import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, formatMoney, Input, Select } from '../components/ui';
import { CURRENCIES, Currency, deleteIncome, getIncomeBetween, getSettings, Income, insertIncome } from '../db';
import { colors } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BAR_COLORS = ['#4F8CFF', '#2FBF71', '#B07CFF', '#F2A93B', '#E5534B', '#3CC6D0', '#E07BB5'];

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end, label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}` };
}

export default function IncomeScreen(props: { version: number; sources: string[]; bump: () => void }) {
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Income[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const range = useMemo(() => monthRange(offset), [offset]);

  const load = useCallback(async () => {
    setRows(await getIncomeBetween(range.start.getTime(), range.end.getTime()));
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
  const topShare = total > 0 && bySource.length ? bySource[0][1] / total : 0;

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

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListHeaderComponent={
          <View>
            <View style={styles.monthRow}>
              <Text style={styles.arrow} onPress={() => setOffset(offset - 1)}>
                ‹
              </Text>
              <Text style={styles.month}>{range.label}</Text>
              <Text style={[styles.arrow, offset >= 0 && { opacity: 0.25 }]} onPress={() => offset < 0 && setOffset(offset + 1)}>
                ›
              </Text>
            </View>
            <Card style={{ marginBottom: 12 }}>
              <Text style={styles.small}>Total received</Text>
              <Text style={styles.total}>{formatMoney(total)}</Text>
              {bySource.length > 0 && (
                <Text style={[styles.small, { marginTop: 6, color: topShare >= 0.7 ? colors.warn : colors.good }]}>
                  {Math.round(topShare * 100)}% from {bySource[0][0]}
                  {topShare >= 0.7 ? '. High dependency on one source.' : '.'}
                </Text>
              )}
            </Card>
            {bySource.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <Text style={[styles.small, { marginBottom: 10 }]}>By source</Text>
                {bySource.map(([name, amt], i) => (
                  <View key={name} style={{ marginBottom: 10 }}>
                    <View style={styles.barLabel}>
                      <Text style={styles.text}>{name}</Text>
                      <Text style={styles.small}>
                        {formatMoney(amt)} · {Math.round((amt / total) * 100)}%
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.bar,
                          { width: `${Math.max(2, (amt / total) * 100)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            )}
            {rows.length > 0 && <Text style={[styles.small, { marginBottom: 8 }]}>Entries (long-press to delete)</Text>}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No income logged this month. Tap + when money lands.</Text>}
        renderItem={({ item }) => (
          <Pressable onLongPress={() => remove(item)}>
            <Card style={styles.entry}>
              <View style={{ flex: 1 }}>
                <Text style={styles.text}>{item.source}</Text>
                <Text style={styles.small}>
                  {new Date(item.received_at).toLocaleDateString('en-GB')}
                  {item.note ? ` · ${item.note}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>{formatMoney(item.amount_egp)}</Text>
                {item.currency !== 'EGP' && <Text style={styles.small}>{formatMoney(item.amount, item.currency)}</Text>}
              </View>
            </Card>
          </Pressable>
        )}
      />
      <Pressable style={styles.fab} onPress={() => setFormOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
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
    out.push(i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-GB'));
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
    props.onSaved();
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.cancel} onPress={props.onClose}>
            Cancel
          </Text>
          <Text style={styles.headerTitle}>Log income</Text>
          <Text style={styles.save} onPress={save}>
            Save
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Select label="Source" value={source} options={props.sources} onChange={setSource} />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 2, marginRight: 10 }}>
              <Input label="Amount" value={amount} onChange={setAmount} keyboardType="numeric" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="Currency" value={currency} options={CURRENCIES} onChange={(v) => setCurrency(v as Currency)} />
            </View>
          </View>
          {currency === 'USD' && n > 0 && (
            <Text style={[styles.small, { marginTop: -6, marginBottom: 14 }]}>
              ≈ {formatMoney(egp)} at {rate} EGP/USD (change rate in Settings)
            </Text>
          )}
          <Select label="Received" value={day} options={days} onChange={setDay} />
          <Input label="Note" value={note} onChange={setNote} placeholder="Optional" />
          <Button title="Save" onPress={save} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  arrow: { color: colors.text, fontSize: 30, paddingHorizontal: 16, paddingVertical: 2 },
  month: { color: colors.text, fontSize: 18, fontWeight: '700' },
  small: { color: colors.muted, fontSize: 13 },
  text: { color: colors.text, fontSize: 15, fontWeight: '600' },
  total: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: 4 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  entry: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  amount: { color: colors.good, fontSize: 16, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 30, fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.good,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cancel: { color: colors.muted, fontSize: 16, padding: 4 },
  save: { color: colors.accent, fontSize: 16, fontWeight: '700', padding: 4 },
});
