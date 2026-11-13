package app.musike.android;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {

    private static MainActivity instance;
    private boolean exitingPipToBackground = false;

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        instance = this;
        registerPlugin(MusikePlaybackPlugin.class);
        registerPlugin(MusikeDevicePlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
        }

        // Draw behind the status and navigation bars on every Android version
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
        updatePipParams();
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Automatically switch video playback to continuous background audio when leaving the app.
        if (PlaybackService.state.playing || PlaybackService.state.isVideo) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                if (PlaybackService.state.isVideo) {
                    PlaybackService.state.isVideo = false;
                    webView.evaluateJavascript(
                        "window.__musikeSwitchToAudioOnBackground && window.__musikeSwitchToAudioOnBackground();",
                        null
                    );
                }
                webView.onResume();
                webView.resumeTimers();
            }
            updatePipParams();
        }
    }

    public void enterPictureInPicture() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams params = buildPipParams();
            try {
                enterPictureInPictureMode(params);
            } catch (IllegalStateException | IllegalArgumentException ignored) {
            }
        }
    }

    private PictureInPictureParams buildPipParams() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null;

        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
        builder.setAspectRatio(new Rational(16, 9));

        ArrayList<RemoteAction> actions = new ArrayList<>();

        // 1. Previous
        Intent prevIntent = new Intent(this, PlaybackService.class).setAction("app.musike.android.action.previous");
        PendingIntent prevPending = PendingIntent.getService(this, 201, prevIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        actions.add(new RemoteAction(Icon.createWithResource(this, R.drawable.ic_media_previous), "Previous", "Previous", prevPending));

        // 2. Play/Pause
        boolean playing = PlaybackService.state.playing;
        Intent toggleIntent = new Intent(this, PlaybackService.class).setAction(playing ? "app.musike.android.action.pause" : "app.musike.android.action.play");
        PendingIntent togglePending = PendingIntent.getService(this, 202, toggleIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        actions.add(new RemoteAction(
            Icon.createWithResource(this, playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play),
            playing ? "Pause" : "Play",
            playing ? "Pause" : "Play",
            togglePending
        ));

        // 3. Next
        Intent nextIntent = new Intent(this, PlaybackService.class).setAction("app.musike.android.action.next");
        PendingIntent nextPending = PendingIntent.getService(this, 203, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        actions.add(new RemoteAction(Icon.createWithResource(this, R.drawable.ic_media_next), "Next", "Next", nextPending));

        // 4. Listen Button (Minimize video to continuous background audio)
        Intent audioIntent = new Intent(this, PlaybackService.class).setAction("app.musike.android.action.audio_mode");
        PendingIntent audioPending = PendingIntent.getService(this, 204, audioIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        actions.add(new RemoteAction(
            Icon.createWithResource(this, R.drawable.ic_audio_mode),
            "Listen",
            "Listen in background (Minimize)",
            audioPending
        ));

        builder.setActions(actions);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(false);
            builder.setSeamlessResizeEnabled(true);
        }

        return builder.build();
    }

    public void updatePipParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams params = buildPipParams();
            if (params != null) {
                try {
                    setPictureInPictureParams(params);
                } catch (IllegalStateException ignored) {
                }
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (exitingPipToBackground && (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !isInPictureInPictureMode())) {
            exitingPipToBackground = false;
            moveTaskToBack(true);
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            String script = "document.documentElement.dataset.pip = '" + (isInPictureInPictureMode ? "1" : "0") + "';" +
                            "window.dispatchEvent(new CustomEvent('pipchange', { detail: { active: " + isInPictureInPictureMode + " } }));";
            webView.evaluateJavascript(script, null);
        }
        if (!isInPictureInPictureMode && exitingPipToBackground) {
            exitingPipToBackground = false;
            moveTaskToBack(true);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (exitingPipToBackground && (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !isInPictureInPictureMode())) {
            exitingPipToBackground = false;
            moveTaskToBack(true);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Switch video to audio on app exit and keep WebView rendering & JS loop alive for continuous playback.
        if (PlaybackService.state.playing || PlaybackService.state.isVideo || exitingPipToBackground) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                if (PlaybackService.state.isVideo) {
                    PlaybackService.state.isVideo = false;
                    webView.evaluateJavascript(
                        "window.__musikeSwitchToAudioOnBackground && window.__musikeSwitchToAudioOnBackground();",
                        null
                    );
                }
                webView.onResume();
                webView.resumeTimers();
            }
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (PlaybackService.state.playing || exitingPipToBackground) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.onResume();
                webView.resumeTimers();
            }
        }
    }

    public void exitPipToBackground() {
        runOnUiThread(() -> {
            try {
                PlaybackService.state.isVideo = false;
                updatePipParams();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode()) {
                    exitingPipToBackground = true;
                    Intent unpin = new Intent(this, MainActivity.class);
                    unpin.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
                    startActivity(unpin);
                    moveTaskToBack(true);
                } else {
                    exitingPipToBackground = false;
                    moveTaskToBack(true);
                }
            } catch (Exception ignored) {
                exitingPipToBackground = false;
            }
        });
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        super.onDestroy();
    }
}
