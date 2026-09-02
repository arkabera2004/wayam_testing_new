"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { notifications } from "@/lib/demo-data";

/**
 * Shared read-state for notifications.
 *
 * The unread count is rendered in two places that never spoke to each other:
 * the topbar bell and the notifications page. With the page holding the state
 * locally, "Mark all read" emptied the list and disabled its own button while
 * the bell kept its red dot — the app contradicting itself on one screen.
 * Hoisting the state here keeps both readers on one value.
 */
type NotificationsContextValue = {
  unread: number;
  isUnread: (id: number) => boolean;
  markAllRead: () => void;
};

/** Inert default for the same partial-RSC-render reason as the theme context. */
const FALLBACK_NOTIFICATIONS: NotificationsContextValue = {
  unread: 0,
  isUnread: () => false,
  markAllRead: () => {},
};

const NotificationsContext = createContext<NotificationsContextValue>(FALLBACK_NOTIFICATIONS);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [readIds, setReadIds] = useState<Set<number>>(() => new Set());

  const isUnread = useCallback(
    (id: number) => {
      const n = notifications.find((x) => x.id === id);
      return Boolean(n?.unread) && !readIds.has(id);
    },
    [readIds],
  );

  const unread = useMemo(
    () => notifications.filter((n) => n.unread && !readIds.has(n.id)).length,
    [readIds],
  );

  const markAllRead = useCallback(
    () => setReadIds(new Set(notifications.map((n) => n.id))),
    [],
  );

  const value = useMemo(
    () => ({ unread, isUnread, markAllRead }),
    [unread, isUnread, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
