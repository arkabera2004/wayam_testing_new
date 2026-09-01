import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { listNotifications, markNotificationsRead } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

export async function GET() {
  const userId = await currentUserId();
  return NextResponse.json({ notifications: await listNotifications(userId) });
}

/** Marks everything read. The only mutation this list supports. */
export async function POST() {
  const userId = await currentUserId();
  const updated = await markNotificationsRead(userId);
  revalidatePath("/notifications");
  return NextResponse.json({ updated });
}
