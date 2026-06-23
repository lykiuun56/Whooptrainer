import { setWhoopSession, WhoopSession } from "./whoop-session";

const apiBase = "https://api.prod.whoop.com/developer/v2";
const tokenUrl = "https://api.prod.whoop.com/oauth/oauth2/token";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export async function refreshWhoopSession(session: WhoopSession) {
  if (session.expires_at > Date.now() + 60_000) {
    return session;
  }

  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing WHOOP OAuth environment variables");
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refresh_token,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  const payload = (await response.json()) as TokenResponse | { error?: string; error_description?: string };

  if (!response.ok || !("access_token" in payload)) {
    throw new Error("Unable to refresh WHOOP access token");
  }

  const nextSession: WhoopSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? session.refresh_token,
    expires_at: Date.now() + payload.expires_in * 1000,
    token_type: payload.token_type,
    scope: payload.scope ?? session.scope
  };

  await setWhoopSession(nextSession);

  return nextSession;
}

export async function whoopGet<T>(session: WhoopSession, path: string, params?: Record<string, string>) {
  const url = new URL(`${apiBase}${path}`);

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${session.access_token}`
    },
    cache: "no-store"
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      detail: payload
    };
  }

  return {
    ok: true as const,
    data: payload as T
  };
}
