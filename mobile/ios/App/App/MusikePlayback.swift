import AVFoundation
import Capacitor
import MediaPlayer
import UIKit
import WebKit

/// The iOS side of the player: the lock screen, Control Center and the headphone buttons.
///
/// The web app talks to it over the `musikeMedia` message handler (web/src/native/media.ts) and it talks back with
/// `window.__musikeMediaAction(...)` — the same actions Android's MusikePlaybackPlugin sends, so the player code on
/// both platforms is the one already written for Android.
final class MusikePlayback: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?
    private weak var audio: MusikeAudio?
    private var nowPlaying: [String: Any] = [:]
    private var artworks: [String: MPMediaItemArtwork] = [:]
    private var artworkURL = ""
    private var artworkTask: URLSessionDataTask?

    override init() {
        super.init()
        let session = AVAudioSession.sharedInstance()
        // Playback: the music keeps going with the screen off. Activating it happens when something plays, so the
        // app doesn't take the audio away from whatever the user was listening to before opening Musike.
        try? session.setCategory(.playback, mode: .default)
        configureCommands()
    }

    /** Called once the web view and native audio engine exist, so the lock screen's buttons stay responsive. */
    func attach(_ webView: WKWebView?, audio: MusikeAudio? = nil) {
        self.webView = webView
        self.audio = audio
        audio?.onStateChange = { [weak self] playing, position, duration in
            guard let self else { return }
            self.nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position
            self.nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
            if duration > 0 { self.nowPlaying[MPMediaItemPropertyPlaybackDuration] = duration }
            self.publish(state: playing ? .playing : .paused)
        }
    }

    // MARK: - The lock screen's buttons

    private func configureCommands() {
        DispatchQueue.main.async {
            UIApplication.shared.beginReceivingRemoteControlEvents()
        }
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        center.nextTrackCommand.isEnabled = true
        center.previousTrackCommand.isEnabled = true
        center.changePlaybackPositionCommand.isEnabled = true

        center.playCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            if let audio = self.audio, audio.hasPlayer {
                self.runOnMain { audio.remotePlay() }
            }
            self.send("play")
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            if let audio = self.audio, audio.hasPlayer {
                self.runOnMain { audio.remotePause() }
            }
            self.send("pause")
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            if let audio = self.audio, audio.hasPlayer {
                self.runOnMain {
                    let nowPlaying = audio.remoteToggle()
                    self.send(nowPlaying ? "play" : "pause")
                }
            } else {
                self.send("toggle")
            }
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            self?.send("next")
            return .success
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            self?.send("previous")
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let self, let seek = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            if let audio = self.audio, audio.hasPlayer {
                self.runOnMain { audio.remoteSeek(to: seek.positionTime) }
            }
            self.send("seek", position: seek.positionTime)
            return .success
        }
    }

    private func runOnMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    private func send(_ action: String, position: Double? = nil) {
        var js = "window.__musikeMediaAction && window.__musikeMediaAction('\(action)')"
        if let position { js = "window.__musikeMediaAction && window.__musikeMediaAction('\(action)', \(position))" }
        DispatchQueue.main.async { [weak self] in
            var bgTask: UIBackgroundTaskIdentifier = .invalid
            bgTask = UIApplication.shared.beginBackgroundTask(withName: "MusikeRemote_\(action)") {
                if bgTask != .invalid {
                    UIApplication.shared.endBackgroundTask(bgTask)
                    bgTask = .invalid
                }
            }
            guard let webView = self?.webView else {
                if bgTask != .invalid {
                    UIApplication.shared.endBackgroundTask(bgTask)
                    bgTask = .invalid
                }
                return
            }
            webView.evaluateJavaScript(js) { _, _ in
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                    if bgTask != .invalid {
                        UIApplication.shared.endBackgroundTask(bgTask)
                        bgTask = .invalid
                    }
                }
            }
        }
    }

    // MARK: - What the web app sends

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "musikeMedia",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String
        else { return }
        switch type {
        case "track": setTrack(body)
        case "state": setState(body)
        default: break
        }
    }

    private func setTrack(_ body: [String: Any]) {
        nowPlaying[MPMediaItemPropertyTitle] = body["title"] as? String ?? ""
        nowPlaying[MPMediaItemPropertyArtist] = body["artist"] as? String ?? ""
        nowPlaying[MPMediaItemPropertyAlbumTitle] = body["album"] as? String ?? ""
        nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = number(body["position"])
        if number(body["duration"]) > 0 { nowPlaying[MPMediaItemPropertyPlaybackDuration] = number(body["duration"]) }
        publish()
        if let link = body["artwork"] as? String { loadArtwork(link) }
    }

    private func setState(_ body: [String: Any]) {
        let playing = body["playing"] as? Bool ?? false
        nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = number(body["position"])
        nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
        if number(body["duration"]) > 0 { nowPlaying[MPMediaItemPropertyPlaybackDuration] = number(body["duration"]) }
        if playing { try? AVAudioSession.sharedInstance().setActive(true) }
        publish(state: playing ? .playing : .paused)
    }

    private func publish(state: MPNowPlayingPlaybackState? = nil) {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlaying
        if let state { MPNowPlayingInfoCenter.default().playbackState = state }
    }

    private func number(_ value: Any?) -> Double {
        if let d = value as? Double { return d }
        if let n = value as? NSNumber { return n.doubleValue }
        return 0
    }

    // MARK: - Artwork

    private func loadArtwork(_ link: String) {
        guard !link.isEmpty, link != artworkURL else { return }
        artworkURL = link
        if let cached = artworks[link] {
            nowPlaying[MPMediaItemPropertyArtwork] = cached
            publish()
            return
        }
        if link.hasPrefix("data:image/"), let comma = link.firstIndex(of: ",") {
            let b64 = String(link[link.index(after: comma)...])
            if let data = Data(base64Encoded: b64), let image = UIImage(data: data) {
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                cacheArtwork(artwork, for: link)
            }
            return
        }
        if link.hasPrefix("file://"), let url = URL(string: link), let data = try? Data(contentsOf: url), let image = UIImage(data: data) {
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            cacheArtwork(artwork, for: link)
            return
        }
        guard let url = URL(string: link), url.scheme == "https" || url.scheme == "http" else { return }
        artworkTask?.cancel()
        artworkTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data, let image = UIImage(data: data), link == self.artworkURL else { return }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            DispatchQueue.main.async {
                self.cacheArtwork(artwork, for: link)
            }
        }
        artworkTask?.resume()
    }

    private func cacheArtwork(_ artwork: MPMediaItemArtwork, for link: String) {
        if artworks.count > 8 { artworks.removeAll() }
        artworks[link] = artwork
        nowPlaying[MPMediaItemPropertyArtwork] = artwork
        publish()
    }
}
