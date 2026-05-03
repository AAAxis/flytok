/**
 * Expo config plugin that injects the Google Maps Android SDK API key into
 * AndroidManifest.xml at prebuild time.
 *
 * Reads from `process.env.GOOGLE_MAPS_API_KEY`. Expo CLI auto-loads
 * `.env` / `.env.local` from the project directory before running the
 * prebuild pipeline, so the key never lands in the JS bundle and the
 * value can stay out of git.
 *
 * Fail-loud per the global rule against silent fallbacks: if the env var
 * is missing, prebuild aborts with a clear message rather than producing
 * a build that renders an empty grey map.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const META_NAME = 'com.google.android.geo.API_KEY';

const withGoogleMapsApiKey = (config) =>
  withAndroidManifest(config, (cfg) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key || key.trim().length === 0) {
      throw new Error(
        '[withGoogleMapsApiKey] GOOGLE_MAPS_API_KEY is not set. ' +
          'Add it to mobile/.env (see mobile/.env.example) before prebuild. ' +
          'Without it, the Map tab will not render Google tiles on Android.',
      );
    }

    const application = cfg.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('[withGoogleMapsApiKey] No <application> tag in AndroidManifest.');
    }

    application['meta-data'] = application['meta-data'] || [];
    const existing = application['meta-data'].find(
      (m) => m.$ && m.$['android:name'] === META_NAME,
    );
    if (existing) {
      existing.$['android:value'] = key;
    } else {
      application['meta-data'].push({
        $: {
          'android:name': META_NAME,
          'android:value': key,
        },
      });
    }

    return cfg;
  });

module.exports = withGoogleMapsApiKey;
