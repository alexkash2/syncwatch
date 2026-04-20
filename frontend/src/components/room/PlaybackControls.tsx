import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  ForwardIcon,
  FullscreenIcon,
  KeyboardIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  VolumeIcon,
} from '../ui/icons';
import { usePreferences } from '../../hooks/usePreferences';

interface PlaybackControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isHost: boolean;
  onPlay: (timeMs: number) => void;
  onPause: (timeMs: number) => void;
  onSeek: (timeMs: number) => void;
  videoReady: boolean;
  onNonHostControlAttempt?: () => void;
}

const SKIP_SECONDS = 5;
const PLAYBACK_ACCESS_NOTE_ID = 'playback-access-note';

export function PlaybackControls({
  videoRef,
  isHost,
  onPlay,
  onPause,
  onSeek,
  videoReady,
  onNonHostControlAttempt,
}: PlaybackControlsProps) {
  const { preferences } = usePreferences();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem('sw.volume');
      const nextVolume = raw !== null ? Number.parseFloat(raw) : NaN;
      return Number.isFinite(nextVolume) && nextVolume >= 0 && nextVolume <= 1
        ? nextVolume
        : 0.7;
    } catch {
      return 0.7;
    }
  });
  const [isSeeking, setIsSeeking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const seekValueRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const syncState = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
      }

      setDuration(video.duration || 0);
      setIsPlaying(!video.paused);
    };

    syncState();

    video.addEventListener('timeupdate', syncState);
    video.addEventListener('play', syncState);
    video.addEventListener('pause', syncState);
    video.addEventListener('loadedmetadata', syncState);
    video.addEventListener('seeked', syncState);

    return () => {
      video.removeEventListener('timeupdate', syncState);
      video.removeEventListener('play', syncState);
      video.removeEventListener('pause', syncState);
      video.removeEventListener('loadedmetadata', syncState);
      video.removeEventListener('seeked', syncState);
    };
  }, [isSeeking, videoReady, videoRef]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }

    try {
      window.localStorage.setItem('sw.volume', String(volume));
    } catch {
      // Ignore storage failures for private mode / quota.
    }
  }, [videoReady, videoRef, volume]);

  const togglePlay = useCallback(() => {
    if (!isHost) {
      onNonHostControlAttempt?.();
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const timeMs = Math.round(video.currentTime * 1000);
    if (video.paused) {
      video.play().catch(() => {});
      onPlay(timeMs);
    } else {
      video.pause();
      onPause(timeMs);
    }
  }, [isHost, onNonHostControlAttempt, onPause, onPlay, videoRef]);

  const skipBy = useCallback(
    (seconds: number) => {
      if (!isHost) {
        onNonHostControlAttempt?.();
        return;
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      const newTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
      video.currentTime = newTime;
      onSeek(Math.round(newTime * 1000));
    },
    [isHost, onNonHostControlAttempt, onSeek, videoRef]
  );

  const toggleFullscreen = useCallback(() => {
    const container = videoRef.current?.closest('section');
    if (!container) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  }, [videoRef]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const tagName = (event.target as HTMLElement)?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          skipBy(-SKIP_SECONDS);
          break;
        case 'ArrowRight':
          event.preventDefault();
          skipBy(SKIP_SECONDS);
          break;
        case 'KeyF':
          event.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [skipBy, toggleFullscreen, togglePlay]);

  const handleSeekStart = () => setIsSeeking(true);

  const handleSeekChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(event.target.value);
    seekValueRef.current = value;
    setCurrentTime(value);
  };

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);

    if (!isHost) {
      onNonHostControlAttempt?.();
      return;
    }

    const video = videoRef.current;
    if (video) {
      video.currentTime = seekValueRef.current;
    }

    onSeek(Math.round(seekValueRef.current * 1000));
  }, [isHost, onNonHostControlAttempt, onSeek, videoRef]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) {
      return '00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(
        2,
        '0'
      )}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  return (
    <div className="shrink-0 border-t border-outline-variant/20 bg-surface-container/60 px-4 py-4 backdrop-blur-2xl md:px-8 md:py-5 xl:px-12">
      <p id={PLAYBACK_ACCESS_NOTE_ID} className="sr-only">
        {isHost
          ? 'You control playback for the room. Space toggles play, arrow keys seek, and F toggles fullscreen.'
          : 'Playback controls are locked for viewers. Only the host can change the shared timeline.'}
      </p>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Playback status">
          <StatusPill
            tone={isHost ? 'primary' : 'neutral'}
            label={isHost ? 'Host controls live' : 'Viewer sync locked'}
          />
          <StatusPill
            tone="neutral"
            label={videoReady ? 'Local player ready' : 'Preparing player'}
          />
        </div>

        {preferences.showHotkeys && (
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Keyboard shortcuts"
          >
            <HotkeyChip label="Space" icon={<KeyboardIcon size={13} />} />
            <HotkeyChip label="Left/Right" />
            <HotkeyChip label="F" />
          </div>
        )}
      </div>

      <div className="mb-4 w-full">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onMouseDown={handleSeekStart}
          onTouchStart={handleSeekStart}
          onChange={handleSeekChange}
          onMouseUp={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
          disabled={!isHost}
          className="media-slider w-full cursor-pointer disabled:cursor-default disabled:opacity-50"
          aria-label="Playback position"
          aria-describedby={PLAYBACK_ACCESS_NOTE_ID}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        />
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Playback actions">
          <ControlButton
            icon={<RewindIcon size={16} />}
            label={`Back ${SKIP_SECONDS}s`}
            compactLabel={`-${SKIP_SECONDS}s`}
            onClick={() => skipBy(-SKIP_SECONDS)}
            enabled={isHost}
            ariaLabel={isHost ? `Rewind ${SKIP_SECONDS} seconds` : 'Only the host can rewind'}
            title={isHost ? `Rewind ${SKIP_SECONDS}s` : 'Only the host can rewind'}
            describedBy={PLAYBACK_ACCESS_NOTE_ID}
          />

          <ControlButton
            icon={isPlaying ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
            label={isPlaying ? 'Pause' : 'Play'}
            onClick={togglePlay}
            enabled={isHost}
            primary
            ariaLabel={isHost ? 'Play or pause video' : 'Only the host can control playback'}
            title={isHost ? 'Play or pause' : 'Only the host can control playback'}
            ariaPressed={isPlaying}
            describedBy={PLAYBACK_ACCESS_NOTE_ID}
          />

          <ControlButton
            icon={<ForwardIcon size={16} />}
            label={`Forward ${SKIP_SECONDS}s`}
            compactLabel={`+${SKIP_SECONDS}s`}
            onClick={() => skipBy(SKIP_SECONDS)}
            enabled={isHost}
            ariaLabel={
              isHost ? `Skip forward ${SKIP_SECONDS} seconds` : 'Only the host can skip forward'
            }
            title={isHost ? `Forward ${SKIP_SECONDS}s` : 'Only the host can skip forward'}
            describedBy={PLAYBACK_ACCESS_NOTE_ID}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Playback utilities">
          <div className="rounded-full border border-primary-container/16 bg-black/24 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="font-mono tracking-[0.22em]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex min-w-[14rem] flex-1 items-center gap-3 rounded-full border border-outline-variant/14 bg-black/20 px-4 py-2.5 xl:min-w-[16rem] xl:flex-none">
            <VolumeIcon size={15} className="text-on-surface-variant" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(Number.parseFloat(event.target.value))}
              className="media-slider media-slider-thin w-full cursor-pointer"
              title="Volume (only affects you)"
              aria-label="Your volume"
              aria-valuetext={`${Math.round(volume * 100)} percent`}
            />
          </div>

          <ControlButton
            icon={<FullscreenIcon size={16} />}
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            compactLabel={isFullscreen ? 'Exit' : 'Full'}
            onClick={toggleFullscreen}
            enabled
            ariaLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title="Fullscreen"
            describedBy={PLAYBACK_ACCESS_NOTE_ID}
          />
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  compactLabel,
  onClick,
  enabled,
  title,
  ariaLabel,
  describedBy,
  ariaPressed,
  primary = false,
}: {
  icon: ReactNode;
  label: string;
  compactLabel?: string;
  onClick: () => void;
  enabled: boolean;
  title: string;
  ariaLabel: string;
  describedBy?: string;
  ariaPressed?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!enabled}
      aria-describedby={describedBy}
      aria-pressed={ariaPressed}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
        primary
          ? 'border-primary-container/36 bg-primary-container text-on-primary-container shadow-[0_12px_32px_rgba(0,98,255,0.24)] hover:brightness-110'
          : enabled
          ? 'border-outline-variant/16 bg-black/18 text-on-surface-variant hover:border-primary-container/35 hover:text-on-surface'
          : 'border-outline-variant/12 bg-black/18 text-on-surface-variant/55 hover:border-primary-container/22 hover:text-primary'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{compactLabel ?? label}</span>
    </button>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'primary' | 'neutral';
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
        tone === 'primary'
          ? 'border-primary-container/28 bg-primary-container/10 text-primary'
          : 'border-outline-variant/16 bg-black/18 text-on-surface-variant'
      }`}
    >
      {label}
    </span>
  );
}

function HotkeyChip({
  label,
  icon,
}: {
  label: string;
  icon?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/14 bg-black/18 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
      {icon}
      {label}
    </span>
  );
}
