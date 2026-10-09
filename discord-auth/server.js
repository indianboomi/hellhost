import crypto from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import admin from "firebase-admin";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  FRONTEND_ORIGIN,
  FIREBASE_SERVICE_ACCOUNT_JSON
} = process.env;

for (const [key, value] of Object.entries({
  DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI,
  FRONTEND_ORIGIN, FIREBASE_SERVICE_ACCOUNT_JSON
})) {
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
}

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const STATE_COOKIE = "hellhost_oauth_state";
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/auth/discord/callback",
  maxAge: 5 * 60 * 1000
};

app.get("/", (_req, res) => res.type("text").send("Hell Host Discord authentication service is running."));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/auth/discord", (_req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  res.cookie(STATE_COOKIE, state, cookieOptions);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: "identify email",
    state
  }).toString();
  res.redirect(url.toString());
});

app.get("/auth/discord/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const savedState = req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { ...cookieOptions, maxAge: undefined });

  if (error) return res.status(400).send("Discord authorization was cancelled. You can close this window.");
  if (typeof code !== "string" || typeof state !== "string" ||
      typeof savedState !== "string" || state.length !== savedState.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(savedState))) {
    return res.status(400).send("Invalid or expired sign-in request. Close this window and try again.");
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_REDIRECT_URI
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Discord token exchange failed:", tokenData.error || tokenResponse.status);
      return res.status(401).send("Discord sign-in failed. Close this window and try again.");
    }

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.id) {
      return res.status(401).send("Could not verify your Discord account. Please try again.");
    }

    const uid = `discord_${profile.id}`;
    const customToken = await admin.auth().createCustomToken(uid, {
      authProvider: "discord",
      discordId: profile.id,
      discordUsername: String(profile.username || "Discord user").slice(0, 100)
    });
    const displayName = String(profile.global_name || profile.username || "Discord user")
      .replace(/[<>]/g, "").slice(0, 80);

    res.set({
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    });
    res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>Hell Host sign-in</title></head>
<body><p>Discord sign-in complete. You can close this window.</p><script>
if (window.opener) {
  window.opener.postMessage({
    type: "hellhost-discord-auth",
    token: ${JSON.stringify(customToken)},
    displayName: ${JSON.stringify(displayName)}
  }, ${JSON.stringify(FRONTEND_ORIGIN)});
  window.close();
}
</script></body></html>`);
  } catch (err) {
    console.error("Discord callback failed:", err?.message || "unknown error");
    res.status(500).send("Sign-in could not be completed. Close this window and try again.");
  }
});

app.use((_req, res) => res.status(404).send("Not found"));

const port = Number(process.env.PORT || 10000);
app.listen(port, "0.0.0.0", () => console.log(`Hell Host Discord auth listening on ${port}`));
