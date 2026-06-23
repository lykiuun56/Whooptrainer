import { NextResponse } from "next/server";

const authorizationUrl = "https://api.prod.whoop.com/oauth/oauth2/auth";

function getState() {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export async function GET() {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;
  const scopes =
    process.env.WHOOP_SCOPES ?? "read:profile read:recovery read:cycles read:sleep read:workout offline";

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "Missing WHOOP_CLIENT_ID or WHOOP_REDIRECT_URI",
        next: "Add them in Vercel Environment Variables or .env.local."
      },
      { status: 500 }
    );
  }

  const url = new URL(authorizationUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", getState());

  return NextResponse.redirect(url);
}
