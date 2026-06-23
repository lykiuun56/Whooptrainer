import { NextRequest, NextResponse } from "next/server";

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

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: "WHOOP token exchange failed", detail: payload }, { status: response.status });
  }

  return NextResponse.json({
    ok: true,
    message: "WHOOP authorization succeeded. Token storage is the next implementation step.",
    state,
    token_preview: {
      token_type: payload.token_type,
      expires_in: payload.expires_in,
      scope: payload.scope,
      has_access_token: Boolean(payload.access_token),
      has_refresh_token: Boolean(payload.refresh_token)
    }
  });
}
