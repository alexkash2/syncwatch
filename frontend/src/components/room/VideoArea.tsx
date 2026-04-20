import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import {
  BrandMarkIcon,
  CheckIcon,
  RefreshIcon,
  UsersIcon,
  VideoIcon,
  WarningCircleIcon,
} from '../ui/icons';
import { usePreferences } from '../../hooks/usePreferences';
import { FileSelector } from './FileSelector';
import { HostDisconnectOverlay } from './HostDisconnectOverlay';
import { PlaybackControls } from './PlaybackControls';
import { RoomOnboarding } from './RoomOnboarding';
import { VideoPlayer } from './VideoPlayer';
import type { FileVerifyResult, RoomStatus } from '../../types/ws';

interface VideoAreaProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  roomStatus: RoomStatus;
  fileUrl: string | null;
  isHost: boolean;
  connectionState: 'connected' | 'connecting' | 'reconnecting';
  hostDisconnected: boolean;
  graceCountdown: number;
  referenceFileName: string | null;
  videoError: string | null;
  videoReady: boolean;
  readyParticipants: number;
  totalParticipants: number;
  autoplayBlocked: boolean;
  interactionHint: string | null;
  sessionNotice: {
    tone: 'warning' | 'success';
    title: string;
    description: string;
  } | null;
  onResumePlayback: () => void;
  onNonHostControlAttempt: () => void;
  onVideoCanPlay: () => void;
  onVideoError: (errorCode: string) => void;
  onVideoClickToggle: () => void;
  onPlay: (timeMs: number) => void;
  onPause: (timeMs: number) => void;
  onSeek: (timeMs: number) => void;
  onFileVerified: (url: string) => void;
  onVerifyRequest: (hash: string, size: number, durationMs: number, fileName: string) => void;
  verifyResult: FileVerifyResult | null;
}

