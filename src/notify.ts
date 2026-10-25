import { t, tv } from './i18n';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getItem, getItems, getSettings, Item, OPEN_STAGES, setItemNotif } from './db';

const CHANNEL = 'followups';
const DAY = 86400000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: t('Follow-up reminders'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function scheduleFor(item: Item, followupDays: number): Promise<void> {
  if (item.notif_id) {
    await Notifications.cancelScheduledNotificationAsync(item.notif_id).catch(() => undefined);
  }
  if (!OPEN_STAGES.includes(item.stage)) {
    await setItemNotif(item.id, null);
    return;
  }
  let when = item.touched_at + followupDays * DAY;
  if (when <= Date.now()) when = Date.now() + 60 * 60 * 1000;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: t('Follow up: {title}', { title: item.title }),
      body: t('{stage} via {source}. Untouched for {n}+ days.', { stage: tv(item.stage), source: tv(item.source), n: followupDays }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(when),
      channelId: CHANNEL,
    },
  });
  await setItemNotif(item.id, id);
}

export async function rescheduleItem(id: number): Promise<void> {
  const [item, settings] = await Promise.all([getItem(id), getSettings()]);
  if (item) await scheduleFor(item, settings.followupDays);
}

export async function cancelItem(notifId: string | null): Promise<void> {
  if (notifId) await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => undefined);
}

export async function rescheduleAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const [items, settings] = await Promise.all([getItems(), getSettings()]);
  if (settings.showPipeline === 0) {
    for (const item of items) if (item.notif_id) await setItemNotif(item.id, null);
    return;
  }
  for (const item of items) {
    await scheduleFor({ ...item, notif_id: null }, settings.followupDays);
  }
}
