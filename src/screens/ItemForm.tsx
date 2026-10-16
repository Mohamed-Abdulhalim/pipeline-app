import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Select } from '../components/ui';
import {
  CURRENCIES,
  Currency,
  deleteItem,
  insertItem,
  Item,
  KINDS,
  Stage,
  STAGES,
  touchItem,
  updateItem,
} from '../db';
import { cancelItem, rescheduleItem } from '../notify';
import { colors } from '../theme';

export default function ItemForm(props: {
  visible: boolean;
  item: Item | null;
  sources: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [kind, setKind] = useState<string>('Job');
  const [stage, setStage] = useState<Stage>('Found');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState<Currency>('EGP');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!props.visible) return;
    const it = props.item;
    setTitle(it?.title ?? '');
    setSource(it?.source ?? props.sources[0] ?? '');
    setKind(it?.kind ?? 'Job');
    setStage(it?.stage ?? 'Found');
    setValue(it && it.value ? String(it.value) : '');
    setCurrency(it?.currency ?? 'EGP');
    setLink(it?.link ?? '');
    setNotes(it?.notes ?? '');
  }, [props.visible, props.item, props.sources]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Give this item a short name.');
      return;
    }
    if (!source) {
      Alert.alert('Missing source', 'Pick a source. Add sources in Settings.');
      return;
    }
    const input = {
      title: title.trim(),
      source,
      kind,
      stage,
      value: Number(value.replace(/,/g, '')) || 0,
      currency,
      link: link.trim(),
      notes: notes.trim(),
    };
    let id: number;
    if (props.item) {
      id = props.item.id;
      await updateItem(id, input);
    } else {
      id = await insertItem(input);
    }
    await rescheduleItem(id);
    props.onSaved();
  };

  const followedUp = async () => {
    if (!props.item) return;
    await touchItem(props.item.id);
    await rescheduleItem(props.item.id);
    props.onSaved();
  };

  const remove = () => {
    const it = props.item;
    if (!it) return;
    Alert.alert('Delete item?', it.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelItem(it.notif_id);
          await deleteItem(it.id);
          props.onSaved();
        },
      },
    ]);
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="height">
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.cancel} onPress={props.onClose}>
            Cancel
          </Text>
          <Text style={styles.title}>{props.item ? 'Edit item' : 'New item'}</Text>
          <Text style={styles.save} onPress={save}>
            Save
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
          <Input label="Title" value={title} onChange={setTitle} placeholder="e.g. n8n automation gig for dental clinic" />
          <Select label="Stage" value={stage} options={STAGES} onChange={(v) => setStage(v as Stage)} />
          <Select label="Source" value={source} options={props.sources} onChange={setSource} />
          <Select label="Type" value={kind} options={KINDS} onChange={setKind} />
          <View style={styles.row}>
            <View style={{ flex: 2, marginRight: 10 }}>
              <Input label="Expected value" value={value} onChange={setValue} keyboardType="numeric" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="Currency" value={currency} options={CURRENCIES} onChange={(v) => setCurrency(v as Currency)} />
            </View>
          </View>
          <Input label="Link" value={link} onChange={setLink} keyboardType="url" placeholder="https://" />
          <Input label="Notes" value={notes} onChange={setNotes} multiline placeholder="Contact, next step, anything useful" />
          {props.item && (
            <>
              <Button title="I followed up today" variant="ghost" onPress={followedUp} style={{ marginBottom: 10 }} />
              <Button title="Delete" variant="danger" onPress={remove} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cancel: { color: colors.muted, fontSize: 16, padding: 4 },
  save: { color: colors.accent, fontSize: 16, fontWeight: '700', padding: 4 },
  row: { flexDirection: 'row' },
});