export function VideoArea({
  videoRef,
  roomStatus,
  fileUrl,
  isHost,
  connectionState,
  hostDisconnected,
  graceCountdown,
  referenceFileName,
  videoError,
  videoReady,
  readyParticipants,
  totalParticipants,
  autoplayBlocked,
  interactionHint,
  sessionNotice,
  onResumePlayback,
  onNonHostControlAttempt,
  onVideoCanPlay,
  onVideoError,
  onVideoClickToggle,
  onPlay,
  onPause,
  onSeek,
  onFileVerified,
  onVerifyRequest,
  verifyResult,
}: VideoAreaProps) {
  const { preferences } = usePreferences();
  const statusMeta = getRoomStatusMeta(roomStatus, isHost);
  const connectionMeta = getConnectionMeta(connectionState);
  const everyoneReady = totalParticipants > 0 && readyParticipants === totalParticipants;
  const readinessPercent =
    totalParticipants > 0 ? Math.round((readyParticipants / totalParticipants) * 100) : 0;
  const showCompactOnboarding =
    preferences.showRoomOnboarding && (!everyoneReady || !videoReady || roomStatus === 'waiting_ready');
  const readinessMeta = getReadinessMeta({
    everyoneReady,
    isHost,
    readyParticipants,
    totalParticipants,
  });
  const roleMeta = getRoleMeta(isHost);

  return (
    <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-black/60 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,98,255,0.18),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_40%,rgba(255,255,255,0.04)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:28px_28px] opacity-20" />
      </div>

      <div className="relative z-20 border-b border-outline-variant/10 px-4 py-4 md:px-6 md:py-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(18rem,0.92fr)]">
          <div className="overflow-hidden rounded-[1.8rem] border border-outline-variant/16 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)] md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip label={isHost ? 'Host Control' : 'Viewer'} tone="neutral" />
              <StatusChip label={statusMeta.label} tone={statusMeta.tone} />
              <StatusChip label={connectionMeta.label} tone={connectionMeta.tone} />
            </div>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  {isHost ? 'Host session deck' : 'Viewer sync deck'}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface md:text-[2rem]">
                  {statusMeta.label}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                  {statusMeta.description}
                </p>
              </div>

              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] border shadow-[0_18px_38px_rgba(0,0,0,0.24)] ${getToneChrome(statusMeta.tone)}`}
              >
                <BrandMarkIcon size={24} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-[1.25rem] border border-outline-variant/14 bg-black/24 px-4 py-3 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
                    <VideoIcon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      Reference file
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-on-surface">
                      {referenceFileName ?? 'Waiting for the host file reference'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-outline-variant/14 bg-black/24 px-4 py-3 backdrop-blur-xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  Timeline lane
                </p>
                <p className="mt-2 text-sm font-semibold text-on-surface">
                  {roleMeta.value}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <SessionMetricCard
              eyebrow="Room readiness"
              value={readinessMeta.value}
              description={readinessMeta.description}
              tone={readinessMeta.tone}
              icon={<UsersIcon size={18} />}
            >
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                  <span>{readinessPercent}% aligned</span>
                  <span className="font-mono text-primary">
                    {readyParticipants}/{totalParticipants || 0}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/32">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${everyoneReady ? 'bg-emerald-300' : 'bg-primary'}`}
                    style={{
                      width: `${
                        totalParticipants > 0
                          ? Math.max(readinessPercent, readyParticipants > 0 ? 10 : 4)
                          : 4
                      }%`,
                    }}
                  />
                </div>
              </div>
            </SessionMetricCard>

            <SessionMetricCard
              eyebrow="Realtime link"
              value={connectionMeta.label}
              description={connectionMeta.helper}
              tone={connectionMeta.tone}
              icon={
                connectionState === 'reconnecting' ? (
                  <RefreshIcon size={18} className="animate-spin [animation-duration:2.6s]" />
                ) : (
                  <BrandMarkIcon size={18} />
                )
              }
            />

            <SessionMetricCard
              eyebrow="Playback authority"
              value={roleMeta.value}
              description={roleMeta.description}
              tone={roleMeta.tone}
              icon={<BrandMarkIcon size={18} />}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {sessionNotice && (
          <div className="relative z-20 px-4 pt-4 md:px-6">
            <SessionBanner
              tone={sessionNotice.tone}
              title={sessionNotice.title}
              description={sessionNotice.description}
            />
          </div>
        )}

        {fileUrl ? (
          <>
            {showCompactOnboarding && (
              <div className="relative z-20 px-4 pt-4 md:px-6">
                <RoomOnboarding
                  compact
                  isHost={isHost}
                  roomStatus={roomStatus}
                  referenceFileName={referenceFileName}
                  hasLocalFile={Boolean(fileUrl)}
                  videoReady={videoReady}
                  readyParticipants={readyParticipants}
                  totalParticipants={totalParticipants}
                />
              </div>
            )}

            <div className="relative min-h-0 flex-1">
              <VideoPlayer
                ref={videoRef}
                src={fileUrl}
                isInteractive={isHost}
                onCanPlay={onVideoCanPlay}
                onError={onVideoError}
                onClickToggle={onVideoClickToggle}
              />

              {autoplayBlocked && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 px-4">
                  <div className="max-w-md rounded-[1.75rem] border border-primary-container/25 bg-surface-container-low/85 p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                      Action Needed
                    </p>
                    <h3 className="mt-3 text-2xl font-black tracking-tight text-on-surface">
                      Playback is waiting for your click
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                      Your browser blocked autoplay. Resume locally once and the room will continue from the synced timeline.
                    </p>
                    <div className="mt-5">
                      <Button variant="primary" size="md" onClick={onResumePlayback}>
                        Resume Playback
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex flex-col gap-3 md:inset-x-6">
                <div className="flex flex-wrap gap-3">
                  <FloatingPanel
                    title={everyoneReady ? 'Synced timeline ready' : 'Readiness window'}
                    description={
                      everyoneReady
                        ? isHost
                          ? 'Everyone matched the same file. Press play whenever you want to open the first frame together.'
                          : 'The group is aligned. The next host action will move every matched player together.'
                        : isHost
                        ? 'Keep the room here while others finish loading the matching file.'
                        : 'Stay on this screen after matching the file and the room will catch up automatically.'
                    }
                  />

                  <FloatingPanel
                    title={isHost ? 'Host lane' : 'Viewer lane'}
                    description={
                      isHost
                        ? 'Clicks on the video stage and the transport controls update the shared room timeline.'
                        : 'Volume and fullscreen remain local to you, but playback timing follows the host.'
                    }
                  />
                </div>

                {connectionState !== 'connected' && (
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-outline-variant/20 bg-black/55 px-4 py-2 text-xs text-on-surface-variant backdrop-blur-xl">
                    <span className={`h-2 w-2 rounded-full ${connectionMeta.dotClass}`} />
                    {connectionMeta.helper}
                  </div>
                )}
              </div>

              {videoError && (
                <PlayerAlert
                  title={videoError === 'codec_unsupported' ? 'This browser cannot play the file' : 'Playback error'}
                  description={
                    videoError === 'codec_unsupported'
                      ? 'Try another browser or a more widely supported video format.'
                      : 'Reload the local file or choose it again to recover the player.'
                  }
                />
              )}

              {!videoReady && !videoError && !hostDisconnected && (
                <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 md:inset-x-6">
                  <div className="inline-flex items-center gap-3 rounded-full border border-outline-variant/15 bg-black/55 px-4 py-2 text-xs text-on-surface-variant backdrop-blur-xl">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
                    Preparing the local video player...
                  </div>
                </div>
              )}

              {interactionHint && (
                <div className="pointer-events-none absolute inset-x-4 bottom-18 z-30 flex justify-center md:inset-x-6 md:bottom-22">
                  <div className="rounded-full border border-primary-container/20 bg-black/66 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-primary backdrop-blur-xl">
                    {interactionHint}
                  </div>
                </div>
              )}
            </div>

            <PlaybackControls
              videoRef={videoRef}
              isHost={isHost}
              onPlay={onPlay}
              onPause={onPause}
              onSeek={onSeek}
              videoReady
              onNonHostControlAttempt={onNonHostControlAttempt}
            />
          </>
        ) : (
          <FileSelector
            isHost={isHost}
            roomStatus={roomStatus}
            referenceFileName={referenceFileName}
            readyParticipants={readyParticipants}
            totalParticipants={totalParticipants}
            onFileVerified={onFileVerified}
            onVerifyRequest={onVerifyRequest}
            verifyResult={verifyResult}
          />
        )}
      </div>

      {hostDisconnected && <HostDisconnectOverlay graceCountdown={graceCountdown} />}
    </section>
  );
}

function FloatingPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-sm rounded-2xl border border-outline-variant/15 bg-black/45 px-4 py-3 backdrop-blur-xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
    </div>
  );
}

function PlayerAlert({ title, description }: { title: string; description: string }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-4">
      <div className="max-w-md rounded-[1.75rem] border border-error/30 bg-surface-container-low/85 p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-error">Player State</p>
        <h3 className="mt-3 text-2xl font-black tracking-tight text-on-surface">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-on-surface-variant">{description}</p>
      </div>
    </div>
  );
}

function SessionBanner({
  tone,
  title,
  description,
}: {
  tone: 'warning' | 'success';
  title: string;
  description: string;
}) {
  const meta =
    tone === 'success'
      ? {
          wrapperClass:
            'border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(0,0,0,0.45))] text-emerald-50',
          iconClass: 'border-emerald-300/20 bg-emerald-400/14 text-emerald-200',
          eyebrow: 'Recovered',
          icon: <CheckIcon size={18} />,
        }
      : {
          wrapperClass:
            'border-amber-300/24 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(0,0,0,0.48))] text-amber-50',
          iconClass: 'border-amber-200/22 bg-amber-300/12 text-amber-100',
          eyebrow: 'Session Link',
          icon: <RefreshIcon size={18} className="animate-spin [animation-duration:2.6s]" />,
        };

  return (
    <div
      className={`rounded-[1.6rem] border px-4 py-4 shadow-[0_22px_52px_rgba(0,0,0,0.3)] backdrop-blur-xl md:px-5 ${meta.wrapperClass}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border ${meta.iconClass}`}
          >
            {meta.icon}
          </span>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-current/80">
              {meta.eyebrow}
            </p>
            <h3 className="mt-2 text-lg font-black tracking-tight text-on-surface">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-current/80">
          <WarningCircleIcon size={14} />
          <span>{tone === 'success' ? 'Room synced' : 'Holding playback state'}</span>
        </div>
      </div>
    </div>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'accent';
}) {
  const classes = {
    neutral: 'border-outline-variant/15 bg-black/35 text-on-surface-variant',
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    warning: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
    accent: 'border-primary-container/30 bg-primary-container/12 text-primary',
  } satisfies Record<string, string>;

  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${classes[tone]}`}>
      {label}
    </span>
  );
}

function SessionMetricCard({
  eyebrow,
  value,
  description,
  icon,
  tone,
  children,
}: {
  eyebrow: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone: 'neutral' | 'success' | 'warning' | 'accent';
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-[1.5rem] border px-4 py-4 shadow-[0_18px_36px_rgba(0,0,0,0.22)] backdrop-blur-xl ${getTonePanel(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            {eyebrow}
          </p>
          <p className="mt-2 text-lg font-black tracking-tight text-on-surface">{value}</p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${getToneChrome(tone)}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xs leading-6 text-on-surface-variant">{description}</p>
      {children}
    </div>
  );
}

function getRoomStatusMeta(roomStatus: RoomStatus, isHost: boolean) {
  switch (roomStatus) {
    case 'waiting_file':
      return {
        label: 'Waiting for file',
        tone: 'warning' as const,
        description: isHost
          ? 'Choose the first reference file to anchor the room.'
          : 'The host still needs to choose a reference file for everyone.',
      };
    case 'waiting_ready':
      return {
        label: 'Waiting for readiness',
        tone: 'accent' as const,
        description: isHost
          ? 'Participants are matching the reference file before playback starts.'
          : 'Match the host file locally and the room will sync once everyone is ready.',
      };
    case 'playing':
      return {
        label: 'Live playback',
        tone: 'success' as const,
        description: isHost
          ? 'You are actively driving the room timeline.'
          : 'Playback is currently following the host timeline.',
      };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'neutral' as const,
        description: isHost
          ? 'You can resume whenever the room is ready.'
          : 'The host paused the session. Your local player will hold the synced frame.',
      };
    case 'closing':
      return {
        label: 'Host reconnecting',
        tone: 'warning' as const,
        description: 'The room is holding state while the host connection recovers.',
      };
  }
}

function getConnectionMeta(connectionState: 'connected' | 'connecting' | 'reconnecting') {
  switch (connectionState) {
    case 'connected':
      return {
        label: 'Connected',
        tone: 'success' as const,
        helper: 'Realtime room link is healthy.',
        dotClass: 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.65)]',
      };
    case 'reconnecting':
      return {
        label: 'Reconnecting',
        tone: 'warning' as const,
        helper: 'Reconnecting to the room without resetting local playback.',
        dotClass: 'bg-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.55)]',
      };
    default:
      return {
        label: 'Connecting',
        tone: 'neutral' as const,
        helper: 'Opening the live room channel...',
        dotClass: 'bg-on-surface-variant/60',
      };
  }
}

function getReadinessMeta({
  everyoneReady,
  isHost,
  readyParticipants,
  totalParticipants,
}: {
  everyoneReady: boolean;
  isHost: boolean;
  readyParticipants: number;
  totalParticipants: number;
}) {
  if (everyoneReady) {
    return {
      value: 'Everyone ready',
      description: isHost
        ? 'The room is aligned and ready for the shared timeline to begin.'
        : 'The file check is complete and the room can move together on the next host action.',
      tone: 'success' as const,
    };
  }

  if (totalParticipants <= 1) {
    return {
      value: 'Waiting for the group',
      description: isHost
        ? 'You are ready to anchor the session. More people can join before playback starts.'
        : 'The room is still waiting for more participants to arrive and match the file.',
      tone: 'neutral' as const,
    };
  }

  const remaining = Math.max(totalParticipants - readyParticipants, 0);
  const noun = remaining === 1 ? 'participant' : 'participants';

  return {
    value: `${readyParticipants}/${totalParticipants} matched`,
    description: isHost
      ? `${remaining} more ${noun} need to finish loading the same file.`
      : 'Your player is loaded. The room will start once everyone else matches the reference file.',
    tone: 'accent' as const,
  };
}

function getRoleMeta(isHost: boolean) {
  return isHost
    ? {
        value: 'You steer playback',
        description: 'Play, pause and seek changes from here broadcast to everyone in the room.',
        tone: 'accent' as const,
      }
    : {
        value: 'Viewer sync locked',
        description: 'Local fullscreen and volume stay personal, while timing remains tied to the host.',
        tone: 'neutral' as const,
      };
}

function getTonePanel(tone: 'neutral' | 'success' | 'warning' | 'accent') {
  switch (tone) {
    case 'success':
      return 'border-emerald-400/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(0,0,0,0.24))]';
    case 'warning':
      return 'border-amber-300/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(0,0,0,0.24))]';
    case 'accent':
      return 'border-primary-container/20 bg-[linear-gradient(135deg,rgba(0,98,255,0.12),rgba(0,0,0,0.24))]';
    default:
      return 'border-outline-variant/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(0,0,0,0.2))]';
  }
}

function getToneChrome(tone: 'neutral' | 'success' | 'warning' | 'accent') {
  switch (tone) {
    case 'success':
      return 'border-emerald-400/18 bg-emerald-400/12 text-emerald-100';
    case 'warning':
      return 'border-amber-300/18 bg-amber-300/10 text-amber-100';
    case 'accent':
      return 'border-primary-container/20 bg-primary-container/12 text-primary';
    default:
      return 'border-outline-variant/16 bg-black/22 text-on-surface-variant';
  }
}
