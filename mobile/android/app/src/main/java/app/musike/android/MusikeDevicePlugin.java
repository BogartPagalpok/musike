package app.musike.android;

import android.Manifest;
import android.app.UiModeManager;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import com.getcapacitor.Bridge;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.util.Locale;

/** What kind of device the app runs on and access to local audio storage (web/src/native/android.ts). */
@CapacitorPlugin(
    name = "MusikeDevice",
    permissions = {
        @Permission(alias = "audio33", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
    }
)
public class MusikeDevicePlugin extends Plugin {

    private static final long MIN_DURATION_MS = 165_000L; // ~3 min (with tolerance for 2:45+ tracks)
    private static final long MAX_DURATION_MS = 435_000L; // ~7 min (with tolerance up to 7:15)

    private String audioPermissionAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "audio33" : "storage";
    }

    @PluginMethod
    public void info(PluginCall call) {
        Context context = getContext();
        UiModeManager uiMode = (UiModeManager) context.getSystemService(Context.UI_MODE_SERVICE);
        boolean tv =
            (uiMode != null && uiMode.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) ||
            context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK);
        JSObject result = new JSObject();
        result.put("tv", tv);
        call.resolve(result);
    }

    @PluginMethod
    public void scanLocalMusic(PluginCall call) {
        String alias = audioPermissionAlias();
        if (getPermissionState(alias) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias, call, "scanPermissionCallback");
            return;
        }
        performScan(call);
    }

    @PermissionCallback
    private void scanPermissionCallback(PluginCall call) {
        if (getPermissionState(audioPermissionAlias()) != PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("tracks", new JSArray());
            call.resolve(result);
            return;
        }
        performScan(call);
    }

    private void performScan(PluginCall call) {
        new Thread(() -> {
            JSArray tracks = new JSArray();
            Context context = getContext();
            Bridge bridge = getBridge();
            if (context == null || bridge == null) {
                JSObject empty = new JSObject();
                empty.put("tracks", tracks);
                call.resolve(empty);
                return;
            }
            ContentResolver resolver = context.getContentResolver();
            String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.DATA,
            };
            String selection = MediaStore.Audio.Media.DURATION + " >= ? AND " + MediaStore.Audio.Media.DURATION + " <= ?";
            String[] selectionArgs = { String.valueOf(MIN_DURATION_MS), String.valueOf(MAX_DURATION_MS) };
            String sortOrder = MediaStore.Audio.Media.DATE_ADDED + " DESC";
            try (Cursor cursor = resolver.query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection, selection, selectionArgs, sortOrder)) {
                if (cursor != null) {
                    int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                    int titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                    int artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                    int albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                    int durCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                    int sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE);
                    int nameCol = cursor.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME);
                    int dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA);
                    String localUrl = bridge.getLocalUrl();
                    while (cursor.moveToNext()) {
                        long id = cursor.getLong(idCol);
                        long durMs = cursor.getLong(durCol);
                        int durSec = Math.round(durMs / 1000.0f);
                        if (durSec < 165 || durSec > 435) continue;

                        String displayName = nameCol >= 0 ? cursor.getString(nameCol) : "";
                        String rawTitle = titleCol >= 0 ? cursor.getString(titleCol) : "";
                        String dataPath = dataCol >= 0 ? cursor.getString(dataCol) : "";
                        String baseFile = dataPath != null && !dataPath.isEmpty() ? new File(dataPath).getName() : "";

                        // Exclude recordings / files containing "rec" (case-insensitive) in filename or title.
                        String checkStr = ((displayName != null ? displayName : "") + "\n" + (rawTitle != null ? rawTitle : "") + "\n" + baseFile).toLowerCase(Locale.ROOT);
                        if (checkStr.contains("rec")) continue;

                        String title = rawTitle != null ? rawTitle.trim() : "";
                        String artist = artistCol >= 0 && cursor.getString(artistCol) != null ? cursor.getString(artistCol).trim() : "";
                        String album = albumCol >= 0 && cursor.getString(albumCol) != null ? cursor.getString(albumCol).trim() : "";
                        if (artist.isEmpty() || "<unknown>".equalsIgnoreCase(artist)) artist = "Local File";
                        if (album.isEmpty() || "<unknown>".equalsIgnoreCase(album)) album = "";

                        String fallbackName = displayName != null && !displayName.isEmpty() ? displayName : baseFile;
                        if (title.isEmpty() && !fallbackName.isEmpty()) {
                            String stem = fallbackName.replaceFirst("\\.[^.]+$", "").replace('_', ' ').trim();
                            int dash = stem.indexOf(" - ");
                            if (dash > 0 && dash < stem.length() - 3) {
                                if ("Local File".equals(artist)) artist = stem.substring(0, dash).trim();
                                title = stem.substring(dash + 3).trim();
                            } else {
                                title = stem;
                            }
                        }
                        if (title.isEmpty()) title = "Audio Track";

                        String playableUrl;
                        if (dataPath != null && !dataPath.isEmpty() && new File(dataPath).canRead()) {
                            playableUrl = localUrl + Bridge.CAPACITOR_FILE_START + Uri.encode(dataPath, "/");
                        } else {
                            Uri contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                            String contentPath = contentUri.toString().substring("content:/".length());
                            playableUrl = localUrl + Bridge.CAPACITOR_CONTENT_START + contentPath;
                        }

                        long size = sizeCol >= 0 ? cursor.getLong(sizeCol) : 0;
                        JSObject item = new JSObject();
                        item.put("id", "local:android-" + id);
                        item.put("title", title);
                        item.put("artist", artist);
                        if (!album.isEmpty()) item.put("album", album);
                        item.put("duration", durSec);
                        item.put("size", size);
                        item.put("url", playableUrl);
                        if (!fallbackName.isEmpty()) item.put("fileName", fallbackName);
                        tracks.put(item);
                    }
                }
            } catch (Exception ignored) {
                // Storage permission unavailable or MediaStore failed; resolve with empty list.
            }
            JSObject result = new JSObject();
            result.put("tracks", tracks);
            call.resolve(result);
        }).start();
    }
}
