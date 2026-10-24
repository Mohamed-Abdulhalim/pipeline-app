import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Chip,
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
  deleteExpense,
  deleteIncome,
  getExpensesBetween,
  getIncomeBetween,
  getSavingsBetween,
  getSettings,
  getPlan,
  addMonths,
  getPlanOrCopy,
  insertExpense,
  insertIncome,
  monthKey,
  PlanLine,
  savingsNet,
} from '../db';
import MonthsAheadSheet from './MonthsAheadSheet';
import PlanSheet from './PlanSheet';
import { colors, fonts } from '../theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INCOME_PALETTE = ['#D9AE62', '#7FA6D9', '#7CCB9A', '#A99BE0', '#6CC3C9', '#C9A0C4', '#8A93A6'];
const SPEND_PALETTE = ['#D98585', '#E6B05C', '#A99BE0', '#7FA6D9', '#6CC3C9', '#C9A0C4', '#8A93A6', '#D9AE62'];

type Kind = 'in' | 'out';
type Filter = 'All' | 'Income' | 'Expenses';
type Row = { kind: Kind; id: number; label: string; amount: number; currency: Currency; egp: number; at: number; note: string };

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const prev = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  return { start, end, prev, month: MONTHS[start.getMonth()], year: start.getFullYear() };
}

function group(rows: Row[]): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.label, (m.get(r.label) ?? 0) + r.egp);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function signed(n: number) {
  return `${n < 0 ? '−' : ''}${formatMoney(Math.abs(n))}`;
}

