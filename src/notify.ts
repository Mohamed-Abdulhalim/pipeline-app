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
      name: 'Follow-up reminders',
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
      title: `Follow up: ${item.title}`,
      body: `${item.stage} via ${item.source}. Untouched for ${followupDays}+ days.`,
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
  for (const item of items) {
    await scheduleFor({ ...item, notif_id: null }, settings.followupDays);
  }
}
