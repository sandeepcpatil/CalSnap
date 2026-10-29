import { Platform } from 'react-native';
import { toast } from '../store/toastStore';

/**
 * Google Play in-app updates (Android only).
 *
 * When Play has a newer version, a snackbar offers "Update". That starts a
 * *flexible* update: it downloads in the background while the app stays
 * usable, and the module restarts the app into the new version once the
 * download finishes. Play does the install, so it is the same signed release
 * the store would serve.
 *
 * Only Play installs can be updated this way. Sideloaded and dev-client builds
 * always report "no update", so test through an internal testing track.
 */

/** Check at most this often, so foregrounding the app doesn't nag. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Long enough to read and reach for the button. */
const PROMPT_DURATION_MS = 10_000;

type InAppUpdates = typeof import('expo-in-app-updates');

let lastCheckAt = 0;
let prompted = false;

/**
 * Loaded lazily: the package throws at import when its native half is missing,
 * which is true of every build made before it was added. A JS-only reload onto
 * an older build must not crash on launch.
 */
function loadModule(): InAppUpdates | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-in-app-updates') as InAppUpdates;
  } catch {
    return null;
  }
}

/** Ask Play whether a newer version exists and, if so, offer it once per session. */
export async function checkForAppUpdate(): Promise<void> {
  if (Platform.OS !== 'android' || __DEV__ || prompted) return;
  const now = Date.now();
  if (now - lastCheckAt < CHECK_INTERVAL_MS) return;
  lastCheckAt = now;

  const updates = loadModule();
  if (!updates) return;

  try {
    const info = await updates.checkForUpdate();
    // An update already downloading from an earlier tap needs no second prompt.
    if (!info.updateAvailable || info.updateInProgress || !info.flexibleAllowed) return;

    prompted = true;
    toast('A new version of CalVue is available.', {
      duration: PROMPT_DURATION_MS,
      action: {
        label: 'Update',
        onPress: async () => {
          try {
            await updates.startUpdate(false);
          } catch (err) {
            console.warn('[updates] start failed', err);
          }
        },
      },
    });
  } catch (err) {
    // Play unreachable, not a Play install, etc. Never surface this to the user.
    console.warn('[updates] check failed', err);
  }
}
