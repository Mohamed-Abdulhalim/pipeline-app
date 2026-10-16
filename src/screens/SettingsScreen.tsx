import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { ReactNode, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { exportBackup, pickBackup, restoreBackup } from '../backup';
import { Button, Eyebrow, Icon, IconName, Input, Scale, Select, Serif, success } from '../components/ui';
import { addCategory, addSource, getSettings, removeCategory, removeSource, saveSetting } from '../db';
import { rescheduleAll } from '../notify';
import { colors, fonts } from '../theme';

const FOLLOWUP_OPTIONS = ['1 day', '2 days', '3 days', '5 days', '7 days', '14 days'];

function Section(props: { title: string; icon: IconName; hint?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 26 }}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Icon name={props.icon} size={15} color={colors.brass} />
        </View>
        <Eyebrow style={{ color: colors.textDim }}>{props.title}</Eyebrow>
      </View>
      <View style={styles.card}>
        {props.hint && <Text style={styles.hint}>{props.hint}</Text>}
        {props.children}
      </View>
    </View>
  );
}

function ListEditor(props: {
  items: string[];
  noun: string;
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');

  const add = async () => {
    const name = value.trim();
    if (!name) return;
    await props.onAdd(name);
    setValue('');
    success();
  };

  const remove = (name: string) => {
    Alert.alert(`Remove ${props.noun}?`, `${name} will disappear from dropdowns. Existing entries keep it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => props.onRemove(name) },
    ]);
  };

  return (
    <>
      {props.items.map((s, i) => (
        <View key={s} style={[styles.sourceRow, i === 0 && { borderTopWidth: 0 }]}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceInitial}>{s.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.sourceName}>{s}</Text>
          <Scale onPress={() => remove(s)} style={styles.removeBtn}>
            <Icon name="x" size={15} color={colors.muted} />
          </Scale>
        </View>
      ))}
      <View style={{ marginTop: 16 }}>
        <Input label={`New ${props.noun}`} value={value} onChange={setValue} icon="plus-circle" placeholder={props.placeholder} />
        <Button title={`Add ${props.noun}`} icon="plus" variant="ghost" onPress={add} />
      </View>
    </>
  );
}

export default function SettingsScreen(props: {
  version: number;
  sources: string[];
  categories: string[];
  bump: () => void;
  bottomSpace: number;
}) {
  const [followup, setFollowup] = useState('3 days');
  const [rate, setRate] = useState('50');
  const [showHidden, setShowHidden] = useState(false);
  const [showPipeline, setShowPipeline] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setFollowup(`${s.followupDays} ${s.followupDays === 1 ? 'day' : 'days'}`);
      setRate(String(s.usdRate));
      setShowHidden(s.showHidden === 1);
      setShowPipeline(s.showPipeline === 1);
    });
  }, [props.version]);

  const togglePipeline = async (v: boolean) => {
    setShowPipeline(v);
    await saveSetting('showPipeline', v ? 1 : 0);
    await rescheduleAll().catch(() => undefined);
    success();
    props.bump();
  };

  const toggleHidden = async (v: boolean) => {
    if (v) {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level === LocalAuthentication.SecurityLevel.NONE) {
        Alert.alert('No screen lock', 'Set up a fingerprint or screen lock on your phone first, so hidden savings stay protected.');
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock hidden savings',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (!res.success) return;
    }
    setShowHidden(v);
    await saveSetting('showHidden', v ? 1 : 0);
    success();
    props.bump();
  };

  const changeFollowup = async (v: string) => {
    setFollowup(v);
    await saveSetting('followupDays', parseInt(v, 10));
    await rescheduleAll();
    props.bump();
  };

  const saveRate = async () => {
    const n = Number(rate);
    if (!n || n <= 0) {
      Alert.alert('Invalid rate', 'Enter how many EGP one USD is worth.');
      return;
    }
    await saveSetting('usdRate', n);
    success();
    Alert.alert('Saved', `New USD entries convert at ${n} EGP.`);
    props.bump();
  };

  const doExport = async () => {
    try {
      await exportBackup();
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const doImport = async () => {
    try {
      const data = await pickBackup();
      if (!data) return;
      const exp = data.expenses?.length ?? 0;
      Alert.alert(
        'Replace all data?',
        `This backup has ${data.items.length} pipeline items, ${data.income.length} income entries, ${exp} expenses and ${data.savings?.length ?? 0} savings entries. Everything currently in the app will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              await restoreBackup(data);
              await rescheduleAll();
              success();
              props.bump();
              Alert.alert('Restored', 'Backup loaded.');
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: props.bottomSpace + 20 }} keyboardShouldPersistTaps="handled">
      <Section title="Tabs" icon="layout" hint="Hiding the Pipeline tab keeps every entry safe and pauses its follow-up reminders until you turn it back on.">
        <View style={styles.switchRow}>
          <View style={styles.switchIcon}>
            <Icon name="layers" size={17} color={showPipeline ? colors.brass : colors.muted} />
          </View>
          <Text style={styles.switchText}>Show Pipeline tab</Text>
          <Switch
            value={showPipeline}
            onValueChange={togglePipeline}
            trackColor={{ false: colors.surfaceHi, true: colors.brassLo }}
            thumbColor={showPipeline ? colors.brassHi : colors.muted}
          />
        </View>
      </Section>

      <Section title="Income sources" icon="briefcase" hint="These fill every Source dropdown in the app.">
        <ListEditor
          items={props.sources}
          noun="source"
          placeholder="e.g. Upwork"
          onAdd={async (n) => {
            await addSource(n);
            props.bump();
          }}
          onRemove={async (n) => {
            await removeSource(n);
            props.bump();
          }}
        />
      </Section>

      <Section title="Expense categories" icon="tag" hint="These fill the Category dropdown when you log an expense.">
        <ListEditor
          items={props.categories}
          noun="category"
          placeholder="e.g. Internet"
          onAdd={async (n) => {
            await addCategory(n);
            props.bump();
          }}
          onRemove={async (n) => {
            await removeCategory(n);
            props.bump();
          }}
        />
      </Section>

      <Section
        title="Savings"
        icon="archive"
        hint="Hidden savings always come out of net. Turning this on needs your fingerprint, and it switches off by itself when you leave the app."
      >
        <View style={styles.switchRow}>
          <View style={styles.switchIcon}>
            <Icon name={showHidden ? 'eye' : 'eye-off'} size={17} color={showHidden ? colors.brass : colors.muted} />
          </View>
          <Text style={styles.switchText}>View hidden savings</Text>
          <Switch
            value={showHidden}
            onValueChange={toggleHidden}
            trackColor={{ false: colors.surfaceHi, true: colors.brassLo }}
            thumbColor={showHidden ? colors.brassHi : colors.muted}
          />
        </View>
      </Section>

      {showPipeline && (
      <Section title="Follow-ups" icon="bell" hint="You get a reminder when an open lead sits untouched this long.">
        <Select label="Remind me after" value={followup} options={FOLLOWUP_OPTIONS} onChange={changeFollowup} icon="clock" />
      </Section>
      )}

      <Section title="Currency" icon="repeat" hint="USD amounts are converted to EGP at this rate when you save them.">
        <Input label="EGP per 1 USD" value={rate} onChange={setRate} keyboardType="numeric" icon="dollar-sign" />
        <Button title="Save rate" icon="check" variant="ghost" onPress={saveRate} />
      </Section>

      <Section
        title="Backup"
        icon="shield"
        hint="Your data lives only on this phone. Uninstalling deletes it. Export weekly to Drive or WhatsApp."
      >
        <Button title="Export backup" icon="upload" onPress={doExport} style={{ marginBottom: 10 }} />
        <Button title="Restore from backup" icon="download" variant="ghost" onPress={doImport} />
      </Section>

      <View style={styles.footer}>
        <Image source={require('../../assets/mark.png')} style={{ width: 64, height: 64, opacity: 0.85 }} />
        <Text style={styles.footerName}>السقفيه</Text>
        <Text style={styles.version}>Version {Constants.expoConfig?.version ?? '1.0'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 2 },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.brassSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hint: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sourceBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sourceInitial: { color: colors.brass, fontFamily: fonts.serif, fontSize: 18 },
  sourceName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, flex: 1 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHi,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  switchText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, flex: 1 },
  footer: { alignItems: 'center', marginTop: 10, opacity: 0.8 },
  footerName: { color: colors.text, fontFamily: fonts.arabic, fontSize: 22, lineHeight: 34 },
  version: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
});
