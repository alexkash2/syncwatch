import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import {
  CheckIcon,
  RefreshIcon,
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
  onVideoPointerDown: () => void;
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
  onVideoPointerDown,
  onVideoClickToggle,
  onPlay,
  onPause,
  onSeek,
  onFileVerified,
  onVerifyRequest,
  verifyResult,
}: VideoAreaProps) {
  const { preferences } = usePreferences();
  const connectionMeta = getConnectionMeta(connectionState);
  const everyoneReady = totalParticipants > 0 && readyParticipants === totalParticipants;
  const showCompactOnboarding =
    preferences.showRoomOnboarding && (!everyoneReady || !videoReady || roomStatus === 'waiting_ready');
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsHideTimerRef = useRef<number | null>(null);

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current !== null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const shouldKeepControlsVisible =
    !fileUrl || autoplayBlocked || Boolean(videoError) || hostDisconnected;

  const scheduleControlsHide = useCallback(() => {
    if (shouldKeepControlsVisible) {
      setControlsVisible(true);
      return;
    }

    clearControlsHideTimer();
    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsHideTimerRef.current = null;
    }, 1800);
  }, [clearControlsHideTimer, shouldKeepControlsVisible]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    clearControlsHideTimer();

    if (!fileUrl) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      setControlsVisible(true);
      scheduleControlsHide();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      clearControlsHideTimer();
    };
  }, [clearControlsHideTimer, fileUrl, scheduleControlsHide]);

  return (
    <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-black">
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

            <div
              className="relative min-h-0 flex-1"
              onPointerMove={revealControls}
              onPointerDown={revealControls}
            >
              <VideoPlayer
                ref={videoRef}
                src={fileUrl}
                isInteractive={isHost}
                onCanPlay={onVideoCanPlay}
                onError={onVideoError}
                onPointerDown={onVideoPointerDown}
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
                <div className="pointer-events-none absolute inset-x-4 bottom-28 z-20 md:inset-x-6 md:bottom-32">
                  <div className="inline-flex items-center gap-3 rounded-full border border-outline-variant/15 bg-black/55 px-4 py-2 text-xs text-on-surface-variant backdrop-blur-xl">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
                    Preparing the local video player...
                  </div>
                </div>
              )}

              {interactionHint && (
                <div className="pointer-events-none absolute inset-x-4 bottom-28 z-30 flex justify-center md:inset-x-6 md:bottom-32">
                  <div className="rounded-full border border-primary-container/20 bg-black/66 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-primary backdrop-blur-xl">
                    {interactionHint}
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
                <PlaybackControls
                  videoRef={videoRef}
                  isHost={isHost}
                  onPlay={onPlay}
                  onPause={onPause}
                  onSeek={onSeek}
                  videoReady={videoReady}
                  visible={controlsVisible}
                  onNonHostControlAttempt={onNonHostControlAttempt}
                />
              </div>
            </div>
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
