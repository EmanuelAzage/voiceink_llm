import { Platform } from 'react-native';
import notifee, { AndroidImportance, AuthorizationStatus, TriggerType, type TimestampTrigger } from '@notifee/react-native';
import { storage } from './storage';
import type { ActionItem, Card } from '@/state/cardStore';

const CHANNEL_ID = 'action-items';
const PENDING_DEEP_LINK_KEY = 'pendingDeepLinkCardId';

export async function ensureNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({ id: CHANNEL_ID, name: 'Action items', importance: AndroidImportance.DEFAULT });
}

/** Action items only carry a date (YYYY-MM-DD); fire at 09:00 local on that day. */
function triggerDateFor(dueDate: string): Date {
  const [year, month, day] = dueDate.split('-').map(Number);
  return new Date(year, month - 1, day, 9, 0, 0);
}

/** Whether `dueDate` (at its 09:00 local trigger time) is still ahead of now. */
export function isFutureDueDate(dueDate: string): boolean {
  return triggerDateFor(dueDate).getTime() > Date.now();
}

/**
 * Schedules a local notification for one action item, keyed by the item's own
 * id (so cancelling later needs no extra bookkeeping — see cardStore.ts).
 * Returns whether it actually got scheduled, so callers know whether to
 * record a `notificationId`.
 */
export async function scheduleActionItemNotification(card: Card, item: ActionItem): Promise<boolean> {
  if (!item.dueDate) return false;

  const date = triggerDateFor(item.dueDate);
  if (date.getTime() <= Date.now()) return false;

  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  await ensureChannel();

  const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: date.getTime() };
  await notifee.createTriggerNotification(
    {
      id: item.id,
      title: card.title,
      body: item.text,
      data: { cardId: card.id },
      android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
    },
    trigger,
  );
  return true;
}

export async function cancelActionItemNotification(notificationId: string): Promise<void> {
  await notifee.cancelTriggerNotification(notificationId);
}

/**
 * Handoff for notification taps received while the app is fully backgrounded
 * on Android (index.js's onBackgroundEvent — no navigationRef exists there).
 * RootNavigator checks this once on mount.
 */
export function setPendingDeepLinkCardId(cardId: string): void {
  storage.set(PENDING_DEEP_LINK_KEY, cardId);
}

export function consumePendingDeepLinkCardId(): string | null {
  const cardId = storage.getString(PENDING_DEEP_LINK_KEY) ?? null;
  if (cardId) storage.remove(PENDING_DEEP_LINK_KEY);
  return cardId;
}
