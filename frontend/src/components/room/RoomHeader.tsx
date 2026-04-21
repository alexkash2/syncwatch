import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  BrandMarkIcon,
  CheckIcon,
  CopyIcon,
  LayoutPanelIcon,
  SettingsSlidersIcon,
  UsersIcon,
  VideoIcon,
} from '../ui/icons';
import { usePreferences } from '../../hooks/usePreferences';
import { useUi } from '../../hooks/useUi';
import type { RoomStatus } from '../../types/ws';

type ConnectionState = 'connected' | 'connecting' | 'reconnecting';

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  connectionState: ConnectionState;
  isHost: boolean;
  roomStatus: RoomStatus;
  readyParticipants: number;
  totalParticipants: number;
  sidebarOpen: boolean;
  onLeave: () => void;
  onToggleSidebar: () => void;
}

export function RoomHeader({
  roomName,
  roomCode,
  connectionState,
  isHost,
  roomStatus,
  readyParticipants,
  totalParticipants,
  sidebarOpen,
  onLeave,
  onToggleSidebar,
}: RoomHeaderProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimerRef = useRef<number | null>(null);
  const { pushToast } = useUi();
  const { openPreferences } = usePreferences();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const connectionMeta = getConnectionMeta(connectionState);
  const statusMeta = getRoomStatusMeta(roomStatus, isHost);
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
    <header className="relative z-30 px-3 pt-3 md:px-4 md:pt-4">
      <div className="ui-fade-up overflow-hidden rounded-[2rem] border border-outline-variant/16 bg-black/34 px-4 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:px-5 md:py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.14),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]" />

        <div className="relative z-10 grid gap-4 xl:grid-cols-[auto,minmax(0,1fr),auto] xl:items-center">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] border border-outline-variant/16 bg-black/28 text-primary shadow-[0_14px_32px_rgba(0,0,0,0.24)] transition hover:border-primary-container/35 hover:text-white"
              aria-label="Back to dashboard"
            >
              <BrandMarkIcon size={18} />
            </Link>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Live room deck
              </p>
              <p className="truncate text-base font-black tracking-tight text-on-surface md:text-lg">
                {roomName}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={connectionMeta.tone}>
                <span className={`ui-dot-pulse h-2 w-2 rounded-full ${connectionMeta.dotClass}`} />
                {connectionMeta.label}
              </Badge>
              <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
              <Badge tone="primary">{isHost ? 'Host' : 'Viewer'}</Badge>
              {copyState === 'copied' && <Badge tone="success">Code Copied</Badge>}
              {copyState === 'failed' && <Badge tone="warning">Copy Failed</Badge>}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(15rem,0.9fr)]">
              <div className="rounded-[1.45rem] border border-outline-variant/14 bg-black/24 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      Session state
                    </p>
                    <p className="mt-2 text-sm font-semibold text-on-surface">{statusMeta.title}</p>
                    <p className="mt-2 text-xs leading-6 text-on-surface-variant">
                      {statusMeta.description}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
                    <VideoIcon size={16} />
                  </span>
                </div>
              </div>

              <div className="rounded-[1.45rem] border border-outline-variant/14 bg-black/24 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      Room readiness
                    </p>
                    <p className="mt-2 text-sm font-semibold text-on-surface">
                      {everyoneReady ? 'Everyone matched' : `${readyParticipants}/${totalParticipants || 0} ready`}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
                    <UsersIcon size={16} />
                  </span>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    <span>{everyoneReady ? 'Room aligned' : 'Sync progress'}</span>
                    <span className="font-mono text-primary">{readinessPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/34">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${everyoneReady ? 'bg-emerald-300' : 'bg-primary'}`}
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

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant">
              <button
                type="button"
                onClick={copyRoomCode}
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-black/24 px-3 py-1.5 font-semibold uppercase tracking-[0.18em] transition hover:border-primary-container/40 hover:text-primary"
                aria-label={`Copy room code ${roomCode}`}
                title="Copy room code"
              >
                <span className="font-mono text-[10px] tracking-[0.24em]">{roomCode}</span>
                {copyState === 'copied' ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              </button>
              <p className="min-w-0 text-[11px] leading-5 text-on-surface-variant/78">
                {copyState === 'copied'
                  ? 'The room code is ready to paste anywhere.'
                  : copyState === 'failed'
                  ? 'Clipboard access is blocked in this browser right now.'
                  : connectionMeta.helper}
              </p>
            </div>

            <span className="sr-only" aria-live="polite">
              {copyState === 'copied'
                ? 'Room code copied.'
                : copyState === 'failed'
                ? 'Room code could not be copied.'
                : ''}
            </span>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 xl:flex-col xl:items-stretch xl:justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={openPreferences}
              leadingIcon={<SettingsSlidersIcon size={15} />}
              aria-label="Open room preferences"
              className="w-full xl:min-w-[10rem]"
            >
              Settings
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSidebar}
              className="w-full md:hidden"
              leadingIcon={<LayoutPanelIcon size={15} />}
              aria-label={sidebarOpen ? 'Close room sidebar' : 'Open room sidebar'}
              aria-controls="room-sidebar-panel"
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? 'Hide panel' : 'Open panel'}
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={onLeave}
              aria-label="Leave room"
              className="w-full xl:min-w-[10rem]"
            >
              Leave room
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function getConnectionMeta(connectionState: ConnectionState) {
  switch (connectionState) {
    case 'connected':
      return {
        label: 'Connected',
        tone: 'success' as const,
        helper: 'Realtime sync is healthy and the room channel is current.',
        dotClass: 'bg-emerald-300',
      };
    case 'reconnecting':
      return {
        label: 'Reconnecting',
        tone: 'warning' as const,
        helper: 'The room link is recovering without dropping your local file or playback state.',
        dotClass: 'bg-amber-200',
      };
    default:
      return {
        label: 'Connecting',
        tone: 'neutral' as const,
        helper: 'Opening the live room channel and preparing the shared session.',
        dotClass: 'bg-on-surface-variant/60',
      };
  }
}

function getRoomStatusMeta(roomStatus: RoomStatus, isHost: boolean) {
  switch (roomStatus) {
    case 'waiting_file':
      return {
        label: 'Waiting for file',
        tone: 'warning' as const,
        title: 'Choose the room reference file',
        description: isHost
          ? 'Your file choice becomes the reference everyone else will verify against.'
          : 'The host still needs to choose the first local file for the room.',
      };
    case 'waiting_ready':
      return {
        label: 'Waiting for readiness',
        tone: 'primary' as const,
        title: 'Hold while the group aligns',
        description: isHost
          ? 'Participants are matching the same file before you open the shared timeline.'
          : 'Your player can stay here while the rest of the room finishes matching the file.',
      };
    case 'playing':
      return {
        label: 'Playing',
        tone: 'success' as const,
        title: isHost ? 'You are driving the shared timeline' : 'Playback is locked to the host',
        description: isHost
          ? 'Play, pause and seeks from this device control the entire room.'
          : 'The room follows the host timeline while your local fullscreen and volume stay personal.',
      };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'neutral' as const,
        title: isHost ? 'The room is paused and waiting' : 'The host paused the shared session',
        description: isHost
          ? 'You can resume playback whenever the room is ready to move again.'
          : 'Your player is holding the synced frame until the host continues.',
      };
    case 'closing':
      return {
        label: 'Host reconnecting',
        tone: 'warning' as const,
        title: 'The session is holding its place',
        description: 'SyncWatch is preserving the room state while the host connection recovers.',
      };
  }
}
