import { useEffect, useRef, useState } from 'react';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useI18n } from '../../hooks/useI18n';
import { cn } from '../ui/cn';
import { Button } from '../ui/Button';
import { CheckIcon, PlayIcon } from '../ui/icons';
import { FileSelector } from './FileSelector';
import { PlaybackControls } from './PlaybackControls';
import { StageOverlay, WaitingBanner } from './StageOverlays';
import { VideoPlayer } from './VideoPlayer';
import type { FileVerifyResult, RoomStatus } from '../../types/ws';

interface VideoAreaProps {
  roomId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  roomStatus: RoomStatus;
  fileUrl: string | null;
  isHost: boolean;
  canControl: boolean;
  connectionState: 'connected' | 'connecting' | 'reconnecting';
  hostDisconnected: boolean;
  graceCountdown: number;
  referenceFileName: string | null;
  referenceFileVersion: number;
  videoError: string | null;
  videoReady: boolean;
  readyParticipants: number;
  totalParticipants: number;
  autoplayBlocked: boolean;
  interactionHint: string | null;
  mobile?: boolean;
  onResumePlayback: () => void;
  onBlockedControlAttempt: () => void;
  onVideoCanPlay: () => void;
  onVideoError: (errorCode: string) => void;
  onVideoClickToggle: () => void;
  onPlay: (timeMs: number) => boolean;
  onPause: (timeMs: number) => boolean;
  onSeek: (timeMs: number) => boolean;
  onFileVerified: (url: string) => void;
  onVerifyRequest: (hash: string, size: number, durationMs: number, fileName: string) => boolean;
  verifyResult: FileVerifyResult | null;
}

export function VideoArea({
  roomId,
  videoRef,
  roomStatus,
  fileUrl,
  isHost,
  canControl,
  connectionState,
  hostDisconnected,
  graceCountdown,
  referenceFileName,
  referenceFileVersion,
  videoError,
  videoReady,
  readyParticipants,
  totalParticipants,
  autoplayBlocked,
  interactionHint,
  mobile = false,
  onResumePlayback,
  onBlockedControlAttempt,
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
  const { t } = useI18n();
  const stageRef = useRef<HTMLElement>(null);
  const { isPseudo, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen(stageRef);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Leave fullscreen if the player surface disappears (file cleared / changed) —
  // otherwise an iPhone pseudo-fullscreen overlay would strand the user.
  useEffect(() => {
    if (!fileUrl) {
      exitFullscreen();
    }
  }, [fileUrl, exitFullscreen]);

  // Track the local element's play state so the centered play overlay reflects
  // whatever the sync layer last applied (play, pause, drift correction).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const sync = () => setIsPlaying(!video.paused);
    sync();
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    return () => {
      video.removeEventListener('play', sync);
      video.removeEventListener('pause', sync);
    };
  }, [fileUrl, videoReady, videoRef]);

  useEffect(() => {
    if (autoplayBlocked) {
      window.requestAnimationFrame(() => resumeButtonRef.current?.focus());
    }
  }, [autoplayBlocked]);

  const reconnecting = connectionState === 'reconnecting';
  const waiting =
    Boolean(fileUrl) &&
    roomStatus === 'waiting_ready' &&
    !hostDisconnected &&
    !reconnecting &&
    !autoplayBlocked;
  const showPlayGlyph =
    Boolean(fileUrl) &&
    videoReady &&
    !isPlaying &&
    !autoplayBlocked &&
    !videoError &&
    !hostDisconnected &&
    !reconnecting;

  const stageBodyFill = !mobile || isPseudo;

  return (
    <section
      ref={stageRef}
      className={cn(
        'relative flex min-w-0 flex-col bg-stage',
        mobile && !isPseudo ? 'w-full shrink-0' : 'flex-1',
        isPseudo && 'sw-pseudo-fullscreen'
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden',
          stageBodyFill ? 'min-h-0 flex-1' : fileUrl ? 'aspect-[16/9] w-full' : 'min-h-[300px]'
        )}
      >
        {fileUrl ? (
          <>
            <VideoPlayer
              ref={videoRef}
              src={fileUrl}
              isInteractive={canControl}
              onCanPlay={onVideoCanPlay}
              onError={onVideoError}
              onClickToggle={onVideoClickToggle}
              onToggleFullscreen={toggleFullscreen}
            />

            {/* filename chip */}
            <div className="pointer-events-none absolute left-[18px] top-4 z-10 flex items-center gap-2 rounded-[8px] bg-black/35 px-[10px] py-[5px] font-mono text-[12.5px] text-on-stage-2 backdrop-blur-sm">
              <CheckIcon size={13} className="text-accent" />
              <span className="max-w-[42vw] truncate">
                {referenceFileName ?? 'video'}
              </span>
            </div>

            {showPlayGlyph && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full border border-white/[0.18] bg-white/10 text-white backdrop-blur-md">
                  <PlayIcon size={34} className="ml-1" />
                </span>
              </div>
            )}

            {videoError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-4">
                <div className="max-w-[400px] text-center">
                  <p className="mb-2 text-lg font-semibold text-on-stage">
                    {videoError === 'codec_unsupported' ? t.err_codec : t.err_playback}
                  </p>
                  <p className="text-sm leading-[1.55] text-on-stage-2">
                    {videoError === 'codec_unsupported' ? t.err_codec_sub : t.err_playback_sub}
                  </p>
                </div>
              </div>
            )}

            {autoplayBlocked && (
              <div
                className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(8,11,10,0.88)] px-4 backdrop-blur-[7px]"
                role="status"
                aria-live="polite"
              >
                <div className="max-w-[400px] text-center">
                  <h3 className="m-0 text-[21px] font-semibold -tracking-[0.02em] text-white">
                    {t.st_autoplay_title}
                  </h3>
                  <p className="mx-auto mt-[10px] max-w-[360px] text-[14.5px] leading-[1.6] text-on-stage-2">
                    {t.st_autoplay_sub}
                  </p>
                  <div className="mt-5">
                    <Button ref={resumeButtonRef} variant="primary" size="lg" onClick={onResumePlayback}>
                      {t.st_autoplay_btn}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {interactionHint && (
              <div className="pointer-events-none absolute inset-x-4 bottom-5 z-20 flex justify-center">
                <div
                  className="rounded-full bg-black/66 px-4 py-2 text-[12.5px] text-white backdrop-blur-md"
                  role="status"
                  aria-live="polite"
                >
                  {interactionHint}
                </div>
              </div>
            )}
          </>
        ) : (
          <FileSelector
            roomId={roomId}
            isHost={isHost}
            roomStatus={roomStatus}
            referenceFileName={referenceFileName}
            referenceFileVersion={referenceFileVersion}
            socketReady={connectionState === 'connected'}
            onFileVerified={onFileVerified}
            onVerifyRequest={onVerifyRequest}
            verifyResult={verifyResult}
          />
        )}

        {waiting && <WaitingBanner ready={readyParticipants} total={totalParticipants} />}
        {reconnecting && <StageOverlay kind="reconnecting" />}
        {hostDisconnected && <StageOverlay kind="hostaway" count={graceCountdown} />}
      </div>

      {fileUrl && (
        <PlaybackControls
          videoRef={videoRef}
          canControl={canControl}
          onPlay={onPlay}
          onPause={onPause}
          onSeek={onSeek}
          videoReady={videoReady}
          onBlockedControlAttempt={onBlockedControlAttempt}
          onToggleFullscreen={toggleFullscreen}
        />
      )}
    </section>
  );
}
