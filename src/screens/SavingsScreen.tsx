import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Switch, Text, View } from 'react-native';
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
  KeyboardScroll,
  Scale,
  Select,
  Serif,
  SheetHeader,
  success,
} from '../components/ui';
import {
  CURRENCIES,
  Currency,
  deleteSaving,
  getAllSavings,
  getIncomeBetween,
  getSettings,
  insertSaving,
  Saving,
  SavingKind,
  savingsNet,
  setSavingHidden,
} from '../db';
import { colors, fonts } from '../theme';

function monthStart(offset = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).getTime();
}

export default function SavingsScreen(props: { version: number; bump: () => void; bottomSpace: number }) {
  const [all, setAll] = useState<Saving[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [received, setReceived] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    const [rows, settings, income] = await Promise.all([
      getAllSavings(),
      getSettings(),
      getIncomeBetween(monthStart(0), monthStart(1)),
    ]);
    setAll(rows);
    setShowHidden(settings.showHidden === 1);
    setReceived(income.reduce((a, r) => a + r.amount_egp, 0));
  }, []);

  useEffect(() => {
    load();
  }, [load, props.version]);

  const visible = useMemo(() => all.filter((r) => showHidden || !r.hidden), [all, showHidden]);
  const thisMonth = useMemo(() => visible.filter((r) => r.saved_at >= monthStart(0)), [visible]);
  const balance = savingsNet(visible, true);
  const savedMonth = thisMonth.filter((r) => r.kind === 'save').reduce((a, r) => a + r.amount_egp, 0);
  const withdrawnMonth = thisMonth.filter((r) => r.kind === 'withdraw').reduce((a, r) => a + r.amount_egp, 0);
  const netMonth = savedMonth - withdrawnMonth;
  const rate = received > 0 ? Math.round((netMonth / received) * 100) : null;
  const hiddenCount = all.filter((r) => r.hidden).length;

  const manage = (r: Saving) => {
    Alert.alert(
      r.kind === 'save' ? 'Saving' : 'Withdrawal',
      `${formatMoney(r.amount, r.currency)} · ${new Date(r.saved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      [
        {
          text: r.hidden ? 'Unhide' : 'Hide',
          onPress: async () => {
            await setSavingHidden(r.id, !r.hidden);
            success();
            props.bump();
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Delete entry?', 'This also changes that month\'s net.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteSaving(r.id);
                  props.bump();
                },
              },
            ]),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const header = (
    <View style={{ paddingHorizontal: 20 }}>
      {showHidden && (
        <View style={styles.banner}>
          <Icon name="eye" size={14} color={colors.brass} />
          <Text style={styles.bannerText}>
            Showing hidden savings{hiddenCount ? ` (${hiddenCount})` : ''}. Turn this off in Settings.
          </Text>
        </View>
      )}
      <GlowCard style={{ marginBottom: 14 }}>
        <Eyebrow style={{ color: colors.brass }}>Total saved</Eyebrow>
        <View style={styles.heroRow}>
          <Serif size={52} style={balance < 0 ? { color: colors.bad } : undefined}>
            {balance < 0 ? '−' : ''}
            {compactMoney(Math.abs(balance))}
          </Serif>
          <Text style={styles.heroUnit}>EGP</Text>
        </View>
        {netMonth !== 0 && (
          <View style={[styles.delta, { backgroundColor: netMonth > 0 ? colors.goodSoft : colors.badSoft }]}>
            <Icon name={netMonth > 0 ? 'arrow-up-right' : 'arrow-down-right'} size={13} color={netMonth > 0 ? colors.good : colors.bad} />
            <Text style={[styles.deltaText, { color: netMonth > 0 ? colors.good : colors.bad }]}>
              {netMonth > 0 ? '+' : '−'}
              {formatMoney(Math.abs(netMonth))} this month
            </Text>
          </View>
        )}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.good }]}>{compactMoney(savedMonth)}</Text>
            <Text style={styles.statLabel}>Saved this month</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, withdrawnMonth > 0 && { color: colors.bad }]}>{compactMoney(withdrawnMonth)}</Text>
            <Text style={styles.statLabel}>Withdrawn</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{rate === null ? '–' : `${rate}%`}</Text>
            <Text style={styles.statLabel}>Of income</Text>
          </View>
        </View>
      </GlowCard>
      {visible.length > 0 && <Eyebrow style={{ marginTop: 8, marginBottom: 10, marginLeft: 2 }}>History · tap to hide or delete</Eyebrow>}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={visible}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: props.bottomSpace + 70 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="archive" size={26} color={colors.brass} />
            </View>
            <Serif size={26}>Nothing saved yet</Serif>
            <Text style={styles.emptyText}>Every amount you put aside comes out of that month's net, so what's left is what you can actually spend.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSave = item.kind === 'save';
          const tint = isSave ? colors.brass : colors.bad;
          return (
            <Scale onPress={() => manage(item)} style={{ paddingHorizontal: 20 }}>
              <View style={[styles.entry, !!item.hidden && styles.entryHidden]}>
                <View style={[styles.entryIcon, { backgroundColor: isSave ? colors.brassSoft : colors.badSoft }]}>
                  <Icon name={isSave ? 'arrow-down' : 'arrow-up'} size={16} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.entryTitle}>{isSave ? 'Saved' : 'Withdrawn'}</Text>
                    {!!item.hidden && (
                      <View style={styles.hiddenBadge}>
                        <Icon name="eye-off" size={11} color={colors.muted} />
                        <Text style={styles.hiddenText}>Hidden</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.entryMeta} numberOfLines={1}>
                    {new Date(item.saved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {item.note ? ` · ${item.note}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amount, { color: isSave ? colors.brassHi : colors.bad }]}>
                    {isSave ? '+' : '−'}
                    {formatMoney(item.amount_egp)}
                  </Text>
                  {item.currency !== 'EGP' && <Text style={styles.entryMeta}>{formatMoney(item.amount, item.currency)}</Text>}
                </View>
              </View>
            </Scale>
          );
        }}
      />
      <Fab icon="plus" bottom={props.bottomSpace} onPress={() => setFormOpen(true)} />
      <SavingForm
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
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

