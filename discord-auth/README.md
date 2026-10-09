# Hell Host Discord OAuth backend

This service implements Discord OAuth for the Hell Host Firebase Authentication project using Firebase custom tokens. The Discord Client Secret and Firebase service-account private key belong only in the hosting provider's environment variables.

## Deploy on Render

1. Create a **Web Service** from this repository.
2. Set **Root Directory** to `discord-auth`.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.
5. Choose the Free instance for testing. Free services can sleep after inactivity.
6. After Render gives the service its HTTPS URL, set the environment variables below.

## Required environment variables

- `DISCORD_CLIENT_ID`: the Discord application's Client ID.
- `DISCORD_CLIENT_SECRET`: the regenerated Discord Client Secret. Never commit this.
- `DISCORD_REDIRECT_URI`: `https://YOUR-SERVICE.onrender.com/auth/discord/callback` (replace the hostname with the actual Render URL).
- `FRONTEND_ORIGIN`: the exact origin of the deployed Hell Host site, e.g. `https://YOUR-SITE.web.app` (origin only; no path or trailing slash).
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the entire Firebase service-account JSON downloaded for the `hellhostlogin` project, pasted as the environment-variable value. Treat it like a password; never commit the JSON file.

In the Discord Developer Portal, open OAuth2 and add the exact value of `DISCORD_REDIRECT_URI` under Redirects.

## Finish frontend setup

In the repository-root `firebase-auth.js`, set `DISCORD_AUTH_URL` to the service's HTTPS origin, e.g. `https://YOUR-SERVICE.onrender.com` (no trailing slash), then commit and redeploy the website.

In Firebase Console → Authentication → Settings → Authorized domains, ensure the frontend hostname is listed. The backend uses Firebase Admin SDK and the Firebase custom-token sign-in flow.

## Important account behavior

Discord accounts are assigned Firebase UIDs of the form `discord_DISCORD_USER_ID`. This does not automatically link a Discord login to an existing email/Google/GitHub account with the same email. Account linking should be implemented separately after verifying the existing account.
