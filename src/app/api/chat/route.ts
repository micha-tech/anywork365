/**
 * GET /api/chat
 * Returns user's conversations
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {  
  getUserConversations,
  getUserNotifications,
  getUnreadNotificationCount,
} from "@/lib/chat";
import type { ApiResponse } from "@/types";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const conversations = await getUserConversations(session.id);
  const notifications = getUserNotifications(session.id);
  const unreadCount = getUnreadNotificationCount(session.id);

  return NextResponse.json({
    success: true,
    data: {
      conversations,
      notifications,
      unreadCount,
    },
  });
}
