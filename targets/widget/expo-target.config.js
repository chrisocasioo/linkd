/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "LinkdWidget",
  bundleIdentifier: ".widget",
  deploymentTarget: "17.0",
  // Widget-configurable card picker needs App Intents (iOS 17+); the main
  // app target keeps its own lower minimumOsVersion.
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