function SavingForm(props: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<SavingKind>('save');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('EGP');
  const [day, setDay] = useState('Today');
  const [note, setNote] = useState('');
  const [hidden, setHidden] = useState(false);
  const [rate, setRate] = useState(50);
  const days = useMemo(dayOptions, [props.visible]);

  useEffect(() => {
    if (!props.visible) return;
    setKind('save');
    setAmount('');
    setCurrency('EGP');
    setDay('Today');
    setNote('');
    setHidden(false);
    getSettings().then((s) => setRate(s.usdRate));
  }, [props.visible]);

  const n = Number(amount.replace(/,/g, '')) || 0;
  const egp = currency === 'USD' ? n * rate : n;
  const isSave = kind === 'save';

  const save = async () => {
    if (n <= 0) {
      Alert.alert('Missing amount', 'Enter how much you are putting aside.');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() - days.indexOf(day));
    d.setHours(12, 0, 0, 0);
    await insertSaving({ kind, amount: n, currency, amount_egp: egp, saved_at: d.getTime(), note: note.trim(), hidden: hidden ? 1 : 0 });
    success();
    props.onSaved();
  };

  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SheetHeader title={isSave ? 'Put aside' : 'Withdraw'} onClose={props.onClose} onSave={save} top={insets.top} />
        <KeyboardScroll contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <View style={styles.toggle}>
            {(['save', 'withdraw'] as SavingKind[]).map((k) => {
              const active = kind === k;
              const c = k === 'save' ? colors.brass : colors.bad;
              return (
                <Scale
                  key={k}
                  onPress={() => setKind(k)}
                  style={[styles.toggleItem, active && { backgroundColor: k === 'save' ? colors.brassSoft : colors.badSoft, borderColor: `${c}66` }]}
                >
                  <Icon name={k === 'save' ? 'arrow-down' : 'arrow-up'} size={16} color={active ? c : colors.muted} />
                  <Text style={[styles.toggleText, active && { color: c }]}>{k === 'save' ? 'Save' : 'Withdraw'}</Text>
                </Scale>
              );
            })}
          </View>
          <View style={styles.preview}>
            <Eyebrow>{isSave ? 'Into savings' : 'Out of savings'}</Eyebrow>
            <Serif size={48} style={{ marginTop: 4, color: n > 0 ? (isSave ? colors.brassHi : colors.bad) : colors.text }}>
              {formatMoney(egp, '').trim() || '0'}
            </Serif>
            <Text style={styles.previewNote}>
              {isSave ? "Comes out of this month's net" : "Goes back into this month's net"}
            </Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1.6, marginRight: 10 }}>
              <Input label="Amount" value={amount} onChange={setAmount} keyboardType="numeric" icon="dollar-sign" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="Currency" value={currency} options={CURRENCIES} onChange={(v) => setCurrency(v as Currency)} />
            </View>
          </View>
          <Select label="Date" value={day} options={days} onChange={setDay} icon="calendar" />
          <Input label="Note" value={note} onChange={setNote} icon="edit-3" placeholder="Optional" />
          <Scale onPress={() => setHidden(!hidden)} style={[styles.hideRow, hidden && { borderColor: 'rgba(217,174,98,0.4)' }]}>
            <View style={styles.hideIcon}>
              <Icon name={hidden ? 'eye-off' : 'eye'} size={18} color={hidden ? colors.brass : colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hideTitle}>Hide from the app</Text>
              <Text style={styles.hideText}>Still comes out of net. Only visible when View hidden savings is on.</Text>
            </View>
            <Switch
              value={hidden}
              onValueChange={setHidden}
              trackColor={{ false: colors.surfaceHi, true: colors.brassLo }}
              thumbColor={hidden ? colors.brassHi : colors.muted}
            />
          </Scale>
          <Button title={isSave ? 'Save' : 'Withdraw'} icon="check" onPress={save} style={{ marginTop: 6 }} />
        </KeyboardScroll>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brassSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  bannerText: { color: colors.brass, fontFamily: fonts.semibold, fontSize: 13, marginLeft: 10, flex: 1 },
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
  statsRow: { flexDirection: 'row', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  stat: { flex: 1 },
  statNum: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  statLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.line, marginHorizontal: 10 },
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
  entryHidden: { borderStyle: 'dashed', borderColor: colors.lineStrong },
  entryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  entryTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  entryMeta: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  hiddenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHi,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  hiddenText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 10, marginLeft: 4 },
  amount: { fontFamily: fonts.bold, fontSize: 15 },
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
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
    marginBottom: 16,
  },
  toggleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 15, marginLeft: 8 },
  preview: {
    alignItems: 'center',
    paddingVertical: 22,
    marginBottom: 18,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  previewNote: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  hideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 18,
  },
  hideIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  hideTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  hideText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, marginTop: 2, marginRight: 8 },
});
