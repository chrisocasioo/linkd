// Re-export the native module. On web/Android it resolves to the stub in
// DocumentScannerModule.web.ts / .android.ts; on iOS to DocumentScannerModule.ts
export { default } from './src/DocumentScannerModule';
export * from './src/DocumentScanner.types';
