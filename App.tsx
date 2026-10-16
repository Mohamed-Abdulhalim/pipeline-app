import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eyebrow, Icon, IconName, Scale, Serif } from './src/components/ui';
import { getCategories, getSettings, getSources, initDb, saveSetting } from './src/db';
import { rescheduleAll, setupNotifications } from './src/notify';
import IncomeScreen from './src/screens/IncomeScreen';
import PipelineScreen from './src/screens/PipelineScreen';
import SavingsScreen from './src/screens/SavingsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors, fonts } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: 300 });

type Tab = 'Pipeline' | 'Income' | 'Savings' | 'Settings';
const TABS: { key: Tab; icon: IconName; title: string }[] = [
  { key: 'Pipeline', icon: 'layers', title: 'Pipeline' },
  { key: 'Income', icon: 'trending-up', title: 'Money' },
  { key: 'Savings', icon: 'archive', title: 'Savings' },
  { key: 'Settings', icon: 'sliders', title: 'Settings' },
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MARK_SIZE = 157;

function Intro({ onDone }: { onDone: () => void }) {
  const lift = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(lift, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(word, { toValue: 1, duration: 700, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(450),
      Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => onDone());
  }, [lift, word, fade, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.intro, { opacity: fade }]} pointerEvents="none">
      <Animated.Image
        source={require('./assets/mark.png')}
        style={{
          width: MARK_SIZE,
          height: MARK_SIZE,
          transform: [
            { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) },
            { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) },
          ],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          alignItems: 'center',
          opacity: word,
          transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [78, 58] }) }],
        }}
      >
        <Text style={styles.wordmark}>Pipeline</Text>
        <Text style={styles.tagline}>Every stream, accounted for.</Text>
      </Animated.View>
    </Animated.View>
  );
}

function Shell() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [intro, setIntro] = useState(true);
  const [tab, setTab] = useState<Tab>('Pipeline');
  const [showPipeline, setShowPipeline] = useState(true);
  const [version, setVersion] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const content = useRef(new Animated.Value(0)).current;

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'background') return;
      const s = await getSettings();
      if (s.showHidden === 1) {
        await saveSetting('showHidden', 0);
        bump();
      }
    });
    return () => sub.remove();
  }, [bump]);

  useEffect(() => {
    (async () => {
      await initDb();
      setSources(await getSources());
      setCategories(await getCategories());
      const s = await getSettings();
      setShowPipeline(s.showPipeline === 1);
      if (s.showPipeline !== 1) setTab('Income');
      setDbReady(true);
    })();
  }, []);

  const ready = fontsLoaded && dbReady;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => undefined);
    Animated.timing(content, { toValue: 1, duration: 600, delay: 1250, useNativeDriver: true }).start();
    (async () => {
      const allowed = await setupNotifications().catch(() => false);
      if (allowed) await rescheduleAll().catch(() => undefined);
    })();
  }, [ready, content]);

  useEffect(() => {
    if (!dbReady) return;
    getSources().then(setSources);
    getCategories().then(setCategories);
    getSettings().then((s) => {
      const on = s.showPipeline === 1;
      setShowPipeline(on);
      if (!on) setTab((t) => (t === 'Pipeline' ? 'Income' : t));
    });
  }, [version, dbReady]);

  const finishIntro = useCallback(() => setIntro(false), []);

  if (!ready) return <View style={styles.root} />;

  const tabBarHeight = 66 + Math.max(insets.bottom, 12);
  const screenProps = { version, sources, categories, bump, bottomSpace: tabBarHeight + 16 };
  const now = new Date();
  const tabs = TABS.filter((t) => showPipeline || t.key !== 'Pipeline');
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.bgTop, colors.bg]} style={styles.topGlow} />
      <Animated.View
        style={{
          flex: 1,
          opacity: content,
          transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View>
            <Eyebrow>
              {DAYS[now.getDay()]} · {now.getDate()} {MONTHS[now.getMonth()]}
            </Eyebrow>
            <Serif size={40} style={{ marginTop: 4 }}>
              {current.title}
            </Serif>
          </View>
          <Image source={require('./assets/mark.png')} style={styles.headerMark} />
        </View>
        <View style={{ flex: 1 }}>
          {tab === 'Pipeline' && showPipeline && <PipelineScreen {...screenProps} />}
          {tab === 'Income' && <IncomeScreen {...screenProps} />}
          {tab === 'Savings' && <SavingsScreen {...screenProps} />}
          {tab === 'Settings' && <SettingsScreen {...screenProps} />}
        </View>
        <View style={[styles.tabWrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
          <View style={styles.tabBar}>
            {tabs.map((t) => {
              const active = t.key === tab;
              return (
                <Scale key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)}>
                  <Icon name={t.icon} size={19} color={active ? colors.brass : colors.muted} />
                  <Text style={[styles.tabLabel, active && { color: colors.text }]}>{t.title}</Text>
                </Scale>
              );
            })}
          </View>
        </View>
      </Animated.View>
      {intro && <Intro onDone={finishIntro} />}
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
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  intro: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: colors.text, fontFamily: fonts.serif, fontSize: 44, letterSpacing: 0.5 },
  tagline: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, letterSpacing: 1.2, marginTop: 4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerMark: { width: 54, height: 54, marginBottom: -4, marginRight: -10, opacity: 0.9 },
  tabWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18,22,32,0.97)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 20 },
  tabActive: { backgroundColor: colors.brassSoft },
  tabLabel: { color: colors.muted, fontSize: 11, marginTop: 4, fontFamily: fonts.bold, letterSpacing: 0.4 },
});
