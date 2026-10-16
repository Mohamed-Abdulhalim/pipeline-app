import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSources, initDb } from './src/db';
import { rescheduleAll, setupNotifications } from './src/notify';
import IncomeScreen from './src/screens/IncomeScreen';
import PipelineScreen from './src/screens/PipelineScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';

type Tab = 'Pipeline' | 'Income' | 'Settings';
const TABS: { key: Tab; icon: string }[] = [
  { key: 'Pipeline', icon: '◧' },
  { key: 'Income', icon: '◈' },
  { key: 'Settings', icon: '⚙' },
];

function Shell() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('Pipeline');
  const [version, setVersion] = useState(0);
  const [sources, setSources] = useState<string[]>([]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    (async () => {
      await initDb();
      setSources(await getSources());
      setReady(true);
      const allowed = await setupNotifications().catch(() => false);
      if (allowed) await rescheduleAll().catch(() => undefined);
    })();
  }, []);

  useEffect(() => {
    if (ready) getSources().then(setSources);
  }, [version, ready]);

  if (!ready) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const screenProps = { version, sources, bump };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{tab}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'Pipeline' && <PipelineScreen {...screenProps} />}
        {tab === 'Income' && <IncomeScreen {...screenProps} />}
        {tab === 'Settings' && <SettingsScreen {...screenProps} />}
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabIcon, active && { color: colors.accent }]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active && { color: colors.accent }]}>{t.key}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: '800' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabIcon: { color: colors.muted, fontSize: 20 },
  tabLabel: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: '600' },
});
