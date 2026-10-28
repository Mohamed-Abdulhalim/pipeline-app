import { lh, monthName as i18nMonth, t, tv } from '../i18n';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Eyebrow, formatMoney, Icon, IconName, KeyboardScroll, Select, SheetHeader, success, useKeyboardFocus } from '../components/ui';
import {
  addCategory,
  addSubcategory,
  getCategories,
  getDueDays,
  setDueDay,
  getPlan,
  getSubcategories,
  PlanKind,
  removeCategory,
  removeSubcategory,
  saveCategoryOrder,
  saveSubcategoryOrder,
  renameCategory,
  renameSubcategory,
  savePlan,
  SUB_SEP,
} from '../db';
import { playKaChing } from '../sound';
import { colors, fonts } from '../theme';

export const PLAN_HORIZON = 12;

export function monthName(key: string) {
  return i18nMonth(Number(key.slice(5, 7)) - 1) ?? key;
}



const k = (kind: PlanKind, label: string) => `${kind}|${label}`;
const subLabel = (cat: string, sub: string) => `${cat}${SUB_SEP}${sub}`;
const num = (v: string | undefined) => Number((v ?? '').replace(/,/g, '')) || 0;

type Menu = { cat: string; sub?: string } | null;
type Prompt = { mode: 'addCat' | 'renameCat' | 'addSub' | 'renameSub'; cat?: string; sub?: string; text: string; day: number } | null;
type SortMode = 'manual' | 'amount' | 'date';

function readSort(): SortMode {
  try {
    const v = Storage.getItemSync('planSort');
    return v === 'amount' || v === 'date' ? v : 'manual';
  } catch {
    return 'manual';
  }
}

const SORT_LABELS = (): Record<SortMode, string> => ({ manual: t('My order'), amount: t('Amount, highest first'), date: t('Due date, earliest first') });

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

function MoreButton(props: { onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} hitSlop={8} style={styles.more}>
      <Icon name="more-horizontal" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function AmountRow(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
  indent?: boolean;
  due?: number;
  onMenu?: () => void;
  onCommit?: () => void;
}) {
  const kb = useKeyboardFocus();
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const latest = useRef(props.value);
  latest.current = props.value;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const fire = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (dirty.current) {
      dirty.current = false;
      if (num(latest.current) > 0) props.onCommit?.();
    }
  };

  const change = (v: string) => {
    props.onChange(v);
    if (props.onCommit) {
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fire, 900);
    }
  };

  return (
    <Pressable onPress={() => setEditing(true)} style={[styles.row, props.indent && styles.rowIndent, editing && { borderColor: props.accent }]}>
      <View style={styles.rowLabelWrap}>
        <Text style={[styles.rowLabel, props.indent && styles.rowLabelSub]} numberOfLines={1}>
          {tv(props.label)}
        </Text>
        {!!props.due && <Text style={styles.rowDue}>{t('Due day {n}', { n: props.due })}</Text>}
      </View>
      {editing ? (
        <TextInput
          ref={kb.ref}
          autoFocus
          selectTextOnFocus
          style={styles.rowInput}
          value={props.value}
          onChangeText={change}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.muted}
          selectionColor={props.accent}
          cursorColor={props.accent}
          onFocus={kb.onFocus}
          onBlur={() => {
            setEditing(false);
            fire();
          }}
        />
      ) : (
        <Text style={[styles.rowInput, styles.rowValue, !props.value && { color: colors.muted }]} numberOfLines={1}>
          {props.value || '0'}
        </Text>
      )}
      <Text style={styles.rowUnit}>{tv('EGP')}</Text>
      {props.onMenu && <MoreButton onPress={props.onMenu} />}
    </Pressable>
  );
}

