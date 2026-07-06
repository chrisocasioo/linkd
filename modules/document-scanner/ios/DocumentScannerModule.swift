import CoreImage
import ExpoModulesCore
import UIKit
import Vision

public class DocumentScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DocumentScanner")

    // One-shot: finds the largest rectangle (the card) in a single already-
    // captured photo and perspective-crops to it. Deliberately not a
    // continuous frame processor — that would need live per-frame tracking,
    // this only needs to run once at the moment a card is detected/captured.
    AsyncFunction("detectAndCrop") { (uri: String) throws -> String? in
      guard
        let url = URL(string: uri),
        // applyOrientationProperty bakes the photo's EXIF rotation into the
        // pixel data up front, so both the rectangle detector and the final
        // crop operate on an already right-side-up image.
        let ciImage = CIImage(contentsOf: url, options: [.applyOrientationProperty: true])
      else { return nil }

      let request = VNDetectRectanglesRequest()
      request.minimumAspectRatio = 0.3
      request.maximumAspectRatio = 1.0
      request.minimumConfidence = 0.7
      request.quadratureTolerance = 25
      request.maximumObservations = 1

      let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
      try handler.perform([request])

      guard let observation = request.results?.first as? VNRectangleObservation else {
        return nil
      }

      // Vision's normalized corners and CIImage's pixel space both use a
      // bottom-left origin, so this scale-up is a direct mapping — no flip.
      let extent = ciImage.extent
      func point(_ p: CGPoint) -> CIVector {
        CIVector(x: p.x * extent.width, y: p.y * extent.height)
      }

      guard let filter = CIFilter(name: "CIPerspectiveCorrection") else { return nil }
      filter.setValue(ciImage, forKey: kCIInputImageKey)
      filter.setValue(point(observation.topLeft), forKey: "inputTopLeft")
      filter.setValue(point(observation.topRight), forKey: "inputTopRight")
      filter.setValue(point(observation.bottomLeft), forKey: "inputBottomLeft")
      filter.setValue(point(observation.bottomRight), forKey: "inputBottomRight")

      guard let output = filter.outputImage else { return nil }

      // Software renderer — avoids the GPU-context pitfalls Core Image can hit
      // depending on the app's foreground/background state at capture time.
      let context = CIContext(options: [.useSoftwareRenderer: true])
      guard
        let cgImage = context.createCGImage(output, from: output.extent),
        let jpegData = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.85)
      else { return nil }

      let outputURL = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).jpg")
      try jpegData.write(to: outputURL)
      return outputURL.absoluteString
    }
  }
}
