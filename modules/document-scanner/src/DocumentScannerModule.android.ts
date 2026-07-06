import { DocumentScannerModuleInterface } from './DocumentScanner.types';

// Rectangle detection uses Apple's Vision framework — iOS-only. Callers
// already treat a null result as "fall back to the uncropped photo".
const stub: DocumentScannerModuleInterface = {
  async detectAndCrop() {
    return null;
  },
};

export default stub;
