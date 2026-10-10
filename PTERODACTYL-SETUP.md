# Hell Host: Pterodactyl + free Minecraft trial

This repository now has a customer page (`minecraft.html`) and a backend bridge (`backend/`). They are an integration starter, not a live hosting service yet. Do not advertise server creation as available until the checklist below is complete and tested.

## Free-only hosting reality

- Oracle Cloud Infrastructure (OCI) Always Free is the most plausible free Linux host to test Pterodactyl on, if an eligible Ampere A1 instance is available in your home region. Oracle currently lists up to 2 OCPUs and 12 GB RAM across Always Free A1 resources. Capacity is not guaranteed; signup normally requires a valid credit/debit card for identity verification.
- A single 2 OCPU / 12 GB ARM VM is only a small test node. Reserve RAM and CPU for the OS, panel, database and Redis; do not allocate all memory to Minecraft. Performance and player slots will be limited.
- Render's free web service can host a prototype API but may sleep. It is not a Minecraft server host. Scheduled expiry enforcement must run reliably (for example, a scheduled GitHub Actions workflow calling the backend cron endpoint).
- A free subdomain such as DuckDNS can be used for DNS. HTTPS and Pterodactyl's panel/Wings network setup still need to be configured correctly.
- Do not enter payment details into an untrusted provider, exceed free quotas, or create multiple accounts to bypass provider limits. Never promise 24/7 uptime on a free tier.

## 1. Create a Linux host

1. Create one Oracle Cloud Free Tier account at https://www.oracle.com/in/cloud/free/ and choose the home region carefully.
2. Create an **Always Free eligible** Ubuntu ARM64/Ampere A1 VM, ideally up to 2 OCPUs and 12 GB RAM if the console offers it. Avoid paid shapes and trial-only resources. If there is no free capacity, wait or use a machine you already control; do not select a paid shape.
3. Configure the cloud firewall/security list and Ubuntu firewall for SSH (restricted to your IP), HTTP/HTTPS for the panel, and the Minecraft allocation ports you actually assign. Wings also needs its configured daemon port reachable. Do not open every port.
4. Use the official installation guides, not random one-line install scripts:
   - Panel requirements/install: https://docs.pterodactyl.io/
   - Wings install: https://docs.pterodactyl.io/v2/wings/installing
5. Install a supported Ubuntu version, Docker, Pterodactyl Panel, MariaDB/MySQL, Redis, and Wings. Configure a node, location, Minecraft Java egg, and a small pool of port allocations. Configure SMTP/password reset before creating end-user accounts.
6. Set up HTTPS and a DNS name. The website's own GitHub Pages address does not automatically become the Pterodactyl panel domain.

## 2. Configure Firebase and backend

1. In Firebase Console for project `hellhostlogin`, enable Firestore Database and create a Firebase Admin service-account JSON. Store the entire JSON only as the backend host's `FIREBASE_SERVICE_ACCOUNT_JSON` secret. Never commit it.
2. Create a Pterodactyl **Application API key** with only the permissions needed to manage users, servers, and node allocations. Keep it server-side only. Never put it in `minecraft.html` or `minecraft-config.js`.
3. Deploy the `backend/` directory as a Node.js 20+ web service. Set the variables in `backend/.env.example` in the provider's private environment settings. `ALLOWED_ORIGIN` must be the exact published Hell Host site origin. Set node, location, egg, Docker image, startup command and environment values to match your actual Pterodactyl setup.
4. The example defaults assume a compatible Java egg. Confirm its exact required environment keys and startup command in your Pterodactyl egg before allowing users to create servers.
5. Set `PTERODACTYL_PANEL_URL` to the HTTPS panel URL. Configure SMTP and test the Pterodactyl password-reset flow so users can access the game panel.
6. Set `minecraft-config.js`'s `HELLHOST_MINECRAFT_API` to the deployed backend base URL. Do not add API keys or Firebase service credentials to that file.
7. Confirm `GET /health` returns `{"ok":true,...}`, sign in to Hell Host, then test create/renew with a test account and confirm the server actually boots before announcing it.

## 3. Trial behavior

- Each Firebase account is limited to one server record in Firestore.
- Creation starts a 30-day trial. The renewal endpoint opens during the final 24 hours or after expiry and extends the same server by 30 days.
- Expired servers are suspended, not deleted. Their world remains until you choose a data-retention policy.
- The scheduled expiry endpoint is `POST /api/cron/expire` with header `Authorization: Bearer YOUR_CRON_SECRET`. Call it on a schedule (for example, GitHub Actions every 15 minutes) using repository Actions secrets `HELLHOST_BACKEND_URL` and `HELLHOST_CRON_SECRET`. Do not expose the secret in public logs.
- This is a renewable free trial, not unlimited guaranteed free hosting. Set resource limits and a one-server-per-user policy, monitor abuse, and retain a manual way to suspend users.

## Current limitations to fix/test before public launch

- The backend stores trial records in Firestore but does not yet provide a complete Pterodactyl SSO/login flow. Configure and test password-reset email delivery for generated panel accounts, or add a secure account-provisioning flow before relying on the panel link.
- Pterodactyl API payloads depend on the exact installed version and egg. Test allocation selection, server creation, suspend and unsuspend against your own panel before allowing real users.
- Add abuse prevention, concurrent-create locking, backups, log monitoring, and an expiry alert. A free host may suspend idle resources or have capacity constraints.
- Do not put any Pterodactyl Application API key in frontend code or GitHub history.
