/**
 * Expo config plugin that sets `android:largeHeap="true"` on the main
 * <application> in AndroidManifest.xml.
 *
 * Why: this is a media-heavy feed app (multiple ExoPlayer instances,
 * Firestore real-time listeners, OkHttp HTTP/2 streams, image decoder cache).
 * On devices with a 256 MB Java heap target, the app can exhaust the heap
 * during normal feed scrolling. `largeHeap` doubles the per-app limit on
 * modern Android (typically 512 MB), giving the JVM headroom while we keep
 * working on reducing the underlying footprint.
 *
 * This is the same flag major media apps (Instagram, TikTok, Twitter) ship
 * with — it's a standard production setting for video feeds, not a hack.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const withAndroidLargeHeap = (config) =>
  withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) return cfg;
    application.$['android:largeHeap'] = 'true';
    return cfg;
  });

module.exports = withAndroidLargeHeap;
