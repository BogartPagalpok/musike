import AVFoundation
import Capacitor
import UIKit
import WebKit

/// Plays audio natively, so the music doesn't go through the web view's media stack.
///
/// WKWebView hands media to a separate process that YouTube cuts off after a few hundred kilobytes: the element
/// just pauses, with no error, about fifteen seconds in. AVPlayer uses the app's own network stack instead, which
/// reads the same URL from beginning to end. The web app drives it through the `musikeAudio` handler and gets
/// `window.__musikeAudioEvent(...)` back, so the player code doesn't have to know the difference.
final class MusikeAudio: NSObject, WKScriptMessageHandler {
    private static let allowedLocalExtensions: Set<String> = [
        "mp3", "m4a", "m4b", "aac", "wav", "flac", "ogg", "opus", "caf", "aif", "aiff",
    ]
    private static let minLocalDurationSec = 165.0
    private static let maxLocalDurationSec = 435.0
    private static var localFiles: [String: URL] = [:]

    private weak var webView: WKWebView?
    /// Durations as YouTube reported them, by stream URL. AVPlayer often guesses twice the real length for these
    /// audio-only streams, which would show a seven-minute song as fourteen.
    private static var knownDurations: [String: Double] = [:]
    private var player: AVPlayer?
    private var item: AVPlayerItem?
    private var knownDuration: Double?
    /// Set once the real end was reported, so a padded stream doesn't end a second time.
    private var ended = false
    private var ticker: Any?
    private var statusObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?

    var onStateChange: ((Bool, Double, Double) -> Void)?

    var hasPlayer: Bool { player != nil }
    var isPlaying: Bool { (player?.rate ?? 0) > 0 }
    var currentPosition: Double {
        guard let player else { return 0 }
        let sec = CMTimeGetSeconds(player.currentTime())
        return sec.isFinite ? max(0, sec) : 0
    }
    var currentDuration: Double {
        guard let item else { return knownDuration ?? 0 }
        return duration(from: CMTimeGetSeconds(item.duration))
    }

    func attach(_ webView: WKWebView?) {
        self.webView = webView
    }

    static func remember(url: String, duration: Double) {
        guard duration > 0 else { return }
        knownDurations[url] = duration
        if knownDurations.count > 40 { knownDurations.removeAll() }
    }

    // MARK: - What the web app sends

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "musikeAudio",
              let body = message.body as? [String: Any],
              let command = body["cmd"] as? String
        else { return }

