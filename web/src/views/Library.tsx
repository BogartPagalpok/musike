import { DatabaseIcon, PlusIcon } from "../components/icons";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Cover, type CoverKind } from "../components/Cover";
import { NamePlaylistDialog } from "../components/Dialogs";
import { PageHeader } from "../components/Page";
import { useT } from "../i18n";
import { paths } from "../lib/routes";
import type { Track } from "../lib/types";
import { IconButton } from "../components/IconButton";
import { useDeviceFiles } from "../stores/deviceFiles";
import { useLibrary } from "../stores/library";
import { useOffline } from "../stores/offline";
import { useUi } from "../stores/ui";

function Entry({ to, name, kind, tracks, sub }: { to: string; name: string; kind: CoverKind; tracks: Track[]; sub: string }) {
  return (
    <li>
      <Link
        to={to}
        className="group flex items-center gap-3.5 rounded-[14px] bg-surface-2/90 p-2.5 ring-1 ring-line transition-colors hover:bg-surface-3 @[460px]:flex-col @[460px]:items-stretch @[460px]:bg-transparent @[460px]:p-3 @[460px]:ring-0 @[460px]:hover:bg-surface-2"
      >
        <Cover
          kind={kind}
          tracks={tracks}
          iconSize={26}
          className="size-14 shrink-0 rounded-[11px] @[460px]:aspect-square @[460px]:size-auto @[460px]:w-full @[460px]:rounded-[14px] @[460px]:shadow-[0_12px_32px_rgb(0_0_0/0.3)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[14.5px] text-fg leading-snug">{name}</span>
          <span className="block truncate text-xs text-fg-2 mt-0.5 leading-snug">{sub}</span>
        </span>
      </Link>
    </li>
  );
}

export default function Library() {
  const { favorites, playlists, history, createPlaylist } = useLibrary();
  const offlineTracks = useOffline((s) => s.tracks);
  const deviceTracks = useDeviceFiles((s) => s.tracks);
  const [creating, setCreating] = useState(false);
  const setDataOpen = useUi((s) => s.setDataOpen);
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="pb-8 @container">
      <PageHeader
        title={t.nav.library}
        actions={
          <>
          <IconButton label={t.library.backup} onClick={() => setDataOpen(true)}>
            <DatabaseIcon size={20} />
          </IconButton>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-accent pr-3.5 pl-3 text-xs font-semibold text-accent-ink transition-transform active:scale-[0.97]"
          >
            <PlusIcon size={16} weight="bold" /> <span className="hidden sm:inline">{t.nav.newPlaylist}</span>
            <span className="sm:hidden">{t.library.newShort}</span>
          </button>
          </>
        }
      />

      <ul className="grid grid-cols-1 gap-2 px-3 pt-2 @[460px]:grid-cols-2 @[700px]:grid-cols-3 @[960px]:grid-cols-4 @[1300px]:grid-cols-6 @[460px]:gap-2.5">
        <Entry to={paths.favorites} name={t.nav.favorites} kind="favorites" tracks={favorites} sub={t.common.tracks(favorites.length)} />
        <Entry to={paths.downloads} name={t.nav.downloads} kind="downloads" tracks={offlineTracks} sub={t.common.tracks(offlineTracks.length)} />
        <Entry to={paths.device} name={t.device.title} kind="device" tracks={deviceTracks} sub={t.common.tracks(deviceTracks.length)} />
        <Entry to={paths.themes} name={t.nav.themes} kind="themes" tracks={[]} sub="Custom player & backdrops" />
        <Entry to={paths.history} name={t.nav.recentlyPlayed} kind="history" tracks={history} sub={t.common.tracks(history.length)} />
        {playlists.map((p) => (
          <Entry
            key={p.id}
            to={paths.playlist(p.id)}
            name={p.name}
            kind="playlist"
            tracks={p.tracks}
            sub={t.library.playlistSub(p.tracks.length)}
          />
        ))}
      </ul>

      {playlists.length === 0 && (
        <p className="px-4 pt-6 text-sm text-fg-2 md:px-6">
          {t.library.noPlaylists}
        </p>
      )}

      <NamePlaylistDialog
        open={creating}
        title={t.nav.newPlaylist}
        action={t.library.create}
        onClose={() => setCreating(false)}
        onSubmit={async (name) => {
          const p = await createPlaylist(name);
          setCreating(false);
          if (p) navigate(paths.playlist(p.id));
        }}
      />
    </div>
  );
}
