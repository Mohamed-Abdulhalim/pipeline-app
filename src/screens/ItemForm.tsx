import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Input,
  KeyboardScroll,
  Select,
  SheetHeader,
  success,
} from '../components/ui';
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
import { colors, stageColors } from '../theme';

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
      Alert.alert(t('Missing title'), t('Give this item a short name.'));
      return;
    }
    if (!source) {
      Alert.alert(t('Missing source'), t('Pick a source. Add sources in Settings.'));
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
    success();
    props.onSaved();
  };

  const followedUp = async () => {
    if (!props.item) return;
    await touchItem(props.item.id);
    await rescheduleItem(props.item.id);
    success();
    props.onSaved();
  };

  const remove = () => {
    const it = props.item;
    if (!it) return;
    Alert.alert(t('Delete item?'), it.title, [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
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
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SheetHeader title={props.item ? t('Edit entry') : t('New entry')} onClose={props.onClose} onSave={save} top={insets.top} />
        <KeyboardScroll
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <Input label={t('Title')} value={title} onChange={setTitle} icon="type" placeholder={t('n8n automation for a dental clinic')} />
          <Select
            label={t('Stage')}
            value={stage}
            options={STAGES}
            onChange={(v) => setStage(v as Stage)}
            dot={(v) => stageColors[v]}
          />
          <View style={styles.row}>
            <View style={{ flex: 1, marginEnd: 10 }}>
              <Select label={t('Source')} value={source} options={props.sources} onChange={setSource} />
            </View>
            <View style={{ flex: 1 }}>
              <Select label={t('Type')} value={kind} options={KINDS} onChange={setKind} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1.6, marginEnd: 10 }}>
              <Input label={t('Expected value')} value={value} onChange={setValue} keyboardType="numeric" icon="dollar-sign" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <Select label={t('Currency')} value={currency} options={CURRENCIES} onChange={(v) => setCurrency(v as Currency)} />
            </View>
          </View>
          <Input label={t('Link')} value={link} onChange={setLink} keyboardType="url" icon="link-2" placeholder="https://" />
          <Input label={t('Notes')} value={notes} onChange={setNotes} multiline placeholder={t('Contact, next step, anything useful')} />
          {props.item ? (
            <View style={{ marginTop: 6 }}>
              <Button title={t('I followed up today')} icon="refresh-cw" variant="ghost" onPress={followedUp} style={{ marginBottom: 10 }} />
              <Button title={t('Delete entry')} icon="trash-2" variant="danger" onPress={remove} />
            </View>
          ) : (
            <Button title={t('Add to pipeline')} icon="plus" onPress={save} style={{ marginTop: 6 }} />
          )}
        </KeyboardScroll>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
