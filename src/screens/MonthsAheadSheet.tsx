import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { compactMoney, Eyebrow, GlowCard, Icon, Scale, Serif, SheetHeader } from '../components/ui';
import { getPlansAhead, monthKey, MonthPlan } from '../db';
import { colors, fonts } from '../theme';
import { monthLabel, monthName, PLAN_HORIZON } from './PlanSheet';

function totals(p: MonthPlan) {
  const sum = (kind: string) => p.lines.filter((l) => l.kind === kind).reduce((a, l) => a + l.amount, 0);
  const income = sum('income');
  const spending = sum('expense');
  const saving = sum('saving');
  return { income, spending, saving, left: income - spending - saving };
}

export default function MonthsAheadSheet(props: {
  visible: boolean;
  version: number;
  onClose: () => void;
  onPick: (month: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [months, setMonths] = useState<MonthPlan[]>([]);

  useEffect(() => {
    if (!props.visible) return;
    getPlansAhead(monthKey(new Date()), PLAN_HORIZON).then(setMonths);
  }, [props.visible, props.version]);

  const all = months.map(totals);
  const projIncome = all.reduce((a, t) => a + t.income, 0);
  const projSpend = all.reduce((a, t) => a + t.spending, 0);
  const projSave = all.reduce((a, t) => a + t.saving, 0);
  const planned = months.filter((m) => m.lines.length).length;
  const last = months[months.length - 1];

  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SheetHeader title="Months ahead" onClose={props.onClose} top={insets.top} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <GlowCard style={{ marginBottom: 20 }}>
            <Eyebrow style={{ color: colors.brass }}>
              Projected savings{last ? ` by end of ${monthLabel(last.month)}` : ''}
            </Eyebrow>
            <View style={styles.heroRow}>
              <Serif size={48}>{compactMoney(projSave)}</Serif>
              <Text style={styles.heroUnit}>EGP</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.good }]}>{compactMoney(projIncome)}</Text>
                <Text style={styles.statLabel}>Expected income</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.bad }]}>{compactMoney(projSpend)}</Text>
                <Text style={styles.statLabel}>Planned spending</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statNum}>
                  {planned}/{months.length}
                </Text>
                <Text style={styles.statLabel}>Months planned</Text>
              </View>
            </View>
            <Text style={styles.heroNote}>If every month goes exactly to plan. Real months will drift; check the Money tab.</Text>
          </GlowCard>

          <Eyebrow style={{ marginBottom: 10, marginLeft: 2 }}>Tap a month to edit it</Eyebrow>
          {months.map((m, i) => {
            const t = all[i];
            const leftColor = t.left < 0 ? colors.bad : t.left > 0 ? colors.warn : colors.good;
            const badge = m.own
              ? { text: 'Own plan', color: colors.brass, bg: colors.brassSoft, icon: 'edit-2' as const }
              : m.from
                ? { text: `Follows ${monthName(m.from)}`, color: colors.textDim, bg: colors.surfaceHi, icon: 'corner-down-right' as const }
                : { text: 'No plan', color: colors.muted, bg: colors.surfaceHi, icon: 'minus' as const };
            return (
              <Scale key={m.month} onPress={() => props.onPick(m.month)} style={{ marginBottom: 10 }}>
                <View style={[styles.card, i === 0 && { borderColor: 'rgba(217,174,98,0.35)' }]}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.month}>{monthLabel(m.month)}</Text>
                      {i === 0 && <Text style={styles.now}>This month</Text>}
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Icon name={badge.icon} size={11} color={badge.color} />
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.muted} />
                  </View>
                  {m.lines.length > 0 && (
                    <View style={styles.nums}>
                      <View style={styles.numCol}>
                        <Text style={[styles.num, { color: colors.good }]}>{compactMoney(t.income)}</Text>
                        <Text style={styles.numLabel}>Income</Text>
                      </View>
                      <View style={styles.numCol}>
                        <Text style={[styles.num, { color: colors.bad }]}>{compactMoney(t.spending)}</Text>
                        <Text style={styles.numLabel}>Spending</Text>
                      </View>
                      <View style={styles.numCol}>
                        <Text style={[styles.num, { color: colors.brassHi }]}>{compactMoney(t.saving)}</Text>
                        <Text style={styles.numLabel}>Savings</Text>
                      </View>
                      <View style={styles.numCol}>
                        <Text style={[styles.num, { color: leftColor }]}>
                          {t.left < 0 ? '−' : ''}
                          {compactMoney(Math.abs(t.left))}
                        </Text>
                        <Text style={styles.numLabel}>{t.left < 0 ? 'Over' : 'Unassigned'}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </Scale>
            );
          })}
          <Text style={styles.foot}>
            A month without its own plan follows the latest planned month before it. Amounts are in EGP.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  heroUnit: { color: colors.textDim, fontFamily: fonts.semibold, fontSize: 15, marginLeft: 8, marginBottom: 9 },
  heroNote: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: 14, lineHeight: 17 },
  statsRow: { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  stat: { flex: 1 },
  statNum: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  statLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.line, marginHorizontal: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  month: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  now: { color: colors.brass, fontFamily: fonts.semibold, fontSize: 11, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, marginLeft: 5 },
  nums: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  numCol: { flex: 1 },
  num: { fontFamily: fonts.bold, fontSize: 14 },
  numLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  foot: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, marginTop: 6 },
});
