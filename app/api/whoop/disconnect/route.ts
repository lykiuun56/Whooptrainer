import { NextResponse } from "next/server";
import { clearWhoopSession } from "../../../../lib/whoop-session";

export async function POST() {
  await clearWhoopSession();

  return NextResponse.json({
    ok: true
  });
}
