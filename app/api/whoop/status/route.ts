import { NextResponse } from "next/server";
import { getWhoopSession } from "../../../../lib/whoop-session";

export async function GET() {
  const session = await getWhoopSession();

  return NextResponse.json({
    connected: Boolean(session),
    expires_at: session?.expires_at ?? null,
    scope: session?.scope ?? null
  });
}