        switch command {
        case "load":
            load(body["url"] as? String ?? "", startAt: body["startAt"] as? Double ?? 0)
        case "play":
            play()
        case "pause":
            pause()
        case "seek":
            seek(body["to"] as? Double ?? 0)
        case "volume":
            player?.volume = Float(body["value"] as? Double ?? 1)
        case "muted":
            player?.isMuted = body["value"] as? Bool ?? false
        case "scanLocal":
            scanLocalMusic()
        default:
            break
        }
    }

    // MARK: - Playback

    func remotePlay() {
        play()
    }

    func remotePause() {
        pause()
    }

    @discardableResult
    func remoteToggle() -> Bool {
        if isPlaying {
            pause()
            return false
        }
        play()
        return true
    }

    func remoteSeek(to position: Double) {
        seek(position)
    }

    private func load(_ link: String, startAt: Double) {
        tearDown()
        guard !link.isEmpty else {
            emit("error", ["message": "No stream"])
            return
        }
        let asset: AVURLAsset
        if let mapped = Self.localFiles[link] {
            asset = AVURLAsset(url: mapped)
        } else if link.hasPrefix("file://"), let fileUrl = URL(string: link) {
            asset = AVURLAsset(url: fileUrl)
        } else if link.hasPrefix("/") {
            asset = AVURLAsset(url: URL(fileURLWithPath: link))
        } else if let url = URL(string: link) {
            asset = AVURLAsset(url: url, options: [
                "AVURLAssetHTTPHeaderFieldsKey": [
                    "User-Agent": "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
                ],
            ])
        } else {
            emit("error", ["message": "Invalid stream"])
            return
        }
        let newItem = AVPlayerItem(asset: asset)
        knownDuration = Self.knownDurations[link]
        // Keep a visible amount ahead of the playhead, so the buffered part of the progress bar means something.
        newItem.preferredForwardBufferDuration = 30
        ended = false
        let newPlayer = AVPlayer(playerItem: newItem)
        newPlayer.automaticallyWaitsToMinimizeStalling = true
        newPlayer.volume = player?.volume ?? 1
        player = newPlayer
        item = newItem

        statusObservation = newItem.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            guard let self else { return }
            switch item.status {
            case .readyToPlay:
                let seconds = CMTimeGetSeconds(item.duration)
                self.emit("ready", ["duration": self.duration(from: seconds)])
                if startAt > 0 { self.seek(startAt) }
            case .failed:
                self.emit("error", ["message": item.error?.localizedDescription ?? "Playback failed"])
            default:
                break
            }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: newItem, queue: .main
        ) { [weak self] _ in
            self?.emit("ended")
        }
        ticker = newPlayer.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] time in
            guard let self, let item = self.item else { return }
            let position = CMTimeGetSeconds(time)
            self.emit("time", [
                "position": position,
                "duration": self.duration(from: CMTimeGetSeconds(item.duration)),
                "buffered": self.bufferedEnd(),
            ])
            // These audio streams carry silence past the song, and AVPlayer only calls it finished at the very end
            // of the file. The track really ends where YouTube says it does.
            if let known = self.knownDuration, !self.ended, position >= known - 0.5 {
                self.ended = true
                self.player?.pause()
                self.emit("ended")
            }
        }
    }

    private func duration(from measured: Double) -> Double {
        if let knownDuration { return knownDuration }
        return measured.isFinite ? measured : 0
    }

    private func play() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default)
        try? session.setActive(true)
        player?.play()
        emit("playing")
        onStateChange?(true, currentPosition, currentDuration)
    }

    private func pause() {
        player?.pause()
        emit("paused")
        onStateChange?(false, currentPosition, currentDuration)
    }

    private func seek(_ to: Double) {
        guard let player else { return }
        player.seek(
            to: CMTime(seconds: max(0, to), preferredTimescale: 600),
            toleranceBefore: .zero,
            toleranceAfter: .zero
        ) { [weak self] finished in
            guard let self, finished else { return }
            // AVPlayer reports the old position until the seek lands; the web side waits for this.
            self.emit("seeked", ["position": to])
            self.onStateChange?(self.isPlaying, to, self.currentDuration)
        }
    }

    // MARK: - Local Music Scanner (Documents)

    private func scanLocalMusic() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }
            let fm = FileManager.default
            guard let docsDir = fm.urls(for: .documentDirectory, in: .userDomainMask).first else {
                self.postLocalScan([])
                return
            }
            var scanned: [[String: Any]] = []
            var nextMap: [String: URL] = [:]
            if let enumerator = fm.enumerator(
                at: docsDir,
                includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
                options: [.skipsHiddenFiles]
            ) {
                for case let fileURL as URL in enumerator {
                    let vals = try? fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
                    guard vals?.isRegularFile == true else { continue }
                    let ext = fileURL.pathExtension.lowercased()
                    guard Self.allowedLocalExtensions.contains(ext) else { continue }
                    let fileName = fileURL.lastPathComponent
                    if fileName.range(of: "rec", options: .caseInsensitive) != nil { continue }

                    let asset = AVURLAsset(url: fileURL)
                    let duration = CMTimeGetSeconds(asset.duration)
                    guard duration.isFinite, duration >= Self.minLocalDurationSec, duration <= Self.maxLocalDurationSec else { continue }

                    var title: String?
                    var artist: String?
                    var album: String?
                    var artwork: String?

                    for meta in asset.commonMetadata {
                        guard let key = meta.commonKey else { continue }
                        switch key {
                        case .commonKeyTitle:
                            if title == nil { title = meta.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) }
                        case .commonKeyArtist:
                            if artist == nil { artist = meta.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) }
                        case .commonKeyAlbumName:
                            if album == nil { album = meta.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) }
                        case .commonKeyArtwork:
                            if artwork == nil, let data = meta.dataValue {
                                artwork = Self.thumbnailDataUri(from: data)
                            }
                        default:
                            break
                        }
                    }

                    if let t = title, !t.isEmpty, t.range(of: "rec", options: .caseInsensitive) != nil {
                        continue
                    }

                    let parsed = Self.parseFilenameMetadata(fileName)
                    let resolvedTitle = (title?.isEmpty == false ? title! : parsed.title)
                    let resolvedArtist = (artist?.isEmpty == false ? artist! : parsed.artist)
                    let id = Self.stableLocalId(for: fileURL.path)
                    nextMap[id] = fileURL

                    var item: [String: Any] = [
                        "id": id,
                        "title": resolvedTitle,
                        "artist": resolvedArtist,
                        "duration": Int(round(duration)),
                        "size": vals?.fileSize ?? 0,
                        "url": id,
                        "fileName": fileName,
                    ]
                    if let album, !album.isEmpty { item["album"] = album }
                    if let artwork { item["art"] = artwork; item["thumb"] = artwork }
                    scanned.append(item)
                }
            }

            DispatchQueue.main.async {
                Self.localFiles = nextMap
                self.postLocalScan(scanned)
            }
        }
    }

    private func postLocalScan(_ tracks: [[String: Any]]) {
        guard let data = try? JSONSerialization.data(withJSONObject: tracks),
              let json = String(data: data, encoding: .utf8)
        else { return }
        let js = "window.__musikeIosLocalMusic && window.__musikeIosLocalMusic(\(json))"
        if Thread.isMainThread {
            webView?.evaluateJavaScript(js)
        } else {
            DispatchQueue.main.async { [weak self] in self?.webView?.evaluateJavaScript(js) }
        }
    }

    private static func parseFilenameMetadata(_ name: String) -> (title: String, artist: String) {
        let base = (name as NSString).deletingPathExtension
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let range = base.range(of: " - ") {
            let artist = String(base[..<range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            let title = String(base[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !artist.isEmpty && !title.isEmpty {
                return (title, artist)
            }
        }
        return (base.isEmpty ? "Audio Track" : base, "Local File")
    }

    private static func stableLocalId(for path: String) -> String {
        var hash: UInt64 = 14695981039346656037
        for b in path.utf8 {
            hash ^= UInt64(b)
            hash &*= 1099511628211
        }
        return String(format: "local:ios-%016llx", hash)
    }

    private static func thumbnailDataUri(from data: Data) -> String? {
        guard let image = UIImage(data: data) else { return nil }
        let maxDim: CGFloat = 256
        let side = max(image.size.width, image.size.height, 1)
        let scale = min(1, maxDim / side)
        let targetSize = CGSize(width: max(1, round(image.size.width * scale)), height: max(1, round(image.size.height * scale)))
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let scaled = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        guard let jpeg = scaled.jpegData(compressionQuality: 0.72) else { return nil }
        return "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
    }

    private func bufferedEnd() -> Double {
        guard let range = item?.loadedTimeRanges.last?.timeRangeValue else { return 0 }
        return CMTimeGetSeconds(CMTimeAdd(range.start, range.duration))
    }

    private func tearDown() {
        if let ticker { player?.removeTimeObserver(ticker) }
        ticker = nil
        statusObservation = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = nil
        player?.pause()
        player = nil
        item = nil
    }

    private func emit(_ event: String, _ payload: [String: Any] = [:]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8)
        else { return }
        let js = "window.__musikeAudioEvent && window.__musikeAudioEvent('\(event)', \(json))"
        if Thread.isMainThread {
            webView?.evaluateJavaScript(js)
        } else {
            DispatchQueue.main.async { [weak self] in self?.webView?.evaluateJavaScript(js) }
        }
    }
}
