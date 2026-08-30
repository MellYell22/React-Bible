import Foundation
import AVFoundation
import AppKit

// usage: encode <framesDir> <audio.mp3> <audioStartSeconds> <out.mp4>
let args = CommandLine.arguments
guard args.count == 5 else { fputs("bad args\n", stderr); exit(2) }
let framesDir = args[1], audioPath = args[2]
let audioStart = Double(args[3]) ?? 0, outPath = args[4]

let fps: Int32 = 30
let W = 1080, H = 1920

let fm = FileManager.default
let frames = try fm.contentsOfDirectory(atPath: framesDir)
    .filter { $0.hasSuffix(".png") }.sorted()
guard !frames.isEmpty else { fputs("no frames\n", stderr); exit(2) }
print("frames: \(frames.count)")

let tmpVideo = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent("bms-video-\(UUID().uuidString).mp4")

// ── Pass 1: PNG sequence -> H.264 video-only track ────────────────────
let writer = try AVAssetWriter(outputURL: tmpVideo, fileType: .mp4)
let vSettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: W,
    AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 12_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: fps,
    ],
]
let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: vSettings)
vInput.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: vInput,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
        kCVPixelBufferWidthKey as String: W,
        kCVPixelBufferHeightKey as String: H,
    ])
writer.add(vInput)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let colorSpace = CGColorSpaceCreateDeviceRGB()
let queue = DispatchQueue(label: "encode")
let done = DispatchSemaphore(value: 0)
var index = 0

vInput.requestMediaDataWhenReady(on: queue) {
    while vInput.isReadyForMoreMediaData {
        if index >= frames.count {
            vInput.markAsFinished()
            done.signal()
            return
        }
        let path = (framesDir as NSString).appendingPathComponent(frames[index])
        guard let img = NSImage(contentsOfFile: path),
              let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            fputs("cannot read \(path)\n", stderr); exit(3)
        }
        var pbOut: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pbOut)
        guard let pb = pbOut else { fputs("no pixel buffer\n", stderr); exit(3) }

        CVPixelBufferLockBaseAddress(pb, [])
        if let ctx = CGContext(
            data: CVPixelBufferGetBaseAddress(pb),
            width: W, height: H, bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
                | CGBitmapInfo.byteOrder32Little.rawValue) {
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
        }
        CVPixelBufferUnlockBaseAddress(pb, [])

        adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(index), timescale: fps))
        index += 1
        if index % 90 == 0 { print("encoded \(index)/\(frames.count)") }
    }
}
done.wait()
let finished = DispatchSemaphore(value: 0)
writer.finishWriting { finished.signal() }
finished.wait()
guard writer.status == .completed else {
    fputs("video write failed: \(writer.error?.localizedDescription ?? "?")\n", stderr); exit(4)
}
print("video track done")

// ── Pass 2: mux David's voice in at the beat where the app appears ─────
let comp = AVMutableComposition()
let videoAsset = AVURLAsset(url: tmpVideo)
let audioAsset = AVURLAsset(url: URL(fileURLWithPath: audioPath))

let sem = DispatchSemaphore(value: 0)
Task {
    do {
        let vTracks = try await videoAsset.loadTracks(withMediaType: .video)
        let aTracks = try await audioAsset.loadTracks(withMediaType: .audio)
        let vDur = try await videoAsset.load(.duration)
        let aDur = try await audioAsset.load(.duration)

        let vComp = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
        try vComp.insertTimeRange(CMTimeRange(start: .zero, duration: vDur), of: vTracks[0], at: .zero)

        if let a = aTracks.first {
            let aComp = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
            let at = CMTime(seconds: audioStart, preferredTimescale: 600)
            // Never let the voice run past the end of picture.
            let room = CMTimeSubtract(vDur, at)
            let use = CMTimeMinimum(aDur, room)
            try aComp.insertTimeRange(CMTimeRange(start: .zero, duration: use), of: a, at: at)
        }
        sem.signal()
    } catch {
        fputs("mux failed: \(error)\n", stderr); exit(5)
    }
}
sem.wait()

try? fm.removeItem(atPath: outPath)
guard let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality) else {
    fputs("no export session\n", stderr); exit(6)
}
export.outputURL = URL(fileURLWithPath: outPath)
export.outputFileType = .mp4
export.shouldOptimizeForNetworkUse = true

let expDone = DispatchSemaphore(value: 0)
export.exportAsynchronously { expDone.signal() }
expDone.wait()

guard export.status == .completed else {
    fputs("export failed: \(export.error?.localizedDescription ?? "?")\n", stderr); exit(7)
}
try? fm.removeItem(at: tmpVideo)
print("wrote \(outPath)")
