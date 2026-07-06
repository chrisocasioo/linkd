import { NativeModule, requireNativeModule } from 'expo';
import { DocumentScannerModuleInterface } from './DocumentScanner.types';

declare class DocumentScannerModule extends NativeModule<{}> implements DocumentScannerModuleInterface {
  detectAndCrop(uri: string): Promise<string | null>;
}

export default requireNativeModule<DocumentScannerModule>('DocumentScanner');
