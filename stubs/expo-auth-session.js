// Stub for expo-auth-session — not used by this app; only imported via @clerk/clerk-expo's useOAuth hook which we don't use.
module.exports = {
  useAuthRequest: () => [null, null, () => {}],
  useAutoDiscovery: () => null,
  makeRedirectUri: () => '',
  startAsync: () => Promise.resolve({ type: 'dismiss' }),
  exchangeCodeAsync: () => Promise.resolve(null),
  refreshAsync: () => Promise.resolve(null),
  revokeAsync: () => Promise.resolve(false),
  fetchDiscoveryAsync: () => Promise.resolve(null),
  AuthRequest: class {},
  ResponseType: {},
  Prompt: {},
  CodeChallengeMethod: {},
};
