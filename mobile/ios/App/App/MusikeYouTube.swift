import Foundation
import WebKit

/// Gets a playable stream URL for a video, the job yt-dlp does on a computer.
///
/// Two things make this native rather than JavaScript. First, YouTube bot-checks requests that arrive through the
/// web view's HTTP stack, while the same request from URLSession gets a plain answer. Second, the `ios` client stops
/// serving a stream after the first couple of megabytes (it wants a proof-of-origin token); `VISIONOS` still hands
/// out URLs the phone can read from beginning to end, and it only answers a session that already has a visitor id.
final class MusikeYouTube: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?

    private static let playerURL = URL(string: "https://www.youtube.com/youtubei/v1/player?prettyPrint=false")!
    private static let visitorURL = URL(string: "https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false")!
    private static let userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"
    private struct ClientSpec {
        let name: String
        let version: String
        let id: String
        let userAgent: String
        let fields: [String: Any]
    }
    private static let clients: [ClientSpec] = [
        ClientSpec(
            name: "VISIONOS",
            version: "1.02",
            id: "101",
            userAgent: userAgent,
            fields: [
                "platform": "DESKTOP",
            ]
        ),
        ClientSpec(
            name: "ANDROID",
            version: "20.10.38",
            id: "3",
            userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
            fields: [
                "androidSdkVersion": 34,
                "osName": "Android",
                "osVersion": "14",
            ]
        ),
        ClientSpec(
            name: "IOS",
            version: "20.10.4",
            id: "5",
            userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
            fields: [
                "deviceMake": "Apple",
                "deviceModel": "iPhone16,2",
                "osName": "iPhone",
                "osVersion": "18.1.0.22B83",
            ]
        ),
    ]
    private static let visitorKey = "musike:visitorData"
    private static let visitorAgeKey = "musike:visitorDataAt"
    private static let visitorTTL: TimeInterval = 24 * 3600

    func attach(_ webView: WKWebView?) {
        self.webView = webView
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "musikeResolve",
              let body = message.body as? [String: Any],
              let request = body["req"] as? Int,
              let id = body["id"] as? String
        else { return }
        resolve(
            videoId: id,
            lang: body["lang"] as? String ?? "en",
            region: body["region"] as? String ?? "US"
        ) { payload in
            DispatchQueue.main.async { [weak self] in
                guard let json = try? JSONSerialization.data(withJSONObject: payload),
                      let text = String(data: json, encoding: .utf8)
                else { return }
                self?.webView?.evaluateJavaScript("window.__musikeResolve && window.__musikeResolve(\(request), \(text))")
            }
        }
    }

    // MARK: - The two requests

    /// The player, with a visitor id YouTube accepts.
    private func resolve(videoId: String, lang: String, region: String, done: @escaping ([String: Any]) -> Void) {
        visitor(lang: lang, region: region) { [weak self] visitorData in
            guard let self else { return }
            self.tryClient(videoId: videoId, visitorData: visitorData, lang: lang, region: region, at: 0, done: done)
        }
    }

    private func tryClient(
        videoId: String, visitorData: String, lang: String, region: String, at index: Int,
        done: @escaping ([String: Any]) -> Void
    ) {
        guard index < Self.clients.count else {
            NSLog("Musike: every YouTube client was refused for %@", videoId)
            done(["error": "YouTube asked for an anti-bot check.", "code": "bot_check"])
            return
        }
        let client = Self.clients[index]
        let body = playerBody(videoId: videoId, visitorData: visitorData, lang: lang, region: region, client: client)
        post(Self.playerURL, body, client: client) { [weak self] result in
            guard let self else { return }
            let status = (result?["playabilityStatus"] as? [String: Any])?["status"] as? String ?? "no answer"
            guard status == "OK" else {
                self.tryClient(videoId: videoId, visitorData: visitorData, lang: lang, region: region, at: index + 1, done: done)
                return
            }
            let details = result?["videoDetails"] as? [String: Any] ?? [:]
            let streamingData = result?["streamingData"] as? [String: Any]
            let allowAdaptive = client.name == "VISIONOS"
            let adaptiveAudio = allowAdaptive
                ? (streamingData?["adaptiveFormats"] as? [[String: Any]] ?? [])
                    .filter { ($0["mimeType"] as? String)?.hasPrefix("audio/") == true && $0["url"] != nil }
                    .sorted { Self.int($0["bitrate"]) > Self.int($1["bitrate"]) }
                : []
            let mp4Audio = adaptiveAudio.filter { ($0["mimeType"] as? String)?.hasPrefix("audio/mp4") == true }
            let progressive = (streamingData?["formats"] as? [[String: Any]] ?? [])
                .filter { $0["url"] != nil }
                .sorted { Self.int($0["bitrate"]) > Self.int($1["bitrate"]) }
            guard let best = mp4Audio.first ?? adaptiveAudio.first ?? progressive.first,
                  let url = best["url"] as? String else {
                self.tryClient(videoId: videoId, visitorData: visitorData, lang: lang, region: region, at: index + 1, done: done)
                return
            }
            MusikeAudio.remember(url: url, duration: Double(Self.int(details["lengthSeconds"])))
            done([
                "url": url,
                "mime": best["mimeType"] as? String ?? "audio/mp4",
                "title": details["title"] as? String ?? "",
                "duration": Self.int(details["lengthSeconds"]),
            ])
        }
    }

    private func playerBody(
        videoId: String, visitorData: String, lang: String, region: String,
        client chosen: ClientSpec
    ) -> [String: Any] {
        var c = client(lang: lang, region: region, chosen: chosen)
        if chosen.name == "VISIONOS" {
            c["visitorData"] = visitorData
        }
        return [
            "videoId": videoId,
            "racyCheckOk": true,
            "contentCheckOk": true,
            "context": ["client": c],
        ]
    }

    private func client(lang: String, region: String, chosen: ClientSpec? = nil) -> [String: Any] {
        let picked = chosen ?? Self.clients[0]
        var dict: [String: Any] = [
            "clientName": picked.name,
            "clientVersion": picked.version,
            "hl": lang,
            "gl": region,
        ]
        for (k, v) in picked.fields {
            dict[k] = v
        }
        return dict
    }

    /// The visitor id YouTube handed this install, kept for a day; a request without one is bot-checked.
    private func visitor(lang: String, region: String, done: @escaping (String) -> Void) {
        let defaults = UserDefaults.standard
        let age = Date().timeIntervalSince1970 - defaults.double(forKey: Self.visitorAgeKey)
        if let cached = defaults.string(forKey: Self.visitorKey), !cached.isEmpty, age < Self.visitorTTL {
            done(cached)
            return
        }
        let vision = Self.clients.last!
        post(Self.visitorURL, ["context": ["client": client(lang: lang, region: region, chosen: vision)]], client: vision) { [weak self] json in
            let fresh = ((json?["responseContext"] as? [String: Any])?["visitorData"] as? String) ?? ""
            if !fresh.isEmpty {
                defaults.set(fresh, forKey: Self.visitorKey)
                defaults.set(Date().timeIntervalSince1970, forKey: Self.visitorAgeKey)
            }
            done(fresh.isEmpty ? (defaults.string(forKey: Self.visitorKey) ?? "") : fresh)
            _ = self
        }
    }

    private func post(_ url: URL, _ body: [String: Any], client: ClientSpec, done: @escaping ([String: Any]?) -> Void) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(client.id, forHTTPHeaderField: "X-YouTube-Client-Name")
        request.setValue(client.version, forHTTPHeaderField: "X-YouTube-Client-Version")
        request.setValue("https://www.youtube.com", forHTTPHeaderField: "Origin")
        request.setValue(client.userAgent, forHTTPHeaderField: "User-Agent")
        URLSession(configuration: .ephemeral).downloadTask(with: request) { fileURL, _, error in
            guard error == nil, let fileURL, let data = try? Data(contentsOf: fileURL) else {
                done(nil)
                return
            }
            done(try? JSONSerialization.jsonObject(with: data) as? [String: Any])
        }.resume()
    }

    private static func int(_ value: Any?) -> Int {
        if let n = value as? Int { return n }
        if let s = value as? String { return Int(s) ?? 0 }
        if let n = value as? NSNumber { return n.intValue }
        return 0
    }
}
