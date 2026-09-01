import { listNotifications } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

import { NotificationsView } from "./notifications-view";

export default async function NotificationsPage() {
  const userId = await currentUserId();
  const notifications = await listNotifications(userId);
  return <NotificationsView notifications={notifications} />;
}
