# CalSnap — Native Google Sign-In & Branding Setup

The login now uses **native Google Sign-In** (`@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken`) instead of the browser OAuth flow. This shows a native account picker branded as **CalSnap** (no `supabase.co` domain) and removes the Expo Go redirect problem.

> Requires a **dev/production build** — native Google Sign-In does **not** run in Expo Go. Use `npx expo run:android` / `run:ios` or an EAS build.

Your previous Google OAuth client was deleted (that's the `deleted_client` error you hit), so you'll create fresh clients below.

## 1. Google Cloud Console → Credentials → create OAuth client IDs
Create **three** OAuth 2.0 client IDs in the same project:

1. **Web application** — this is the one Supabase and the app's `webClientId` use.
   - Add Authorized redirect URI: `https://skhgyotzqjnwasuugzva.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client secret**.
2. **Android** — package name `com.sanverse.calsnapapp` (+ `.dev` for the dev variant), plus your signing **SHA-1** fingerprints:
   - Debug/dev-client SHA-1, and your EAS/Play release SHA-1 (`eas credentials` or Play Console → App signing).
3. **iOS** — bundle ID `com.sanverse.calsnapapp` (+ `.dev`). Copy its **iOS client ID**; its reversed form is `com.googleusercontent.apps.<IOS_CLIENT_ID>`.

## 2. OAuth consent screen (fixes the "supabase.co" branding)
Google Cloud → **OAuth consent screen**: set **App name = CalSnap**, upload a logo, set the support email and developer contact. This is what makes the sign-in sheet say *CalSnap*. (With native sign-in there's no `supabase.co` domain line at all.)

## 3. Supabase → Auth → Providers → Google
- Enable Google.
- Paste the **Web** client ID + secret.
- In **Authorized Client IDs**, add the **Web**, **iOS**, and **Android** client IDs (comma-separated). This is required so `signInWithIdToken` accepts the token from the native SDK.

## 4. App environment variables
In `mobile/.env`:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<the Web client ID from step 1.1>
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<iOS client ID from step 1.3>
```
The web client ID is wired via `app.config.js → extra.googleWebClientId`; the iOS URL scheme is wired via the `@react-native-google-signin/google-signin` config plugin (already added).

## 5. Build & test
```
cd mobile
npm install
npx expo run:android   # or run:ios (Mac + Xcode)
```
Tap **Continue with Google** → you should see the native CalSnap account picker, and land in the app signed in.

## Notes
- Android needs the correct **SHA-1** registered or sign-in fails with `DEVELOPER_ERROR`. Register both your dev-client and release SHA-1.
- No `google-services.json`/Firebase is required for this vanilla setup — the `webClientId` + registered client IDs are enough.
- The old browser-OAuth code (`expo-auth-session` / `expo-web-browser`) is no longer used for sign-in; those packages remain installed but harmless.
- **Apple reminder:** if you ship Google sign-in on iOS, Apple (Guideline 4.8) requires **Sign in with Apple** too — not added yet; flag for before App Store submission.
