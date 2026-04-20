import { Button } from '../ui/Button';
import { CheckIcon, RefreshIcon, WarningCircleIcon } from '../ui/icons';
import { FileSelector } from './FileSelector';
import { HostDisconnectOverlay } from './HostDisconnectOverlay';
import { PlaybackControls } from './PlaybackControls';
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
  const statusMeta = getRoomStatusMeta(roomStatus, isHost);
  const connectionMeta = getConnectionMeta(connectionState);
  const everyoneReady = totalParticipants > 0 && readyParticipants === totalParticipants;

  return (
    <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-black/60 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,98,255,0.18),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_40%,rgba(255,255,255,0.04)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:28px_28px] opacity-20" />
      </div>

      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/10 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip label={isHost ? 'Host Control' : 'Viewer'} tone="neutral" />
          <StatusChip label={statusMeta.label} tone={statusMeta.tone} />
          <StatusChip label={connectionMeta.label} tone={connectionMeta.tone} />
          {referenceFileName && <StatusChip label={truncateLabel(referenceFileName)} tone="neutral" />}
        </div>

        <div className="flex items-center gap-3 rounded-full border border-outline-variant/15 bg-black/35 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
          <span>Ready</span>
          <span className="font-mono text-primary">{readyParticipants}/{totalParticipants || 0}</span>
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
                  <FloatingPanel title={statusMeta.label} description={statusMeta.description} />

                  {!everyoneReady && (
                    <FloatingPanel
                      title="Room readiness"
                      description={
                        isHost
                          ? 'Wait for everyone to load the same file before starting playback.'
                          : 'Your player is loaded. The host can start once everyone is ready.'
                      }
                    />
                  )}

                  {everyoneReady && (
                    <FloatingPanel
                      title="Everyone is ready"
                      description={
                        isHost
                          ? 'The room is ready for playback. Start whenever you want.'
                          : 'Everyone matched the file. Playback will stay locked to the shared host timeline.'
                      }
                    />
                  )}
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

function truncateLabel(value: string) {
  return value.length > 28 ? `${value.slice(0, 25)}...` : value;
}
