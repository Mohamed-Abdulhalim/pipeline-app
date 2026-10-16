import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Backup, exportAll, importAll } from './db';

export async function exportBackup(): Promise<void> {
  const data = await exportAll();
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `pipeline-backup-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Pipeline backup' });
}

export async function pickBackup(): Promise<Backup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const text = await new File(res.assets[0].uri).text();
  const data = JSON.parse(text) as Backup;
  if (data.app !== 'pipeline' || !Array.isArray(data.items) || !Array.isArray(data.income)) {
    throw new Error('This file is not a Pipeline backup.');
  }
  return data;
}

export async function restoreBackup(data: Backup): Promise<void> {
  await importAll(data);
}
