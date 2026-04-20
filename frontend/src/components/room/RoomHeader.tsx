import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { BrandMarkIcon, CheckIcon, CopyIcon, LayoutPanelIcon } from '../ui/icons';
import { useUi } from '../../hooks/useUi';

type ConnectionState = 'connected' | 'connecting' | 'reconnecting';

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  connectionState: ConnectionState;
  isHost: boolean;
  sidebarOpen: boolean;
  onLeave: () => void;
  onToggleSidebar: () => void;
}

export function RoomHeader({
  roomName,
  roomCode,
  connectionState,
  isHost,
  sidebarOpen,
  onLeave,
  onToggleSidebar,
}: RoomHeaderProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimerRef = useRef<number | null>(null);
  const { pushToast } = useUi();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const connectionMeta = getConnectionMeta(connectionState);

  const copyRoomCode = async () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }

    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyState('copied');
      pushToast({
        tone: 'success',
        title: 'Room code copied',
        description: `${roomCode} is ready to send to anyone joining.`,
        durationMs: 2400,
      });
    } catch {
      setCopyState('failed');
      pushToast({
        tone: 'warning',
        title: 'Copy unavailable',
        description: 'Clipboard access is blocked in this browser right now.',
      });
    }

    copyTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
    }, 1800);
  };

  return (
    <header className="relative z-30 flex min-h-[4.5rem] shrink-0 items-center justify-between px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3 md:gap-5">
        <Link
          to="/"
          className="inline-flex items-center gap-3 rounded-full border border-outline-variant/15 bg-black/30 px-3.5 py-2 text-sm font-black tracking-[0.22em] text-primary shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:border-primary-container/35 hover:text-white md:px-4"
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
              type="button"
              onClick={copyRoomCode}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-black/25 px-3 py-1 transition hover:border-primary-container/40 hover:text-primary"
              aria-label={`Copy room code ${roomCode}`}
              title="Copy room code"
            >
              <span className="font-mono text-[10px] tracking-[0.24em]">{roomCode}</span>
              {copyState === 'copied' ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            </button>
            <Badge tone={connectionMeta.tone}>
              {connectionMeta.label}
            </Badge>
            <Badge tone="primary">{isHost ? 'Host' : 'Viewer'}</Badge>
            {copyState === 'copied' && <Badge tone="success">Code Copied</Badge>}
            {copyState === 'failed' && <Badge tone="warning">Copy Failed</Badge>}
          </div>
          <span className="sr-only" aria-live="polite">
            {copyState === 'copied'
              ? 'Room code copied.'
              : copyState === 'failed'
              ? 'Room code could not be copied.'
              : ''}
          </span>
          <p className="mt-2 hidden text-[11px] leading-5 text-on-surface-variant/72 sm:block">
            {copyState === 'copied'
              ? 'The room code is ready to paste anywhere.'
              : copyState === 'failed'
              ? 'Clipboard access is blocked in this browser right now.'
              : 'Tap the room code to copy and share it with everyone joining the session.'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="md:hidden"
          leadingIcon={<LayoutPanelIcon size={15} />}
          aria-label={sidebarOpen ? 'Close room sidebar' : 'Open room sidebar'}
          aria-controls="room-sidebar-panel"
          aria-expanded={sidebarOpen}
        >
          <span className="hidden min-[390px]:inline">Panel</span>
        </Button>

        <Button variant="danger" size="sm" onClick={onLeave} aria-label="Leave room">
          Leave
        </Button>
      </div>
    </header>
  );
}

function getConnectionMeta(connectionState: ConnectionState) {
  switch (connectionState) {
    case 'connected':
      return { label: 'Connected', tone: 'success' as const };
    case 'reconnecting':
      return { label: 'Reconnecting', tone: 'warning' as const };
    default:
      return { label: 'Connecting', tone: 'neutral' as const };
  }
}
