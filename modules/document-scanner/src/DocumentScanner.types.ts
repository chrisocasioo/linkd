export interface DocumentScannerModuleInterface {
  /**
   * Finds the largest rectangle (the card) in a photo at `uri` and returns a
   * local file URI for a perspective-corrected crop of just that rectangle,
   * or null if no confident rectangle was found (caller should fall back to
   * the original uncropped photo).
   */
  detectAndCrop(uri: string): Promise<string | null>;
}
