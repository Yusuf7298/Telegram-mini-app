import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NotificationKind = 'reward' | 'referral' | 'wallet' | 'system';

export interface NotificationEntry {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface AddNotificationInput {
  kind: NotificationKind;
  title: string;
  message: string;
}

interface NotificationState {
  notifications: NotificationEntry[];
  addNotification: (notification: AddNotificationInput) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
}

const MAX_NOTIFICATIONS = 20;

function createNotificationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `notification_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      addNotification: (notification) => {
        const entry: NotificationEntry = {
          id: createNotificationId(),
          kind: notification.kind,
          title: notification.title,
          message: notification.message,
          createdAt: new Date().toISOString(),
          read: false,
        };

        set((state) => ({
          notifications: [entry, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
        }));
      },
      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification
          ),
        }));
      },
      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((notification) => ({
            ...notification,
            read: true,
          })),
        }));
      },
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'boxplay-notifications',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ notifications: state.notifications }),
    }
  )
);