function GroupRow(props: { label: string; total: number; due?: number; onMenu: () => void }) {
  return (
    <View style={[styles.row, styles.groupRow]}>
      <View style={styles.rowLabelWrap}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {tv(props.label)}
        </Text>
        {!!props.due && <Text style={styles.rowDue}>{t('Due day {n}', { n: props.due })}</Text>}
      </View>
      <Text style={[styles.rowInput, styles.rowValue, { color: colors.bad }]} numberOfLines={1}>
        {formatMoney(props.total, '').trim()}
      </Text>
      <Text style={styles.rowUnit}>{tv('EGP')}</Text>
      <MoreButton onPress={props.onMenu} />
    </View>
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

function ActionSheet(props: {
  title: string;
  actions: { label: string; icon: IconName; danger?: boolean; onPress: () => void }[];
  onClose: () => void;
  bottom: number;
}) {
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: props.bottom + 14 }]} onPress={() => undefined}>
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {props.title}
          </Text>
          {props.actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} style={styles.action}>
              <Icon name={a.icon} size={18} color={a.danger ? colors.bad : colors.text} />
              <Text style={[styles.actionText, a.danger && { color: colors.bad }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NamePrompt(props: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  day: number;
  onDay: (d: number) => void;
  onCancel: () => void;
  onDone: () => void;
  top: number;
}) {
  const none = t('No date');
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={props.onCancel}>
      <View style={[styles.backdrop, { justifyContent: 'flex-start', paddingTop: props.top + 70, paddingHorizontal: 20 }]}>
        <View style={styles.promptCard}>
          <Text style={styles.sheetTitle}>{props.title}</Text>
          <TextInput
            autoFocus
            selectTextOnFocus
            style={styles.promptInput}
            value={props.value}
            onChangeText={props.onChange}
            onSubmitEditing={props.onDone}
            returnKeyType="done"
            maxLength={40}
            placeholder={t('Name')}
            placeholderTextColor={colors.muted}
            selectionColor={colors.brass}
            cursorColor={colors.brass}
          />
          <View style={{ marginTop: 12 }}>
            <Select
              label={t('Due day of the month')}
              value={props.day ? String(props.day) : none}
              options={[none, ...DAYS]}
              onChange={(v) => props.onDay(v === none ? 0 : Number(v))}
              icon="calendar"
            />
          </View>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <View style={{ flex: 1, marginEnd: 8 }}>
              <Button title={t('Cancel')} variant="ghost" onPress={props.onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('Done')} icon="check" onPress={props.onDone} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function PlanSheet(props: {
  visible: boolean;
  initialMonth: string;
  sources: string[];
  onClose: () => void;
  onSaved: () => void;
  onCategoriesChanged: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [monthKeyState, setMonthKeyState] = useState(props.initialMonth);
  const [values, setValues] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] });
  const [cats, setCats] = useState<string[]>([]);
  const [subs, setSubs] = useState<Record<string, string[]>>({});
  const [menu, setMenu] = useState<Menu>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [due, setDue] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<SortMode>(readSort);
  const month = { key: monthKeyState, name: monthName(monthKeyState) };
  const sourcesRef = useRef(props.sources);
  sourcesRef.current = props.sources;

  useEffect(() => {
    if (props.visible) setMonthKeyState(props.initialMonth);
  }, [props.visible, props.initialMonth]);

  useEffect(() => {
    if (!props.visible) return;
    let live = true;
    (async () => {
      const [lines, categories, subMap, dueMap] = await Promise.all([getPlan(month.key), getCategories(), getSubcategories(), getDueDays()]);
      if (!live) return;
      const v: Record<string, string> = {};
      for (const l of lines) v[k(l.kind, l.label)] = String(Math.round(l.amount));
      setValues(v);
      setCats(categories);
      setSubs(subMap);
      setDue(dueMap);
      setExtra({
        income: lines.filter((l) => l.kind === 'income' && !sourcesRef.current.includes(l.label)).map((l) => l.label),
        expense: lines.filter((l) => l.kind === 'expense' && !categories.includes(l.label)).map((l) => l.label),
      });
    })();
    return () => {
      live = false;
    };
  }, [props.visible, month.key]);

  const incomeLabels = useMemo(() => [...props.sources, ...extra.income], [props.sources, extra.income]);

  const catTotal = (c: string) => {
    const list = subs[c];
    if (list?.length) return list.reduce((a, s) => a + num(values[k('sub', subLabel(c, s))]), 0);
    return num(values[k('expense', c)]);
  };

  const dueOf = (cat: string, sub?: string) => due[sub ? subLabel(cat, sub) : cat] ?? 0;
  const ordered = (list: string[], amountOf: (n: string) => number, dueFor: (n: string) => number) => {
    if (sortMode === 'amount') return [...list].sort((a, b) => amountOf(b) - amountOf(a));
    if (sortMode === 'date') return [...list].sort((a, b) => (dueFor(a) || 99) - (dueFor(b) || 99));
    return list;
  };
  const shownCats = ordered(cats, catTotal, (c) => dueOf(c));
  const shownSubs = (c: string) => ordered(subs[c] ?? [], (n) => num(values[k('sub', subLabel(c, n))]), (n) => dueOf(c, n));

  const income = incomeLabels.reduce((a, l) => a + num(values[k('income', l)]), 0);
  const spending = cats.reduce((a, c) => a + catTotal(c), 0) + extra.expense.reduce((a, l) => a + num(values[k('expense', l)]), 0);
  const saving = num(values[k('saving', 'Savings')]);
  const left = income - spending - saving;
  const leftColor = left < 0 ? colors.bad : left > 0 ? colors.warn : colors.good;

  const set = (key: string) => (v: string) => setValues((cur) => ({ ...cur, [key]: v.replace(/[^0-9.,]/g, '') }));

  const buildLines = () => {
    const lines: { kind: PlanKind; label: string; amount: number }[] = [
      ...incomeLabels.map((label) => ({ kind: 'income' as PlanKind, label, amount: num(values[k('income', label)]) })),
      ...extra.expense.map((label) => ({ kind: 'expense' as PlanKind, label, amount: num(values[k('expense', label)]) })),
    ];
    for (const c of cats) {
      lines.push({ kind: 'expense', label: c, amount: catTotal(c) });
      for (const s of subs[c] ?? []) lines.push({ kind: 'sub', label: subLabel(c, s), amount: num(values[k('sub', subLabel(c, s))]) });
    }
    lines.push({ kind: 'saving', label: 'Savings', amount: saving });
    return lines;
  };

  const save = async () => {
    await savePlan(month.key, buildLines());
    success();
    props.onSaved();
  };

  const closeMenus = () => {
    setMenu(null);
    setPrompt(null);
  };

  const duplicate = () => Alert.alert(t('Name already used'), t('Pick a different name.'));

  const submitPrompt = async () => {
    if (!prompt) return;
    const name = prompt.text.trim();
    if (!name) return;
    if (prompt.mode === 'addCat') {
      if (cats.includes(name)) return duplicate();
      await addCategory(name, prompt.day);
      setCats([...cats, name]);
    } else if (prompt.mode === 'renameCat' && prompt.cat) {
      const from = prompt.cat;
      if (!(await renameCategory(from, name))) return duplicate();
      await setDueDay(name, undefined, prompt.day);
      setCats(cats.map((c) => (c === from ? name : c)));
      setSubs((cur) => {
        const { [from]: list, ...rest } = cur;
        return list ? { ...rest, [name]: list } : rest;
      });
      setValues((cur) => {
        const out: Record<string, string> = {};
        for (const [key, val] of Object.entries(cur)) {
          if (key === k('expense', from)) out[k('expense', name)] = val;
          else if (key.startsWith(k('sub', from + SUB_SEP))) out[k('sub', name + key.slice(k('sub', from).length))] = val;
          else out[key] = val;
        }
        return out;
      });
    } else if (prompt.mode === 'addSub' && prompt.cat) {
      const cat = prompt.cat;
      if (!(await addSubcategory(cat, name, prompt.day))) return duplicate();
      const first = !(subs[cat]?.length);
      setSubs((cur) => ({ ...cur, [cat]: [...(cur[cat] ?? []), name] }));
      if (first) {
        setValues((cur) => {
          const carried = cur[k('expense', cat)];
          if (!carried) return cur;
          const { [k('expense', cat)]: _drop, ...rest } = cur;
          return { ...rest, [k('sub', subLabel(cat, name))]: carried };
        });
      }
    } else if (prompt.mode === 'renameSub' && prompt.cat && prompt.sub) {
      const { cat, sub } = prompt;
      if (!(await renameSubcategory(cat, sub, name))) return duplicate();
      await setDueDay(cat, name, prompt.day);
      setSubs((cur) => ({ ...cur, [cat]: (cur[cat] ?? []).map((s) => (s === sub ? name : s)) }));
      setValues((cur) => {
        const out: Record<string, string> = {};
        for (const [key, val] of Object.entries(cur)) {
          out[key === k('sub', subLabel(cat, sub)) ? k('sub', subLabel(cat, name)) : key] = val;
        }
        return out;
      });
    }
    setDue(await getDueDays());
    setPrompt(null);
    props.onCategoriesChanged();
  };

  const confirmDelete = (cat: string, sub?: string) => {
    const title = sub ? t('Delete subcategory?') : t('Delete category?');
    const body = sub
      ? t('Past expenses keep their label.')
      : t('Past expenses keep their label. Its subcategories are removed too.');
    Alert.alert(title, `${tv(sub ?? cat)}\n${body}`, [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          if (sub) {
            await removeSubcategory(cat, sub);
            setSubs((cur) => ({ ...cur, [cat]: (cur[cat] ?? []).filter((s) => s !== sub) }));
            setValues((cur) => {
              const { [k('sub', subLabel(cat, sub))]: _drop, ...rest } = cur;
              return rest;
            });
          } else {
            await removeCategory(cat);
            setCats((cur) => cur.filter((c) => c !== cat));
            setSubs((cur) => {
              const { [cat]: _drop, ...rest } = cur;
              return rest;
            });
          }
          props.onCategoriesChanged();
        },
      },
    ]);
  };

  const move = async (cat: string, sub: string | undefined, dir: -1 | 1) => {
    const list = sub ? subs[cat] ?? [] : cats;
    const key = sub ?? cat;
    const i = list.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    if (sub) {
      setSubs((cur) => ({ ...cur, [cat]: next }));
      await saveSubcategoryOrder(cat, next);
    } else {
      setCats(next);
      await saveCategoryOrder(next);
    }
    props.onCategoriesChanged();
  };

  const moveActions = (cat: string, sub?: string) => {
    if (sortMode !== 'manual') return [];
    const list = sub ? subs[cat] ?? [] : cats;
    const i = list.indexOf(sub ?? cat);
    const out: { label: string; icon: IconName; onPress: () => void }[] = [];
    if (i > 0) out.push({ label: t('Move up'), icon: 'arrow-up', onPress: () => { setMenu(null); move(cat, sub, -1); } });
    if (i >= 0 && i < list.length - 1) out.push({ label: t('Move down'), icon: 'arrow-down', onPress: () => { setMenu(null); move(cat, sub, 1); } });
    return out;
  };

  const menuActions = () => {
    if (!menu) return [];
    const { cat, sub } = menu;
    if (sub) {
      return [
        ...moveActions(cat, sub),
        { label: t('Edit'), icon: 'edit-2' as IconName, onPress: () => { setMenu(null); setPrompt({ mode: 'renameSub', cat, sub, text: sub, day: dueOf(cat, sub) }); } },
        { label: t('Delete'), icon: 'trash-2' as IconName, danger: true, onPress: () => { setMenu(null); confirmDelete(cat, sub); } },
      ];
    }
    return [
      ...moveActions(cat),
      { label: t('Edit'), icon: 'edit-2' as IconName, onPress: () => { setMenu(null); setPrompt({ mode: 'renameCat', cat, text: cat, day: dueOf(cat) }); } },
      { label: t('Add subcategory'), icon: 'corner-down-right' as IconName, onPress: () => { setMenu(null); setPrompt({ mode: 'addSub', cat, text: '', day: 0 }); } },
      { label: t('Delete'), icon: 'trash-2' as IconName, danger: true, onPress: () => { setMenu(null); confirmDelete(cat); } },
    ];
  };

  const promptTitle = () => {
    if (!prompt) return '';
    if (prompt.mode === 'addCat') return t('New category');
    if (prompt.mode === 'renameCat') return t('Edit category');
    if (prompt.mode === 'addSub') return t('New subcategory in {cat}', { cat: tv(prompt.cat ?? '') });
    return t('Edit subcategory');
  };

  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SheetHeader title={t('Plan {month}', { month: `${month.name} ${month.key.slice(0, 4)}` })} onClose={props.onClose} onSave={save} top={insets.top} />
        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.summary}>
            <View style={styles.sumCol}>
              <Text style={[styles.sumNum, { color: colors.good }]}>{formatMoney(income, '').trim()}</Text>
              <Text style={styles.sumLabel}>{t('Expected')}</Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumCol}>
              <Text style={styles.sumNum}>{formatMoney(spending + saving, '').trim()}</Text>
              <Text style={styles.sumLabel}>{t('Assigned')}</Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumCol}>
              <Text style={[styles.sumNum, { color: leftColor }]}>
                {left < 0 ? '−' : ''}
                {formatMoney(Math.abs(left), '').trim()}
              </Text>
              <Text style={styles.sumLabel}>{left < 0 ? t('Over-assigned') : t('Left to assign')}</Text>
            </View>
          </View>
        </View>
        <KeyboardScroll contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: insets.bottom + 40 }}>
          <Section title={t('Expected income')} icon="arrow-down-left" total={income} accent={colors.good}>
            {incomeLabels.map((l) => (
              <AmountRow key={l} label={l} value={values[k('income', l)] ?? ''} onChange={set(k('income', l))} accent={colors.good} onCommit={playKaChing} />
            ))}
          </Section>
          <Section title={t('Spending budget')} icon="arrow-up-right" total={spending} accent={colors.bad}>
            <Select
              label={t('Sort by')}
              value={SORT_LABELS()[sortMode]}
              options={Object.values(SORT_LABELS())}
              icon="bar-chart-2"
              onChange={(v) => {
                const next = (Object.keys(SORT_LABELS()) as SortMode[]).find((m) => SORT_LABELS()[m] === v) ?? 'manual';
                setSortMode(next);
                try {
                  Storage.setItemSync('planSort', next);
                } catch {
                  return;
                }
              }}
            />
            {extra.expense.map((l) => (
              <AmountRow key={l} label={l} value={values[k('expense', l)] ?? ''} onChange={set(k('expense', l))} accent={colors.bad} />
            ))}
            {shownCats.map((c) => {
              const list = shownSubs(c);
              if (!list.length) {
                return (
                  <AmountRow
                    key={c}
                    label={c}
                    value={values[k('expense', c)] ?? ''}
                    onChange={set(k('expense', c))}
                    accent={colors.bad}
                    due={dueOf(c)}
                    onMenu={() => setMenu({ cat: c })}
                  />
                );
              }
              return (
                <View key={c}>
                  <GroupRow label={c} total={catTotal(c)} due={dueOf(c)} onMenu={() => setMenu({ cat: c })} />
                  {list.map((sName) => (
                    <AmountRow
                      key={sName}
                      indent
                      label={sName}
                      value={values[k('sub', subLabel(c, sName))] ?? ''}
                      onChange={set(k('sub', subLabel(c, sName)))}
                      accent={colors.bad}
                      due={dueOf(c, sName)}
                      onMenu={() => setMenu({ cat: c, sub: sName })}
                    />
                  ))}
                </View>
              );
            })}
            <Pressable onPress={() => setPrompt({ mode: 'addCat', text: '', day: 0 })} style={styles.addCat}>
              <Icon name="plus" size={16} color={colors.brass} />
              <Text style={styles.addCatText}>{t('Add category')}</Text>
            </Pressable>
          </Section>
          <Section title={t('Savings')} icon="archive" total={saving} accent={colors.brass}>
            <AmountRow label={t('Put aside')} value={values[k('saving', 'Savings')] ?? ''} onChange={set(k('saving', 'Savings'))} accent={colors.brass} />
          </Section>
          <Text style={styles.hint}>
            {t('Leave a field empty to skip it. Tap the dots on a category to rename it, add subcategories or delete it. Amounts are in EGP.')}
          </Text>
          <Button title={t('Save {month} plan', { month: month.name })} icon="check" onPress={save} />
        </KeyboardScroll>
        {menu && (
          <ActionSheet
            title={tv(menu.sub ?? menu.cat)}
            actions={menuActions()}
            onClose={() => setMenu(null)}
            bottom={insets.bottom}
          />
        )}
        {prompt && (
          <NamePrompt
            title={promptTitle()}
            value={prompt.text}
            onChange={(text) => setPrompt({ ...prompt, text })}
            day={prompt.day}
            onDay={(day) => setPrompt({ ...prompt, day })}
            onCancel={closeMenus}
            onDone={submitPrompt}
            top={insets.top}
          />
        )}
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
  bannerText: { color: colors.brass, fontFamily: fonts.semibold, fontSize: 13, marginStart: 10, flex: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginEnd: 10 },
  sectionTotal: { fontFamily: fonts.bold, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingStart: 14,
    paddingEnd: 12,
    minHeight: 54,
    paddingVertical: 6,
    marginBottom: 8,
  },
  rowLabelWrap: { flex: 1, marginEnd: 10 },
  rowLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  rowDue: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 1 },
  rowInput: {
    width: 120,
    textAlign: 'right',
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    paddingVertical: 8,
  },
  rowValue: { paddingVertical: 10 },
  rowIndent: { marginStart: 18, minHeight: 48, backgroundColor: colors.bg },
  rowLabelSub: { fontFamily: fonts.medium, fontSize: 14, color: colors.textDim },
  groupRow: { backgroundColor: colors.badSoft, borderColor: 'transparent' },
  more: { width: 30, height: 30, marginStart: 4, marginEnd: -6, alignItems: 'center', justifyContent: 'center' },
  addCat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    marginTop: 2,
  },
  addCatText: { color: colors.brass, fontFamily: fonts.semibold, fontSize: 14, marginStart: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  sheetTitle: { color: colors.textDim, fontFamily: fonts.bold, fontSize: 13, marginBottom: 10 },
  action: { flexDirection: 'row', alignItems: 'center', height: 52 },
  actionText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16, marginStart: 14 },
  promptCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  promptInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brass,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 16,
    paddingHorizontal: 14,
  },
  rowUnit: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, marginStart: 6 },
  hint: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, lineHeight: lh(18), marginBottom: 16 },
});
