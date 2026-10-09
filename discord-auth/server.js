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
    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(profile.id)}/${encodeURIComponent(profile.avatar)}.${String(profile.avatar).startsWith("a_") ? "gif" : "png"}?size=128`
      : "";

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
    displayName: ${JSON.stringify(displayName)},
    avatarUrl: ${JSON.stringify(avatarUrl)}
  }, ${JSON.stringify(FRONTEND_ORIGIN)});
  window.close();
}
</script></body></html>`);
  } catch (err) {
    console.error("Discord callback failed:", err?.message || "unknown error");
    res.status(500).send("Sign-in could not be completed. Close this window and try again.");
  }
});


// VPS provisioning API. Keep disabled until billing, limits, and abuse controls are configured.
// Required environment variables to enable: HETZNER_API_TOKEN and VPS_PROVISIONING_ENABLED=true.
const VPS_PROVISIONING_ENABLED = process.env.VPS_PROVISIONING_ENABLED === "true";
const HETZNER_API_TOKEN = process.env.HETZNER_API_TOKEN || "";
const allowedFrontendOrigin = FRONTEND_ORIGIN;

app.options("/api/vps/create", (req, res) => {
  res.set("Access-Control-Allow-Origin", allowedFrontendOrigin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.sendStatus(204);
});

app.post("/api/vps/create", async (req, res) => {
  res.set("Access-Control-Allow-Origin", allowedFrontendOrigin);
  res.set("Vary", "Origin");
  res.set("Cache-Control", "no-store");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  const authHeader = req.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/i);
  if (!match) return res.status(401).json({ error: "Sign in to configure a VPS." });

  let user;
  try {
    user = await admin.auth().verifyIdToken(match[1]);
  } catch {
    return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
  }

  if (!VPS_PROVISIONING_ENABLED || !HETZNER_API_TOKEN) {
    return res.status(503).json({
      error: "VPS setup preview is ready, but live provisioning is disabled until billing, account limits, and provider credentials are configured."
    });
  }

  const { os, hostname, region, size, sshKey } = req.body || {};
  const safeHostname = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  if (!/^[a-z0-9][a-z0-9.-]{1,38}[a-z0-9]$/.test(safeHostname)) {
    return res.status(400).json({ error: "Use a hostname with 3–40 letters, numbers, dots, or hyphens." });
  }

  // Deliberate allowlists: client input never selects arbitrary provider resources.
  const images = {
    "Ubuntu 24.04 LTS": "ubuntu-24.04",
    "Ubuntu 22.04 LTS": "ubuntu-22.04",
    "Debian 12": "debian-12"
  };
  const serverTypes = {
    Fire: "cx23",
    Inferno: "cx33",
    Hellfire: "cx43"
  };
  const locations = {
    Germany: "fsn1",
    Finland: "hel1",
    "United States": "ash"
  };
  if (!images[os] || !serverTypes[size] || !locations[region]) {
    return res.status(400).json({ error: "Choose a supported operating system, size, and region." });
  }

  let sshKeyId;
  if (typeof sshKey === "string" && sshKey.trim()) {
    // Hetzner expects an existing SSH key ID; accepting arbitrary key creation needs
    // a separate ownership and lifecycle workflow. Do not silently ignore pasted keys.
    return res.status(400).json({ error: "SSH key import is not connected yet. Leave the SSH field empty for this setup preview." });
  }

  try {
    const response = await fetch("https://api.hetzner.cloud/v1/servers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HETZNER_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: safeHostname,
        server_type: serverTypes[size],
        image: images[os],
        location: locations[region],
        start_after_create: true,
        labels: { managed_by: "hellhost", owner_uid: String(user.uid).slice(0, 63) }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("VPS provider request failed:", response.status, data?.error?.code || "unknown");
      return res.status(502).json({ error: "The VPS provider could not create this server. Check provider account limits and configuration." });
    }
    const server = data.server || {};
    return res.status(201).json({
      id: server.id,
      name: server.name,
      status: server.status,
      ipv4: server.public_net?.ipv4?.ip || null,
      ipv6: server.public_net?.ipv6?.ip || null,
      region,
      os,
      size,
      message: "VPS created by the provider. Review its status and access settings in your provider console."
    });
  } catch (error) {
    console.error("VPS provisioning request failed:", error?.message || "unknown error");
    return res.status(502).json({ error: "Could not reach the VPS provider. Please try again later." });
  }
});
\napp.use((_req, res) => res.status(404).send("Not found"));

const port = Number(process.env.PORT || 10000);
app.listen(port, "0.0.0.0", () => console.log(`Hell Host Discord auth listening on ${port}`));
