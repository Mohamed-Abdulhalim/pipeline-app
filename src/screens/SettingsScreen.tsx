import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input, Select } from '../components/ui';
import { exportBackup, pickBackup, restoreBackup } from '../backup';
import { addSource, getSettings, removeSource, saveSetting } from '../db';
import { rescheduleAll } from '../notify';
import { colors } from '../theme';

const FOLLOWUP_OPTIONS = ['1 day', '2 days', '3 days', '5 days', '7 days', '14 days'];

export default function SettingsScreen(props: { version: number; sources: string[]; bump: () => void }) {
  const [newSource, setNewSource] = useState('');
  const [followup, setFollowup] = useState('3 days');
  const [rate, setRate] = useState('50');

  useEffect(() => {
    getSettings().then((s) => {
      setFollowup(`${s.followupDays} ${s.followupDays === 1 ? 'day' : 'days'}`);
      setRate(String(s.usdRate));
    });
  }, [props.version]);

  const add = async () => {
    const name = newSource.trim();
    if (!name) return;
    await addSource(name);
    setNewSource('');
    props.bump();
  };

  const remove = (name: string) => {
    Alert.alert('Remove source?', `${name} will disappear from dropdowns. Existing entries keep it.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeSource(name);
          props.bump();
        },
      },
    ]);
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
    Alert.alert('Saved', `New USD entries convert at ${n} EGP.`);
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
      Alert.alert(
        'Replace all data?',
        `This backup has ${data.items.length} items and ${data.income.length} income entries. Everything currently in the app will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              await restoreBackup(data);
              await rescheduleAll();
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
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={styles.section}>Sources</Text>
      <Card style={{ marginBottom: 20 }}>
        {props.sources.map((s) => (
          <View key={s} style={styles.sourceRow}>
            <Text style={styles.text}>{s}</Text>
            <Text style={styles.remove} onPress={() => remove(s)}>
              Remove
            </Text>
          </View>
        ))}
        <View style={{ marginTop: 12 }}>
          <Input label="Add a source" value={newSource} onChange={setNewSource} placeholder="e.g. Upwork" />
          <Button title="Add source" variant="ghost" onPress={add} />
        </View>
      </Card>

      <Text style={styles.section}>Follow-ups</Text>
      <Card style={{ marginBottom: 20 }}>
        <Select label="Remind me when an open item is untouched for" value={followup} options={FOLLOWUP_OPTIONS} onChange={changeFollowup} />
      </Card>

      <Text style={styles.section}>Currency</Text>
      <Card style={{ marginBottom: 20 }}>
        <Input label="EGP per 1 USD" value={rate} onChange={setRate} keyboardType="numeric" />
        <Button title="Save rate" variant="ghost" onPress={saveRate} />
      </Card>

      <Text style={styles.section}>Backup</Text>
      <Card>
        <Text style={[styles.muted, { marginBottom: 12 }]}>
          Data lives only on this phone. Uninstalling the app deletes it. Export regularly to Google Drive or WhatsApp yourself.
        </Text>
        <Button title="Export backup" onPress={doExport} style={{ marginBottom: 10 }} />
        <Button title="Restore from backup" variant="ghost" onPress={doImport} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.6 },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  text: { color: colors.text, fontSize: 15 },
  remove: { color: colors.bad, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
