import { NextRequest, NextResponse } from "next/server";
import { setWhoopSession } from "../../../../lib/whoop-session";

const tokenUrl = "https://api.prod.whoop.com/oauth/oauth2/token";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        error: "Missing WHOOP OAuth environment variables",
        required: ["WHOOP_CLIENT_ID", "WHOOP_CLIENT_SECRET", "WHOOP_REDIRECT_URI"]
      },
      { status: 500 }
    );
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: "WHOOP token exchange failed", detail: payload }, { status: response.status });
  }

  await setWhoopSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + payload.expires_in * 1000,
    token_type: payload.token_type,
    scope: payload.scope
  });

  const redirectUrl = new URL("/", request.nextUrl.origin);
  redirectUrl.searchParams.set("connected", "1");
  redirectUrl.searchParams.set("state", state ?? "");

  return NextResponse.redirect(redirectUrl);
}
