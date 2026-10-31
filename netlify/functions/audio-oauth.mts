import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

// Enabled only when a setup secret and the exact callback URL are configured.
// The authorization verifier is held in a signed, HttpOnly, short-lived cookie.
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const env = (key: string) => process.env[key] || "";
const hash = (value: string) => createHash("sha256").update(value).digest();
const equal = (a: string, b: string) => timingSafeEqual(hash(a), hash(b));
const sign = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");
const response = (message: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(message, { status, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", ...extra } });

export default async (request: Request) => {
  const secret = env("AUDIO_COM_SETUP_SECRET");
  const callback = env("AUDIO_COM_OAUTH_CALLBACK");
  const url = new URL(request.url);
  if (!secret || !callback || !callback.startsWith("https://")) return response("Audio.com setup is disabled.", 503);
  if (url.origin + url.pathname !== callback) return response("Invalid callback address.", 400);

  if (request.method === "POST") {
    const form = await request.formData();
    if (!equal(String(form.get("setup_key") || ""), secret)) return response("Invalid setup key.", 403);
    const verifier = randomBytes(48).toString("base64url");
    const state = randomBytes(32).toString("base64url");
    const registration = await fetch("https://api.audio.com/auth/client", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "St John's Park talks", redirect_uris: [callback], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!registration.ok) return response("Audio.com client registration failed. Please try again later.", 502);
    const client = await registration.json() as { client_id?: string };
    if (!client.client_id) return response("Audio.com did not return a client ID.", 502);
    const payload = Buffer.from(JSON.stringify({ verifier, state, clientId: client.client_id, expires: Date.now() + 600000 })).toString("base64url");
    const cookie = `${payload}.${sign(payload, secret)}`;
    const authorize = new URL("https://api.audio.com/auth/authorize");
    authorize.search = new URLSearchParams({ response_type: "code", client_id: client.client_id, redirect_uri: callback, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    return new Response(null, { status: 303, headers: { ...headers, Location: authorize.toString(), "Set-Cookie": `audio_oauth=${cookie}; Path=/.netlify/functions/audio-oauth; Max-Age=600; HttpOnly; Secure; SameSite=Lax` } });
  }
  if (request.method !== "GET") return response("Method not allowed.", 405);
  const code = url.searchParams.get("code");
  if (!code) return new Response('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Audio.com</title></head><body><main><h1>Connect Audio.com</h1><p>Enter the one-time setup key, then sign in to the St John’s Park Audio.com account.</p><form method="post"><label>Setup key <input name="setup_key" type="password" required autocomplete="off"></label><button type="submit">Continue</button></form></main></body></html>', { headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
  const cookie = request.headers.get("cookie")?.split("; ").find((part) => part.startsWith("audio_oauth="))?.slice(12) || "";
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature || !equal(signature, sign(payload, secret))) return response("The setup session is invalid or expired. Start again.", 400);
  let session: { verifier: string; state: string; clientId: string; expires: number };
  try { session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return response("Invalid setup session.", 400); }
  if (session.expires < Date.now() || !equal(session.state, url.searchParams.get("state") || "")) return response("The setup session is invalid or expired. Start again.", 400);
  const tokenResponse = await fetch("https://api.audio.com/auth/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: session.clientId, redirect_uri: callback, code_verifier: session.verifier }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenResponse.ok) return response("Audio.com did not accept the authorization. Start again.", 502);
  const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!token.access_token || !token.refresh_token) return response("Audio.com did not return the credentials needed for ongoing access.", 502);
  const list = await fetch("https://api.audio.com/v1/audio/list?sort=newest&page=1&per-page=100", { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!list.ok) return response("Could not verify the Audio.com account. No credentials were saved.", 502);
  const recordings = await list.json() as Array<{ username?: string }>;
  const expected = env("AUDIO_COM_USERNAME") || "stjohnsparksheffield";
  if (!Array.isArray(recordings) || !recordings.some((item) => item.username === expected)) return response("This account does not contain the expected church recordings. No credentials were saved.", 403);
  const store = getStore({ name: env("CONTEXT") === "production" ? "audio-com-oauth-v1" : "audio-com-oauth-preview-v1", consistency: "strong" });
  await store.setJSON("tokens", { clientId: session.clientId, accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + Math.max(Number(token.expires_in) || 3600, 60) * 1000 });
  return response("Audio.com connected successfully. You can close this page.", 200, { "Set-Cookie": "audio_oauth=; Path=/.netlify/functions/audio-oauth; Max-Age=0; HttpOnly; Secure; SameSite=Lax" });
};
