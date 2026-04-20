import { Link } from 'react-router';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { BrandMarkIcon, LayoutPanelIcon } from '../ui/icons';

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  isConnected: boolean;
  isHost: boolean;
  onLeave: () => void;
  onToggleSidebar: () => void;
}

export function RoomHeader({
  roomName,
  roomCode,
  isConnected,
  isHost,
  onLeave,
  onToggleSidebar,
}: RoomHeaderProps) {
  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {
      // Ignore clipboard failures.
    }
  };

  return (
    <header className="relative z-30 flex h-18 shrink-0 items-center justify-between px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3 md:gap-5">
        <Link
          to="/"
          className="inline-flex items-center gap-3 rounded-full border border-outline-variant/15 bg-black/30 px-4 py-2 text-sm font-black tracking-[0.22em] text-primary shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:border-primary-container/35 hover:text-white"
        >
          <BrandMarkIcon size={17} />
          <span className="hidden sm:inline">SyncWatch</span>
        </Link>

        <div className="min-w-0">
          <p className="truncate text-base font-black tracking-tight text-on-surface md:text-lg">
            {roomName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
            <button
              onClick={copyRoomCode}
              className="rounded-full border border-outline-variant/15 bg-black/25 px-3 py-1 transition hover:border-primary-container/40 hover:text-primary"
            >
              {roomCode}
            </button>
            <Badge tone={isConnected ? 'success' : 'neutral'}>
              {isConnected ? 'Connected' : 'Reconnecting'}
            </Badge>
            <Badge tone="primary">{isHost ? 'Host' : 'Viewer'}</Badge>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="md:hidden"
          leadingIcon={<LayoutPanelIcon size={15} />}
        >
          Panel
        </Button>

        <Button variant="danger" size="sm" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </header>
  );
}
