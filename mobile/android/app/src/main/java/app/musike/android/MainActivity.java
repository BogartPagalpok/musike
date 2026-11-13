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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (PlaybackService.state.playing && PlaybackService.state.isVideo) {
                enterPictureInPicture();
            }
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

        // 4. Audio Mode (Minimize to audio)
        Intent audioIntent = new Intent(this, PlaybackService.class).setAction("app.musike.android.action.audio_mode");
        PendingIntent audioPending = PendingIntent.getService(this, 204, audioIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        actions.add(new RemoteAction(
            Icon.createWithResource(this, R.drawable.ic_audio_mode),
            "Audio Mode",
            "Switch to Audio Mode",
            audioPending
        ));

        builder.setActions(actions);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(PlaybackService.state.playing && PlaybackService.state.isVideo);
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
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            String script = "document.documentElement.dataset.pip = '" + (isInPictureInPictureMode ? "1" : "0") + "';" +
                            "window.dispatchEvent(new CustomEvent('pipchange', { detail: { active: " + isInPictureInPictureMode + " } }));";
            webView.evaluateJavascript(script, null);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Keep WebView rendering & JS loop alive so background playback continues uninterrupted
        if (PlaybackService.state.playing) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.onResume();
            }
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (PlaybackService.state.playing) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.onResume();
            }
        }
    }
}
