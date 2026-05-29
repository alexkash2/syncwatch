import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  VolumeIcon,
} from '../ui/icons';

interface PlaybackControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canControl: boolean;
  onPlay: (timeMs: number) => void;
  onPause: (timeMs: number) => void;
  onSeek: (timeMs: number) => void;
  videoReady: boolean;
  visible: boolean;
  onBlockedControlAttempt?: () => void;
}

const SKIP_SECONDS = 5;
const PLAYBACK_ACCESS_NOTE_ID = 'playback-access-note';

export function PlaybackControls({
  videoRef,
  canControl,
  onPlay,
  onPause,
  onSeek,
  videoReady,
  visible,
  onBlockedControlAttempt,
}: PlaybackControlsProps) {
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
  const volumeInputRef = useRef<HTMLInputElement>(null);

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
    if (!canControl) {
      onBlockedControlAttempt?.();
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
  }, [canControl, onBlockedControlAttempt, onPause, onPlay, videoRef]);

  const skipBy = useCallback(
    (seconds: number) => {
      if (!canControl) {
        onBlockedControlAttempt?.();
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
    [canControl, onBlockedControlAttempt, onSeek, videoRef]
  );

  const toggleFullscreen = useCallback(() => {
    const container =
      videoRef.current?.closest('[data-room-fullscreen-root]') ??
      videoRef.current?.closest('section');
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

    if (!canControl) {
      onBlockedControlAttempt?.();
      return;
    }

    const video = videoRef.current;
    if (video) {
      video.currentTime = seekValueRef.current;
    }

    onSeek(Math.round(seekValueRef.current * 1000));
  }, [canControl, onBlockedControlAttempt, onSeek, videoRef]);

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

  const timelineFillStyle = {
    '--slider-fill': `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%`,
  } as CSSProperties;
  const volumeFillStyle = {
    '--slider-fill': `${Math.min(volume * 100, 100)}%`,
  } as CSSProperties;

  return (
    <div
      className={`relative bg-gradient-to-t from-black/72 via-black/26 to-transparent px-4 pb-4 pt-10 transition-[transform,opacity] duration-300 ease-out md:px-6 md:pb-6 md:pt-12 xl:px-8 ${
        visible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-8 opacity-0'
      }`}
    >
      <p id={PLAYBACK_ACCESS_NOTE_ID} className="sr-only">
        Space toggles play, arrow keys seek, and F toggles fullscreen.
      </p>

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
          disabled={!canControl}
          className="media-slider w-full cursor-pointer disabled:cursor-default disabled:opacity-50"
          style={timelineFillStyle}
          aria-label="Playback position"
          aria-describedby={PLAYBACK_ACCESS_NOTE_ID}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        />
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div
          className="flex flex-wrap items-center gap-3"
          role="group"
          aria-label="Playback actions"
        >
          <ControlButton
            icon={isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
            label={isPlaying ? 'Pause' : 'Play'}
            onClick={togglePlay}
            enabled={canControl}
            ariaLabel={'Play or pause video'}
            title={'Play or pause'}
            ariaPressed={isPlaying}
            describedBy={PLAYBACK_ACCESS_NOTE_ID}
            iconOnly
            buttonClassName="h-[2.125rem] w-[2.125rem]"
          />

          <div
            className="group flex h-[2.625rem] items-center overflow-hidden rounded-full bg-black/20 px-1 py-1 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl"
            role="group"
            aria-label="Volume control"
          >
            <button
              type="button"
              onClick={() => volumeInputRef.current?.focus()}
              className="inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-full bg-transparent text-on-surface-variant transition hover:bg-white/[0.05] hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/40"
              aria-label="Adjust your volume"
              title="Volume"
            >
              <VolumeIcon size={20} />
            </button>

            <div className="grid opacity-0 transition-[grid-template-columns,opacity,padding] duration-200 ease-out [grid-template-columns:0fr] group-hover:pl-2 group-hover:opacity-100 group-hover:[grid-template-columns:1fr] group-focus-within:pl-2 group-focus-within:opacity-100 group-focus-within:[grid-template-columns:1fr]">
              <div className="flex h-full items-center overflow-hidden">
                <input
                  ref={volumeInputRef}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number.parseFloat(event.target.value))}
                  className="media-slider media-slider-thin block w-24 cursor-pointer"
                  style={volumeFillStyle}
                  title="Volume (only affects you)"
                  aria-label="Your volume"
                  aria-valuetext={`${Math.round(volume * 100)} percent`}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-4 self-end xl:self-auto"
          role="group"
          aria-label="Playback utilities"
        >
          <div className="rounded-full bg-black/20 px-5 py-3 text-sm font-semibold text-on-surface shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <span className="font-mono tracking-[0.08em]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <ControlButton
            icon={<FullscreenIcon size={16} />}
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={toggleFullscreen}
            enabled
            ariaLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title="Fullscreen"
            describedBy={PLAYBACK_ACCESS_NOTE_ID}
            iconOnly
          />
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  icon,
  label,
  onClick,
  enabled,
  title,
  ariaLabel,
  describedBy,
  ariaPressed,
  primary = false,
  iconOnly = false,
  chromeless = false,
  buttonClassName,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  enabled: boolean;
  title: string;
  ariaLabel: string;
  describedBy?: string;
  ariaPressed?: boolean;
  primary?: boolean;
  iconOnly?: boolean;
  chromeless?: boolean;
  buttonClassName?: string;
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
      className={`inline-flex items-center justify-center rounded-full text-[11px] font-bold uppercase tracking-[0.18em] transition ${
        iconOnly ? 'h-11 w-11 px-0 py-0' : 'gap-2 px-4 py-2.5'
      } ${
        chromeless
          ? 'border border-transparent bg-transparent text-on-surface-variant hover:text-on-surface'
        : primary
          ? 'border-white/10 bg-black/20 text-on-surface shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl hover:bg-black/28'
          : enabled
          ? 'border-white/10 bg-black/20 text-on-surface shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl hover:bg-black/28'
          : 'border-white/8 bg-black/12 text-on-surface-variant/55 shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl'
      } ${buttonClassName ?? ''}`}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
