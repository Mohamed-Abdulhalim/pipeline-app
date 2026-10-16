import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, formatMoney } from '../components/ui';
import { getItems, getSettings, Item, OPEN_STAGES, setItemStage, Stage, STAGES } from '../db';
import { rescheduleItem } from '../notify';
import { colors, stageColors } from '../theme';
import ItemForm from './ItemForm';

type Filter = 'Open' | 'Stale' | Stage;
const FILTERS: Filter[] = ['Open', 'Stale', ...STAGES];
const DAY = 86400000;

export default function PipelineScreen(props: { version: number; sources: string[]; bump: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [followupDays, setFollowupDays] = useState(3);
  const [filter, setFilter] = useState<Filter>('Open');
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    const [rows, settings] = await Promise.all([getItems(), getSettings()]);
    setItems(rows);
    setFollowupDays(settings.followupDays);
  }, []);

  useEffect(() => {
    load();
  }, [load, props.version]);

  const isStale = useCallback(
    (it: Item) => OPEN_STAGES.includes(it.stage) && Date.now() - it.touched_at >= followupDays * DAY,
    [followupDays],
  );

  const visible = useMemo(() => {
    if (filter === 'Open') return items.filter((i) => OPEN_STAGES.includes(i.stage));
    if (filter === 'Stale') return items.filter(isStale);
    return items.filter((i) => i.stage === filter);
  }, [items, filter, isStale]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Open: 0, Stale: 0 };
    for (const s of STAGES) c[s] = 0;
    for (const i of items) {
      c[i.stage] += 1;
      if (OPEN_STAGES.includes(i.stage)) c.Open += 1;
      if (isStale(i)) c.Stale += 1;
    }
    return c;
  }, [items, isStale]);

  const advance = async (it: Item) => {
    const idx = STAGES.indexOf(it.stage);
    if (idx < 0 || idx >= 3) return;
    await setItemStage(it.id, STAGES[idx + 1]);
    await rescheduleItem(it.id);
    props.bump();
  };

  const open = (it: Item | null) => {
    setEditing(it);
    setFormOpen(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={`${f} ${counts[f] ?? 0}`}
              active={filter === f}
              color={f === 'Stale' ? colors.warn : stageColors[f] ?? colors.accent}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'Stale' ? 'Nothing waiting on you. Good.' : 'Nothing here yet. Tap + to log a lead.'}
          </Text>
        }
        renderItem={({ item }) => {
          const days = Math.floor((Date.now() - item.touched_at) / DAY);
          const stale = isStale(item);
          const canAdvance = OPEN_STAGES.includes(item.stage);
          return (
            <Pressable onPress={() => open(item)}>
              <Card style={[styles.card, stale && { borderColor: colors.warn }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.dot, { backgroundColor: stageColors[item.stage] }]} />
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.meta}>
                  {item.stage} · {item.source} · {item.kind}
                </Text>
                <View style={styles.cardBottom}>
                  <Text style={[styles.meta, stale && { color: colors.warn, fontWeight: '700' }]}>
                    {days === 0 ? 'Touched today' : `${days}d since last touch`}
                    {item.value ? ` · ${formatMoney(item.value, item.currency)}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row' }}>
                    {!!item.link && (
                      <Text style={styles.action} onPress={() => Linking.openURL(item.link).catch(() => undefined)}>
                        Open
                      </Text>
                    )}
                    {canAdvance && (
                      <Text style={styles.action} onPress={() => advance(item)}>
                        {STAGES[STAGES.indexOf(item.stage) + 1]} →
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      <Pressable style={styles.fab} onPress={() => open(null)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
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
  filters: { paddingHorizontal: 16, paddingVertical: 12 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 60, fontSize: 15 },
  card: { marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  meta: { color: colors.muted, fontSize: 13 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  action: { color: colors.accent, fontWeight: '700', fontSize: 14, marginLeft: 14, paddingVertical: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36, fontWeight: '400' },
});
