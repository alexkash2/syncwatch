import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  ChatBubbleIcon,
  CheckIcon,
  CopyIcon,
  LayoutPanelIcon,
  SettingsSlidersIcon,
  UsersIcon,
  VideoIcon,
} from '../ui/icons';
import { usePreferences } from '../../hooks/usePreferences';
import { useUi } from '../../hooks/useUi';

type ConnectionState = 'connected' | 'connecting' | 'reconnecting';

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  connectionState: ConnectionState;
  isHost: boolean;
  readyParticipants: number;
  totalParticipants: number;
  messagesCount: number;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  launcherVisible: boolean;
  onLeave: () => void;
}

export function RoomHeader({
  roomName,
  roomCode,
  connectionState,
  isHost,
  readyParticipants,
  totalParticipants,
  messagesCount,
  drawerOpen,
  setDrawerOpen,
  launcherVisible,
  onLeave,
}: RoomHeaderProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const drawerRef = useRef<HTMLElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { pushToast } = useUi();
  const { openPreferences } = usePreferences();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (drawerRef.current?.contains(target)) {
        return;
      }

      setDrawerOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [drawerOpen, setDrawerOpen]);

  const connectionMeta = getConnectionMeta(connectionState);
  const readinessPercent =
    totalParticipants > 0 ? Math.round((readyParticipants / totalParticipants) * 100) : 0;
  const everyoneReady = totalParticipants > 0 && readyParticipants === totalParticipants;

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
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <aside
        ref={drawerRef}
        id="room-deck-drawer"
        aria-label="Room deck"
        className={`pointer-events-auto fixed left-0 top-0 bottom-0 z-50 flex w-[min(100vw,26rem)] flex-col overflow-hidden rounded-r-[2rem] rounded-l-none border border-outline-variant/16 bg-black/38 shadow-[0_30px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl transition-all duration-300 ${
          drawerOpen
            ? 'translate-x-0 opacity-100'
            : '-translate-x-[108%] opacity-0 pointer-events-none'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.14),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]" />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pt-4 md:px-5 md:pt-5">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="flex w-full items-center gap-3 rounded-[1.35rem] border border-outline-variant/15 bg-black/24 px-4 py-3 text-left shadow-[0_18px_48px_rgba(0,0,0,0.2)] transition hover:border-primary-container/35 hover:bg-black/30"
              aria-label={`Collapse room deck for ${roomName}`}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-outline-variant/12 bg-black/18 text-primary">
                <LayoutPanelIcon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  Live room deck
                </span>
                <span className="mt-1 block truncate text-base font-black tracking-tight text-on-surface md:text-lg">
                  {roomName}
                </span>
              </span>
            </button>
          </div>

          <div className="relative z-10 mt-4 min-h-0 flex-1 overflow-y-auto border-t border-outline-variant/10 px-4 py-4 md:px-5 md:py-5">
            <OverviewCard
              roomName={roomName}
              roomCode={roomCode}
              connectionMeta={connectionMeta}
              everyoneReady={everyoneReady}
              readyParticipants={readyParticipants}
              totalParticipants={totalParticipants}
              readinessPercent={readinessPercent}
              isHost={isHost}
              copyState={copyState}
              onCopyRoomCode={() => void copyRoomCode()}
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <DrawerStat
                label="People"
                value={String(totalParticipants)}
                text="Live participants connected to the session."
                icon={<UsersIcon size={15} />}
              />
              <DrawerStat
                label="Chat Flow"
                value={String(messagesCount)}
                text="Messages currently attached to this room."
                icon={<ChatBubbleIcon size={15} />}
              />
              <DrawerStat
                label="Local Media"
                value={readyParticipants > 0 ? 'Matched' : 'Pending'}
                text="The room keeps file checks local to each device."
                icon={<VideoIcon size={15} />}
                className="col-span-2"
              />
              <DrawerStat
                label="Session lane"
                value={isHost ? 'Host lane' : 'Viewer lane'}
                text={
                  isHost
                    ? 'You steer the shared playback timeline for the room.'
                    : 'Chat and readiness stay tied to the live room context.'
                }
                icon={<LayoutPanelIcon size={15} />}
                className="col-span-2"
              />
            </div>

            <span className="sr-only" aria-live="polite">
              {copyState === 'copied'
                ? 'Room code copied.'
                : copyState === 'failed'
                ? 'Room code could not be copied.'
                : ''}
            </span>

            <div className="mt-4 grid gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDrawerOpen(false);
                  openPreferences();
                }}
                leadingIcon={<SettingsSlidersIcon size={15} />}
                aria-label="Open room preferences"
                className="w-full"
              >
                Settings
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setDrawerOpen(false);
                  onLeave();
                }}
                aria-label="Leave room"
                className="w-full"
              >
                Leave room
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {!drawerOpen && (
        <div
          className={`ui-fade-up flex items-start justify-between gap-3 pl-3 pt-3 transition-all duration-300 md:pl-4 md:pt-4 ${
            launcherVisible
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-[calc(100%+1rem)] opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-primary-container/18 bg-primary-container/10 text-primary shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:border-primary-container/35 hover:bg-primary-container/16 hover:text-white"
            aria-controls="room-deck-drawer"
            aria-expanded={drawerOpen}
            aria-label="Open room deck"
          >
            <LayoutPanelIcon size={18} />
          </button>
        </div>
      )}
    </header>
  );
}