function Breakdown(props: { title: string; items: [string, number][]; colorOf: Map<string, string>; children?: ReactNode }) {
  const total = props.items.reduce((a, [, v]) => a + v, 0);
  return (
    <View style={styles.card}>
      <Eyebrow style={{ marginBottom: 12 }}>{props.title}</Eyebrow>
      <View style={styles.stack}>
        {props.items.map(([name, amt]) => (
          <View key={name} style={{ flex: amt, backgroundColor: props.colorOf.get(name), marginRight: 2 }} />
        ))}
      </View>
      {props.children}
      <View style={{ marginTop: 8 }}>
        {props.items.map(([name, amt], i) => (
          <View key={name} style={[styles.sourceRow, i === props.items.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[styles.swatch, { backgroundColor: props.colorOf.get(name) }]} />
            <Text style={styles.sourceName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.sourcePct}>{Math.round((amt / total) * 100)}%</Text>
            <Text style={styles.sourceAmt}>{formatMoney(amt)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Bar(props: { value: number; max: number; color: string }) {
  const pct = props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0;
  return (
    <View style={styles.planTrack}>
      <View style={[styles.planFill, { width: `${pct}%`, backgroundColor: props.color }]} />
    </View>
  );
}

function PlanCard(props: {
  lines: PlanLine[];
  carried: boolean;
  editable: boolean;
  received: number;
  savedVisible: number;
  byCategory: [string, number][];
  onEdit: (month: string) => void;
  onAhead: () => void;
}) {
  const thisMonth = monthKey(new Date());
  const nextMonth = addMonths(thisMonth, 1);
  const income = props.lines.filter((l) => l.kind === 'income').reduce((a, l) => a + l.amount, 0);
  const budgets = props.lines.filter((l) => l.kind === 'expense');
  const saving = props.lines.find((l) => l.kind === 'saving')?.amount ?? 0;
  const spentMap = new Map(props.byCategory);
  const budgeted = new Set(budgets.map((b) => b.label));
  const unplanned = props.byCategory.filter(([n]) => !budgeted.has(n)).reduce((a, [, v]) => a + v, 0);
  const totalBudget = budgets.reduce((a, b) => a + b.amount, 0);
  const totalSpent = budgets.reduce((a, b) => a + (spentMap.get(b.label) ?? 0), 0) + unplanned;
  const budgetLeft = totalBudget - totalSpent;

  if (!props.lines.length) {
    if (!props.editable) return null;
    return (
      <View style={[styles.card, { marginBottom: 12 }]}>
        <Eyebrow style={{ marginBottom: 6 }}>Monthly plan</Eyebrow>
        <Text style={styles.planEmpty}>Split your expected salary across spending and savings before the month starts, then track it here.</Text>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Button title="Plan this month" variant="ghost" onPress={() => props.onEdit(thisMonth)} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Plan ahead" icon="calendar" onPress={props.onAhead} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  const tone = (spent: number, max: number) => (spent > max ? colors.bad : spent >= max * 0.8 ? colors.warn : colors.good);

  return (
    <View style={[styles.card, { marginBottom: 12 }]}>
      <View style={styles.planHead}>
        <Eyebrow style={{ flex: 1 }}>Plan{props.carried ? ' · carried over' : ''}</Eyebrow>
        {props.editable && (
          <Scale onPress={() => props.onEdit(thisMonth)} style={styles.planEdit}>
            <Icon name="edit-2" size={13} color={colors.brass} />
            <Text style={styles.planEditText}>Edit</Text>
          </Scale>
        )}
      </View>

      <View style={styles.planRow}>
        <Text style={styles.planName}>Income</Text>
        <Text style={styles.planNums}>
          {formatMoney(props.received, '').trim()} / {formatMoney(income)}
        </Text>
      </View>
      <Bar value={props.received} max={income} color={colors.good} />

      {budgets.map((b) => {
        const spent = spentMap.get(b.label) ?? 0;
        return (
          <View key={b.label}>
            <View style={styles.planRow}>
              <Text style={styles.planName} numberOfLines={1}>
                {b.label}
              </Text>
              <Text style={[styles.planNums, spent > b.amount && { color: colors.bad }]}>
                {formatMoney(spent, '').trim()} / {formatMoney(b.amount)}
              </Text>
            </View>
            <Bar value={spent} max={b.amount} color={tone(spent, b.amount)} />
          </View>
        );
      })}

      {unplanned > 0 && (
        <View style={styles.planRow}>
          <Text style={[styles.planName, { color: colors.warn }]}>Unplanned spending</Text>
          <Text style={[styles.planNums, { color: colors.warn }]}>{formatMoney(unplanned)}</Text>
        </View>
      )}

      {saving > 0 && (
        <>
          <View style={styles.planRow}>
            <Text style={styles.planName}>Savings</Text>
            <Text style={styles.planNums}>
              {formatMoney(props.savedVisible, '').trim()} / {formatMoney(saving)}
            </Text>
          </View>
          <Bar value={props.savedVisible} max={saving} color={colors.brass} />
        </>
      )}

      {totalBudget > 0 && (
        <View style={[styles.planFooter, { backgroundColor: budgetLeft >= 0 ? colors.goodSoft : colors.badSoft }]}>
          <Icon name={budgetLeft >= 0 ? 'check-circle' : 'alert-triangle'} size={14} color={budgetLeft >= 0 ? colors.good : colors.bad} />
          <Text style={[styles.planFooterText, { color: budgetLeft >= 0 ? colors.good : colors.bad }]}>
            {budgetLeft >= 0 ? `${formatMoney(budgetLeft)} left in your spending budget` : `${formatMoney(-budgetLeft)} over your spending budget`}
          </Text>
        </View>
      )}

      {props.editable && (
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Button title="Next month" icon="calendar" variant="ghost" onPress={() => props.onEdit(nextMonth)} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Months ahead" icon="list" variant="ghost" onPress={props.onAhead} style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

export default function MoneyScreen(props: {
  version: number;
  sources: string[];
  categories: string[];
  bump: () => void;
  bottomSpace: number;
}) {
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [prevNet, setPrevNet] = useState<number | null>(null);
  const [savedAll, setSavedAll] = useState(0);
  const [savedVisible, setSavedVisible] = useState(0);
  const [filter, setFilter] = useState<Filter>('All');
  const [formOpen, setFormOpen] = useState(false);
  const [plan, setPlan] = useState<PlanLine[]>([]);
  const [planCarried, setPlanCarried] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planMonth, setPlanMonth] = useState(monthKey(new Date()));
  const [aheadOpen, setAheadOpen] = useState(false);
  const range = useMemo(() => monthRange(offset), [offset]);

  const load = useCallback(async () => {
    const [inc, exp, pInc, pExp, sav, pSav, settings] = await Promise.all([
      getIncomeBetween(range.start.getTime(), range.end.getTime()),
      getExpensesBetween(range.start.getTime(), range.end.getTime()),
      getIncomeBetween(range.prev.getTime(), range.start.getTime()),
      getExpensesBetween(range.prev.getTime(), range.start.getTime()),
      getSavingsBetween(range.start.getTime(), range.end.getTime()),
      getSavingsBetween(range.prev.getTime(), range.start.getTime()),
      getSettings(),
    ]);
    const key = monthKey(range.start);
    if (offset >= 0) {
      const p = await getPlanOrCopy(key);
      setPlan(p.lines);
      setPlanCarried(p.copiedFrom !== null);
    } else {
      setPlan(await getPlan(key));
      setPlanCarried(false);
    }
    setSavedAll(savingsNet(sav, true));
    setSavedVisible(savingsNet(sav, settings.showHidden === 1));
    const merged: Row[] = [
      ...inc.map((r) => ({ kind: 'in' as Kind, id: r.id, label: r.source, amount: r.amount, currency: r.currency, egp: r.amount_egp, at: r.received_at, note: r.note })),
      ...exp.map((r) => ({ kind: 'out' as Kind, id: r.id, label: r.category, amount: r.amount, currency: r.currency, egp: r.amount_egp, at: r.spent_at, note: r.note })),
    ].sort((a, b) => b.at - a.at || (a.kind === b.kind ? b.id - a.id : a.kind === 'in' ? -1 : 1));
    setRows(merged);
    const hadPrev = pInc.length + pExp.length + pSav.length > 0;
    setPrevNet(
      hadPrev
        ? pInc.reduce((a, r) => a + r.amount_egp, 0) - pExp.reduce((a, r) => a + r.amount_egp, 0) - savingsNet(pSav, true)
        : null,
    );
  }, [range, offset]);

  useEffect(() => {
    load();
  }, [load, props.version]);

  const incomeRows = useMemo(() => rows.filter((r) => r.kind === 'in'), [rows]);
  const expenseRows = useMemo(() => rows.filter((r) => r.kind === 'out'), [rows]);
  const received = incomeRows.reduce((a, r) => a + r.egp, 0);
  const spent = expenseRows.reduce((a, r) => a + r.egp, 0);
  const net = received - spent - savedAll;
  const kept = received > 0 ? Math.round((net / received) * 100) : null;
  const delta = prevNet === null ? null : net - prevNet;

  const bySource = useMemo(() => group(incomeRows), [incomeRows]);
  const byCategory = useMemo(() => group(expenseRows), [expenseRows]);
  const sourceColor = useMemo(() => new Map(bySource.map(([n], i) => [n, INCOME_PALETTE[i % INCOME_PALETTE.length]])), [bySource]);
  const categoryColor = useMemo(() => new Map(byCategory.map(([n], i) => [n, SPEND_PALETTE[i % SPEND_PALETTE.length]])), [byCategory]);
  const topShare = received > 0 && bySource.length ? bySource[0][1] / received : 0;

  const visible = filter === 'All' ? rows : filter === 'Income' ? incomeRows : expenseRows;

  const remove = (r: Row) => {
    Alert.alert(r.kind === 'in' ? 'Delete income?' : 'Delete expense?', `${formatMoney(r.amount, r.currency)} · ${r.label}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (r.kind === 'in') await deleteIncome(r.id);
          else await deleteExpense(r.id);
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
        <Eyebrow style={{ color: colors.brass }}>Net · left to spend</Eyebrow>
        <View style={styles.heroRow}>
          <Serif size={52} style={net < 0 ? { color: colors.bad } : undefined}>
            {net < 0 ? '−' : ''}
            {compactMoney(Math.abs(net))}
          </Serif>
          <Text style={styles.heroUnit}>EGP</Text>
        </View>
        {delta !== null && (
          <View style={[styles.delta, { backgroundColor: delta >= 0 ? colors.goodSoft : colors.badSoft }]}>
            <Icon name={delta >= 0 ? 'arrow-up-right' : 'arrow-down-right'} size={13} color={delta >= 0 ? colors.good : colors.bad} />
            <Text style={[styles.deltaText, { color: delta >= 0 ? colors.good : colors.bad }]}>
              {delta >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(delta))} vs last month
            </Text>
          </View>
        )}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.good }]}>{compactMoney(received)}</Text>
            <Text style={styles.statLabel}>Received</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.bad }]}>{compactMoney(spent)}</Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.brassHi }]}>{compactMoney(savedVisible)}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, kept !== null && kept < 0 && { color: colors.bad }]}>{kept === null ? '–' : `${kept}%`}</Text>
            <Text style={styles.statLabel}>Left</Text>
          </View>
        </View>
        {received > 0 && (
          <View style={styles.spendTrack}>
            <View style={[styles.spendFill, { width: `${Math.min(100, (spent / received) * 100)}%`, backgroundColor: spent > received ? colors.bad : colors.warn }]} />
          </View>
        )}
        {received > 0 && (
          <Text style={styles.spendNote}>
            {spent > received
              ? `Spent ${formatMoney(spent - received)} more than you received`
              : `Spent ${Math.round((spent / received) * 100)}% of what came in`}
          </Text>
        )}
      </GlowCard>

      <PlanCard
        lines={plan}
        carried={planCarried}
        editable={offset === 0}
        received={received}
        savedVisible={savedVisible}
        byCategory={byCategory}
        onEdit={(m) => {
          setPlanMonth(m);
          setPlanOpen(true);
        }}
        onAhead={() => setAheadOpen(true)}
      />

      {bySource.length > 0 && (
        <Breakdown title="Income by source" items={bySource} colorOf={sourceColor}>
          <View style={styles.depRow}>
            <Icon name={topShare >= 0.7 ? 'alert-triangle' : 'shield'} size={14} color={topShare >= 0.7 ? colors.warn : colors.good} />
            <Text style={[styles.depText, { color: topShare >= 0.7 ? colors.warn : colors.good }]}>
              {Math.round(topShare * 100)}% from {bySource[0][0]}
              {topShare >= 0.7 ? '. Too dependent on one source.' : '. Healthy spread.'}
            </Text>
          </View>
        </Breakdown>
      )}

      {byCategory.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Breakdown title="Spending by category" items={byCategory} colorOf={categoryColor} />
        </View>
      )}

      {rows.length > 0 && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
            <Chip label="All" count={rows.length} active={filter === 'All'} color={colors.brass} onPress={() => setFilter('All')} />
            <Chip label="Income" count={incomeRows.length} active={filter === 'Income'} color={colors.good} onPress={() => setFilter('Income')} />
            <Chip label="Expenses" count={expenseRows.length} active={filter === 'Expenses'} color={colors.bad} onPress={() => setFilter('Expenses')} />
          </ScrollView>
          <Eyebrow style={{ marginTop: 14, marginBottom: 10, marginLeft: 2 }}>Hold an entry to delete it</Eyebrow>
        </>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={visible}
        keyExtractor={(r) => `${r.kind}-${r.id}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: props.bottomSpace + 70 }}
        ListEmptyComponent={
          rows.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="repeat" size={26} color={colors.brass} />
              </View>
              <Serif size={26}>Nothing logged yet</Serif>
              <Text style={styles.emptyText}>Log money the day it lands and spending the day it leaves. Net works itself out.</Text>
            </View>
          ) : (
            <Text style={[styles.emptyText, { paddingHorizontal: 40 }]}>Nothing in this filter this month.</Text>
          )
        }
        renderItem={({ item }) => {
          const isIn = item.kind === 'in';
          const tint = (isIn ? sourceColor.get(item.label) : categoryColor.get(item.label)) ?? (isIn ? colors.good : colors.bad);
          return (
            <Scale onLongPress={() => remove(item)} style={{ paddingHorizontal: 20 }}>
              <View style={styles.entry}>
                <View style={[styles.entryIcon, { backgroundColor: `${tint}1F` }]}>
                  <Icon name={isIn ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entrySource}>{item.label}</Text>
                  <Text style={styles.entryMeta} numberOfLines={1}>
                    {new Date(item.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {item.note ? ` · ${item.note}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amount, { color: isIn ? colors.good : colors.bad }]}>
                    {isIn ? '+' : '−'}
                    {formatMoney(item.egp)}
                  </Text>
                  {item.currency !== 'EGP' && <Text style={styles.entryMeta}>{formatMoney(item.amount, item.currency)}</Text>}
                </View>
              </View>
            </Scale>
          );
        }}
      />
      <Fab icon="plus" bottom={props.bottomSpace} onPress={() => setFormOpen(true)} />
      <MonthsAheadSheet
        visible={aheadOpen}
        version={props.version}
        onClose={() => setAheadOpen(false)}
        onPick={(m) => {
          setPlanMonth(m);
          setPlanOpen(true);
        }}
      />
      <PlanSheet
        visible={planOpen}
        initialMonth={planMonth}
        sources={props.sources}
        categories={props.categories}
        onClose={() => setPlanOpen(false)}
        onSaved={() => {
          setPlanOpen(false);
          props.bump();
        }}
      />
      <MoneyForm
        visible={formOpen}
        initialKind={filter === 'Expenses' ? 'out' : 'in'}
        sources={props.sources}
        categories={props.categories}
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

function MoneyForm(props: {
  visible: boolean;
  initialKind: Kind;
  sources: string[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>('in');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('EGP');
  const [day, setDay] = useState('Today');
  const [note, setNote] = useState('');
  const [rate, setRate] = useState(50);
  const days = useMemo(dayOptions, [props.visible]);

  const listFor = useCallback((k: Kind) => (k === 'in' ? props.sources : props.categories), [props.sources, props.categories]);

  useEffect(() => {
    if (!props.visible) return;
    setKind(props.initialKind);
    setLabel(listFor(props.initialKind)[0] ?? '');
    setAmount('');
    setCurrency('EGP');
    setDay('Today');
    setNote('');
    getSettings().then((s) => setRate(s.usdRate));
  }, [props.visible, props.initialKind, listFor]);

  const switchKind = (k: Kind) => {
    if (k === kind) return;
    setKind(k);
    setLabel(listFor(k)[0] ?? '');
  };

  const n = Number(amount.replace(/,/g, '')) || 0;
  const egp = currency === 'USD' ? n * rate : n;
  const isIn = kind === 'in';
  const accent = isIn ? colors.good : colors.bad;

  const save = async () => {
    if (!label || n <= 0) {
      Alert.alert('Missing info', `Pick a ${isIn ? 'source' : 'category'} and enter an amount.`);
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() - days.indexOf(day));
    d.setHours(12, 0, 0, 0);
    if (isIn) {
      await insertIncome({ source: label, amount: n, currency, amount_egp: egp, received_at: d.getTime(), note: note.trim() });
    } else {
      await insertExpense({ category: label, amount: n, currency, amount_egp: egp, spent_at: d.getTime(), note: note.trim() });
    }
    success();
    props.onSaved();
  };

  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SheetHeader title={isIn ? 'Log income' : 'Log expense'} onClose={props.onClose} onSave={save} top={insets.top} />
        <KeyboardScroll contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <View style={styles.toggle}>
            {(['in', 'out'] as Kind[]).map((k) => {
              const active = kind === k;
              const c = k === 'in' ? colors.good : colors.bad;
              return (
                <Scale
                  key={k}
                  onPress={() => switchKind(k)}
                  style={[styles.toggleItem, active && { backgroundColor: k === 'in' ? colors.goodSoft : colors.badSoft, borderColor: `${c}66` }]}
                >
                  <Icon name={k === 'in' ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={active ? c : colors.muted} />
                  <Text style={[styles.toggleText, active && { color: c }]}>{k === 'in' ? 'Income' : 'Expense'}</Text>
                </Scale>
              );
            })}
          </View>
          <View style={styles.preview}>
            <Eyebrow>{isIn ? 'Coming in' : 'Going out'}</Eyebrow>
            <Serif size={48} style={{ marginTop: 4, color: n > 0 ? accent : colors.text }}>
              {n > 0 ? (isIn ? '+' : '−') : ''}
              {formatMoney(egp, '').trim() || '0'}
            </Serif>
            {currency === 'USD' && <Text style={styles.entryMeta}>EGP at {rate} per USD</Text>}
          </View>
          <Select
            label={isIn ? 'Source' : 'Category'}
            value={label}
            options={isIn ? props.sources : props.categories}
            onChange={setLabel}
            icon={isIn ? 'briefcase' : 'tag'}
          />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1.6, marginRight: 10 }}>
              <Input label="Amount" value={amount} onChange={setAmount} keyboardType="numeric" icon="dollar-sign" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="Currency" value={currency} options={CURRENCIES} onChange={(v) => setCurrency(v as Currency)} />
            </View>
          </View>
          <Select label={isIn ? 'Received' : 'Spent on'} value={day} options={days} onChange={setDay} icon="calendar" />
          <Input label="Note" value={note} onChange={setNote} icon="edit-3" placeholder="Optional" />
          <Button title={isIn ? 'Save income' : 'Save expense'} icon="check" onPress={save} style={{ marginTop: 6 }} />
        </KeyboardScroll>
      </View>
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
  statsRow: { flexDirection: 'row', marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  stat: { flex: 1 },
  statNum: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  statLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.line, marginHorizontal: 8 },
  spendTrack: { height: 6, borderRadius: 3, backgroundColor: colors.goodSoft, overflow: 'hidden', marginTop: 16 },
  spendFill: { height: 6, borderRadius: 3 },
  spendNote: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: 8 },
  stack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  planHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  planEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brassSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planEditText: { color: colors.brass, fontFamily: fonts.bold, fontSize: 12, marginLeft: 5 },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  planName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, flex: 1, marginRight: 10 },
  planNums: { color: colors.textDim, fontFamily: fonts.bold, fontSize: 13 },
  planTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  planFill: { height: 6, borderRadius: 3 },
  planFooter: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14 },
  planFooterText: { fontFamily: fonts.semibold, fontSize: 13, marginLeft: 8, flex: 1 },
  planEmpty: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
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
});
