import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Chip,
  compactMoney,
  Eyebrow,
  Fab,
  formatMoney,
  GlowCard,
  Icon,
  Scale,
  Serif,
  success,
} from '../components/ui';
import { getItems, getSettings, Item, OPEN_STAGES, setItemStage, Stage, STAGES } from '../db';
import { rescheduleItem } from '../notify';
import { colors, fonts, stageColors } from '../theme';
import ItemForm from './ItemForm';

type Filter = 'Open' | 'Stale' | Stage;
const FILTERS: Filter[] = ['Open', 'Stale', ...STAGES];
const DAY = 86400000;

function StageRail({ stage }: { stage: Stage }) {
  const idx = STAGES.indexOf(stage);
  const lost = stage === 'Lost';
  return (
    <View style={styles.rail}>
      {STAGES.slice(0, 4).map((s, i) => {
        const filled = lost ? i <= 2 && i < idx : i <= idx;
        const color = lost ? stageColors.Lost : stageColors[stage];
        return (
          <View
            key={s}
            style={[styles.railSeg, { backgroundColor: filled ? color : colors.line, opacity: lost && filled ? 0.5 : 1 }]}
          />
        );
      })}
    </View>
  );
}

export default function PipelineScreen(props: {
  version: number;
  sources: string[];
  bump: () => void;
  bottomSpace: number;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [followupDays, setFollowupDays] = useState(3);
  const [usdRate, setUsdRate] = useState(50);
  const [filter, setFilter] = useState<Filter>('Open');
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    const [rows, settings] = await Promise.all([getItems(), getSettings()]);
    setItems(rows);
    setFollowupDays(settings.followupDays);
    setUsdRate(settings.usdRate);
  }, []);

  useEffect(() => {
    load();
  }, [load, props.version]);

  const isStale = useCallback(
    (it: Item) => OPEN_STAGES.includes(it.stage) && Date.now() - it.touched_at >= followupDays * DAY,
    [followupDays],
  );

  const toEgp = useCallback((it: Item) => (it.currency === 'USD' ? it.value * usdRate : it.value), [usdRate]);

  const visible = useMemo(() => {
    if (filter === 'Open') return items.filter((i) => OPEN_STAGES.includes(i.stage));
    if (filter === 'Stale') return items.filter(isStale);
    return items.filter((i) => i.stage === filter);
  }, [items, filter, isStale]);

  const stats = useMemo(() => {
    const c: Record<string, number> = { Open: 0, Stale: 0 };
    for (const s of STAGES) c[s] = 0;
    let openValue = 0;
    let wonMonth = 0;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    for (const i of items) {
      c[i.stage] += 1;
      if (OPEN_STAGES.includes(i.stage)) {
        c.Open += 1;
        openValue += toEgp(i);
      }
      if (isStale(i)) c.Stale += 1;
      if (i.stage === 'Won' && i.touched_at >= monthStart) wonMonth += 1;
    }
    const closed = c.Won + c.Lost;
    const winRate = closed ? Math.round((c.Won / closed) * 100) : null;
    return { counts: c, openValue, wonMonth, winRate };
  }, [items, isStale, toEgp]);

  const advance = async (it: Item) => {
    const idx = STAGES.indexOf(it.stage);
    if (idx < 0 || idx >= 3) return;
    await setItemStage(it.id, STAGES[idx + 1]);
    await rescheduleItem(it.id);
    if (STAGES[idx + 1] === 'Won') success();
    props.bump();
  };

  const open = (it: Item | null) => {
    setEditing(it);
    setFormOpen(true);
  };

  const header = (
    <View>
      <View style={{ paddingHorizontal: 20 }}>
        <GlowCard style={{ marginBottom: 6 }}>
          <Eyebrow style={{ color: colors.brass }}>Open pipeline value</Eyebrow>
          <View style={styles.heroRow}>
            <Serif size={52}>{compactMoney(stats.openValue)}</Serif>
            <Text style={styles.heroUnit}>EGP</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.counts.Open}</Text>
              <Text style={styles.statLabel}>Open</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, stats.counts.Stale > 0 && { color: colors.warn }]}>{stats.counts.Stale}</Text>
              <Text style={styles.statLabel}>Need follow-up</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.good }]}>{stats.wonMonth}</Text>
              <Text style={styles.statLabel}>Won this month</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.winRate === null ? '–' : `${stats.winRate}%`}</Text>
              <Text style={styles.statLabel}>Win rate</Text>
            </View>
          </View>
        </GlowCard>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={f === 'Stale' ? 'Follow up' : f}
            count={stats.counts[f] ?? 0}
            active={filter === f}
            color={f === 'Stale' ? colors.warn : f === 'Open' ? colors.brass : stageColors[f]}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={visible}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: props.bottomSpace + 70 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name={filter === 'Stale' ? 'check-circle' : 'inbox'} size={26} color={colors.brass} />
            </View>
            <Serif size={26} style={{ textAlign: 'center' }}>
              {filter === 'Stale' ? 'All caught up' : 'Nothing here yet'}
            </Serif>
            <Text style={styles.emptyText}>
              {filter === 'Stale'
                ? 'No open lead has been left waiting too long.'
                : 'Log every lead, application and client conversation. Tap the + button.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const days = Math.floor((Date.now() - item.touched_at) / DAY);
          const stale = isStale(item);
          const canAdvance = OPEN_STAGES.includes(item.stage);
          const next = STAGES[STAGES.indexOf(item.stage) + 1];
          return (
            <Scale onPress={() => open(item)} style={styles.cardWrap}>
              <View style={[styles.card, stale && { borderColor: 'rgba(230,176,92,0.45)' }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.stagePill, { backgroundColor: `${stageColors[item.stage]}1F` }]}>
                    <View style={[styles.stageDot, { backgroundColor: stageColors[item.stage] }]} />
                    <Text style={[styles.stageText, { color: stageColors[item.stage] }]}>{item.stage}</Text>
                  </View>
                  {stale && (
                    <View style={styles.staleBadge}>
                      <Icon name="clock" size={12} color={colors.warn} />
                      <Text style={styles.staleText}>{days}d waiting</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.meta}>
                  {item.source} · {item.kind}
                  {!stale && ` · ${days === 0 ? 'today' : `${days}d ago`}`}
                </Text>
                <StageRail stage={item.stage} />
                <View style={styles.cardBottom}>
                  <Text style={styles.value}>{item.value ? formatMoney(item.value, item.currency) : ' '}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!!item.link && (
                      <Scale onPress={() => Linking.openURL(item.link).catch(() => undefined)} style={styles.iconBtn}>
                        <Icon name="external-link" size={16} color={colors.textDim} />
                      </Scale>
                    )}
                    {canAdvance && (
                      <Scale onPress={() => advance(item)} style={styles.advance}>
                        <Text style={styles.advanceText}>{next}</Text>
                        <Icon name="arrow-right" size={14} color={colors.brass} />
                      </Scale>
                    )}
                  </View>
                </View>
              </View>
            </Scale>
          );
        }}
      />
      <Fab icon="plus" bottom={props.bottomSpace} onPress={() => open(null)} />
      <ItemForm
        visible={formOpen}
        item={editing}
        sources={props.sources}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          props.bump();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  heroUnit: { color: colors.textDim, fontFamily: fonts.semibold, fontSize: 15, marginLeft: 8, marginBottom: 10 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stat: { flex: 1 },
  statNum: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  statLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.line, marginHorizontal: 10 },
  filters: { paddingHorizontal: 20, paddingVertical: 16 },
  cardWrap: { paddingHorizontal: 20, marginBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stagePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  stageDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  stageText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  staleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warnSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  staleText: { color: colors.warn, fontFamily: fonts.bold, fontSize: 11, marginLeft: 5 },
  cardTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.bold, lineHeight: 23 },
  meta: { color: colors.muted, fontSize: 13, fontFamily: fonts.medium, marginTop: 4 },
  rail: { flexDirection: 'row', marginTop: 14, marginBottom: 12 },
  railSeg: { flex: 1, height: 3, borderRadius: 2, marginRight: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { color: colors.textDim, fontFamily: fonts.semibold, fontSize: 14 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHi,
    marginLeft: 8,
  },
  advance: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brassSoft,
    marginLeft: 8,
  },
  advanceText: { color: colors.brass, fontFamily: fonts.bold, fontSize: 13, marginRight: 6 },
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
});
