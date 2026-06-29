// Stub for react-dom — not available in React Native; @clerk/clerk-react imports it but doesn't use it at runtime on native.
module.exports = {
  createPortal: () => null,
  findDOMNode: () => null,
  unmountComponentAtNode: () => false,
  render: () => null,
  hydrate: () => null,
  flushSync: (fn) => fn(),
};