function OverviewCard({
  roomName,
  roomCode,
  connectionMeta,
  everyoneReady,
  readyParticipants,
  totalParticipants,
  readinessPercent,
  isHost,
  copyState,
  onCopyRoomCode,
}: {
  roomName: string;
  roomCode: string;
  connectionMeta: ReturnType<typeof getConnectionMeta>;
  everyoneReady: boolean;
  readyParticipants: number;
  totalParticipants: number;
  readinessPercent: number;
  isHost: boolean;
  copyState: 'idle' | 'copied' | 'failed';
  onCopyRoomCode: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[1.65rem] border border-outline-variant/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
      <div className="mb-2 flex items-center gap-3">
        <span className={`ui-dot-pulse h-2.5 w-2.5 rounded-full ${connectionMeta.dotClass}`} />
        <span className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
          {connectionMeta.eyebrow}
        </span>
      </div>

      <h3 className="truncate text-lg font-black tracking-tight text-on-surface">{roomName}</h3>
      <button
        type="button"
        onClick={onCopyRoomCode}
        className="mt-1 inline-flex max-w-full items-center gap-2 rounded-full text-left text-[11px] uppercase tracking-[0.18em] text-primary transition hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/40"
        aria-label={`Copy room code ${roomCode}`}
        title="Copy room code"
      >
        <span className="truncate">{roomCode}</span>
        {copyState === 'copied' ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      </button>
      <p className="mt-3 text-sm leading-6 text-on-surface-variant">
        {connectionMeta.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={connectionMeta.tone}>{connectionMeta.label}</Badge>
        <Badge tone="primary">{everyoneReady ? 'Room Ready' : 'Sync In Progress'}</Badge>
        <Badge tone="primary">{isHost ? 'Host' : 'Viewer'}</Badge>
        {copyState === 'copied' && <Badge tone="success">Code Copied</Badge>}
        {copyState === 'failed' && <Badge tone="warning">Copy Failed</Badge>}
      </div>

      <div className="mt-4 rounded-[1.35rem] border border-outline-variant/14 bg-black/24 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Group alignment
            </p>
            <p className="mt-2 text-sm font-semibold text-on-surface">
              {everyoneReady
                ? 'Everyone is matched'
                : `${readyParticipants}/${totalParticipants || 0} participants ready`}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
            <UsersIcon size={16} />
          </span>
        </div>

        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            <span>{everyoneReady ? 'Aligned' : 'Preparing room'}</span>
            <span className="font-mono text-primary">{readinessPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/34">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                everyoneReady ? 'bg-emerald-300' : 'bg-primary'
              }`}
              style={{
                width: `${
                  totalParticipants > 0
                    ? Math.max(readinessPercent, readyParticipants > 0 ? 12 : 5)
                    : 5
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerStat({
  label,
  value,
  text,
  icon,
  className,
}: {
  label: string;
  value: string;
  text: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[1.3rem] border border-outline-variant/12 bg-surface-container-lowest/80 px-4 py-3 ${className ?? ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
          {label}
        </p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-lg font-black tracking-tight text-on-surface">{value}</p>
      <p className="mt-2 text-xs leading-6 text-on-surface-variant">{text}</p>
    </div>
  );
}

function getConnectionMeta(connectionState: ConnectionState) {
  switch (connectionState) {
    case 'connected':
      return {
        eyebrow: 'Sync active',
        label: 'Connected',
        tone: 'success' as const,
        description: 'Realtime playback, participant presence and chat are connected right now.',
        helper: 'Realtime sync is healthy and the room channel is current.',
        dotClass: 'bg-emerald-300',
      };
    case 'reconnecting':
      return {
        eyebrow: 'Reconnecting',
        label: 'Reconnecting',
        tone: 'warning' as const,
        description: 'The room link is recovering without dropping your local file or playback state.',
        helper:
          'The room link is recovering without dropping your local file or playback state.',
        dotClass: 'bg-amber-200',
      };
    default:
      return {
        eyebrow: 'Connecting',
        label: 'Connecting',
        tone: 'neutral' as const,
        description: 'Opening the live room channel and preparing the shared session.',
        helper: 'Opening the live room channel and preparing the shared session.',
        dotClass: 'bg-on-surface-variant/60',
      };
  }
}
