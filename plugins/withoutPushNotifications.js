/**
 * Custom Expo config plugin: strip iOS Push Notifications capability.
 *
 * Why: a personal Apple Developer team cannot sign apps that declare the
 * `aps-environment` entitlement. The `expo-notifications` package auto-adds
 * this entitlement during `expo prebuild`, breaking `npx expo run:ios --device`
 * on a free account.
 *
 * What this plugin does:
 *   1. Removes the `aps-environment` key from iOS entitlements after
 *      expo-notifications has injected it.
 *   2. Removes the `remote-notification` UIBackgroundMode from Info.plist
 *      (also requires the entitlement).
 *
 * Registered LAST in app.json `plugins` so it runs after expo-notifications.
 *
 * When you upgrade to a paid Apple Developer account and want real push,
 * simply remove this plugin from `app.json` and run `expo prebuild --clean`.
 */
const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

const withoutPushNotifications = (config) => {
  // 1. Strip aps-environment from entitlements
  config = withEntitlementsPlist(config, (cfg) => {
    if (cfg.modResults && 'aps-environment' in cfg.modResults) {
      delete cfg.modResults['aps-environment'];
    }
    return cfg;
  });

  // 2. Strip remote-notification background mode (also gated by the entitlement)
  config = withInfoPlist(config, (cfg) => {
    const modes = cfg.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      cfg.modResults.UIBackgroundModes = modes.filter((m) => m !== 'remote-notification');
      if (cfg.modResults.UIBackgroundModes.length === 0) {
        delete cfg.modResults.UIBackgroundModes;
      }
    }
    return cfg;
  });

  return config;
};

module.exports = withoutPushNotifications;
