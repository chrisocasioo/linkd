// Re-export the native module. On web, it will be resolved to LiveActivityModule.web.ts
// and on native platforms to LiveActivityModule.ts
export { default } from './src/LiveActivityModule';
export * from './src/LiveActivity.types';
