const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");
const crypto = require("node:crypto");

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  });
}
const db = admin.apps.length ? admin.firestore() : null;
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || false }));
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

const required = [
  "FIREBASE_SERVICE_ACCOUNT_JSON", "PTERODACTYL_URL", "PTERODACTYL_APPLICATION_API_KEY",
  "PTERODACTYL_NODE_ID", "PTERODACTYL_LOCATION_ID", "PTERODACTYL_EGG_ID",
  "PTERODACTYL_DOCKER_IMAGE", "PTERODACTYL_STARTUP", "PTERODACTYL_PANEL_URL", "CRON_SECRET"
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) console.warn("Missing environment variables:", missing.join(", "));

function pteroApi(path) {
  return process.env.PTERODACTYL_URL.replace(/\/+$/, "") + "/api/application" + path;
}
async function ptero(path, method = "GET", body) {
  const response = await fetch(pteroApi(path), {
    method,
    headers: {
      Authorization: "Bearer " + process.env.PTERODACTYL_APPLICATION_API_KEY,
      Accept: "Application/vnd.pterodactyl.v1+json",
      "Content-Type": "application/json"
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.errors?.[0]?.detail || data.message || "Pterodactyl API request failed";
    throw Object.assign(new Error(message), { status: 502 });
  }
  return data;
}
function auth(req, res, next) {
  (async () => {
    if (!db) return res.status(503).json({ error: "Backend is not configured yet." });
    const match = (req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (!match) return res.status(401).json({ error: "Please sign in first." });
    try {
      req.user = await admin.auth().verifyIdToken(match[1]);
      return next();
    } catch {
      return res.status(401).json({ error: "Your session expired. Please sign in again." });
    }
  })().catch(next);
}
const timestampIn30Days = () =>
  admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
const trialRef = (uid) => db.collection("minecraftTrials").doc(uid);
function usernameFor(user) {
  const base = (user.email || user.uid).split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16) || "player";
  return (base + "_" + user.uid.slice(-6)).slice(0, 32);
}
async function getOrCreatePterodactylUser(user, existing) {
  if (existing?.pteroUserId) return existing.pteroUserId;
  if (!user.email) throw Object.assign(new Error("Your sign-in provider must share an email to create a game-panel account."), { status: 400 });
  const parts = (user.name || user.email.split("@")[0] || "Hell Host").trim().split(/\s+/);
  const result = await ptero("/users", "POST", {
    email: user.email,
    username: usernameFor(user),
    first_name: (parts[0] || "Hell").slice(0, 191),
    last_name: (parts.slice(1).join(" ") || "Host").slice(0, 191),
    password: crypto.randomBytes(32).toString("base64url"),
    external_id: user.uid
  });
  return result.attributes.id;
}
async function findFreeAllocation() {
  const nodeId = encodeURIComponent(process.env.PTERODACTYL_NODE_ID);
  for (let page = 1; page <= 10; page++) {
    const result = await ptero("/nodes/" + nodeId + "/allocations?per_page=100&page=" + page);
    const free = (result.data || []).find((item) => !item.attributes.assigned);
    if (free) return free.attributes;
    if (!result.meta?.pagination || page >= result.meta.pagination.total_pages) break;
  }
  throw Object.assign(new Error("No free Minecraft ports are available. Try again later."), { status: 503 });
}
async function createServer(user, existing) {
  const pteroUserId = await getOrCreatePterodactylUser(user, existing);
  const allocation = await findFreeAllocation();
  const environment = {
    SERVER_JARFILE: "server.jar",
    MINECRAFT_VERSION: "latest",
    BUILD_NUMBER: "latest",
    EULA: "TRUE",
    ...(process.env.PTERODACTYL_ENVIRONMENT_JSON ? JSON.parse(process.env.PTERODACTYL_ENVIRONMENT_JSON) : {})
  };
  const result = await ptero("/servers", "POST", {
    name: "HellHost-" + usernameFor(user),
    user: pteroUserId,
    egg: Number(process.env.PTERODACTYL_EGG_ID),
    docker_image: process.env.PTERODACTYL_DOCKER_IMAGE,
    startup: process.env.PTERODACTYL_STARTUP,
    environment,
    limits: {
      memory: Number(process.env.SERVER_MEMORY_MB || 2048),
      swap: 0,
      disk: Number(process.env.SERVER_DISK_MB || 5120),
      io: 500,
      cpu: Number(process.env.SERVER_CPU_PERCENT || 100),
      threads: "",
      oom_disabled: true
    },
    feature_limits: { databases: 0, backups: 1, allocations: 1 },
    allocation: { default: allocation.id },
    deploy: { locations: [Number(process.env.PTERODACTYL_LOCATION_ID)], dedicated_ip: false, port_range: [] },
    start_on_completion: false
  });
  const server = result.attributes;
  const record = {
    uid: user.uid,
    email: user.email || "",
    pteroUserId,
    serverId: server.id,
    serverUuid: server.uuid,
    serverIdentifier: server.identifier,
    serverName: server.name,
    allocationIp: allocation.alias || allocation.ip_alias || allocation.ip,
    allocationPort: allocation.port,
    trialStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    trialExpiresAt: timestampIn30Days(),
    status: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await trialRef(user.uid).set(record, { merge: true });
  return record;
}
function publicServer(data) {
  if (!data) return null;
  const expires = data.trialExpiresAt?.toDate ? data.trialExpiresAt.toDate() : null;
  return {
    serverId: data.serverId,
    name: data.serverName,
    address: data.allocationIp && data.allocationPort ? data.allocationIp + ":" + data.allocationPort : null,
    trialExpiresAt: expires?.toISOString() || null,
    status: expires && expires.getTime() <= Date.now() ? "expired" : (data.status || "active"),
    panelUrl: process.env.PTERODACTYL_PANEL_URL
  };
}
app.get("/health", (_req, res) => res.json({ ok: true, service: "hellhost-pterodactyl-bridge" }));
app.get("/api/minecraft/me", auth, async (req, res, next) => {
  try {
    const snap = await trialRef(req.user.uid).get();
    res.json({ server: snap.exists ? publicServer(snap.data()) : null });
  } catch (error) { next(error); }
});
app.post("/api/minecraft/create", auth, async (req, res, next) => {
  try {
    const ref = trialRef(req.user.uid);
    const snap = await ref.get();
    if (snap.exists && snap.data().serverId) {
      return res.status(409).json({ error: "You already have a server. Use Renew trial near expiry." });
    }
    const record = await createServer({
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name
    }, snap.exists ? snap.data() : null);
    res.status(201).json({ server: publicServer(record) });
  } catch (error) { next(error); }
});
app.post("/api/minecraft/renew", auth, async (req, res, next) => {
  try {
    const ref = trialRef(req.user.uid);
    const snap = await ref.get();
    if (!snap.exists || !snap.data().serverId) return res.status(404).json({ error: "Create a Minecraft server first." });
    const record = snap.data();
    const expiry = record.trialExpiresAt?.toDate?.().getTime() || 0;
    if (expiry > Date.now() + 24 * 60 * 60 * 1000) {
      return res.status(409).json({ error: "Renewal opens 24 hours before your trial expires." });
    }
    if (record.status === "expired" || expiry <= Date.now()) {
      await ptero("/servers/" + encodeURIComponent(record.serverId) + "/unsuspend", "POST");
    }
    const trialExpiresAt = timestampIn30Days();
    await ref.set({ trialExpiresAt, status: "active", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    res.json({ server: publicServer({ ...record, trialExpiresAt, status: "active" }) });
  } catch (error) { next(error); }
});
app.post("/api/cron/expire", async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: "Backend is not configured." });
    if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const expired = await db.collection("minecraftTrials")
      .where("trialExpiresAt", "<=", admin.firestore.Timestamp.now()).limit(100).get();
    let suspended = 0;
    for (const doc of expired.docs) {
      const record = doc.data();
      if (!record.serverId || record.status !== "active") continue;
      try {
        await ptero("/servers/" + encodeURIComponent(record.serverId) + "/suspend", "POST");
        await doc.ref.set({ status: "expired", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        suspended++;
      } catch (error) {
        console.error("Could not suspend expired server", record.serverId, error.message);
      }
    }
    res.json({ ok: true, checked: expired.size, suspended });
  } catch (error) { next(error); }
});
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : "Unexpected server error. Check backend logs."
  });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log("Hell Host Pterodactyl bridge listening on", port));