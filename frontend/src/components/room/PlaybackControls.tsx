import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useI18n } from '../../hooks/useI18n';
import { cn } from '../ui/cn';
import {
  ExitFullscreenIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  Skip5BackIcon,
  Skip5ForwardIcon,
  VolumeIcon,
  VolumeMutedIcon,
} from '../ui/icons';

interface PlaybackControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canControl: boolean;
  onPlay: (timeMs: number) => boolean;
  onPause: (timeMs: number) => boolean;
  onSeek: (timeMs: number) => boolean;
  videoReady: boolean;
  onBlockedControlAttempt?: () => void;
  onToggleFullscreen?: () => void;
  /** Render as a floating overlay (gradient, no border) — used in fullscreen. */
  overlay?: boolean;
  /** Swap the fullscreen glyph to "exit" while the stage is fullscreen. */
  isFullscreen?: boolean;
}

const SKIP_SECONDS = 5;
const ACCESS_NOTE_ID = 'playback-access-note';
const SCRUBBER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return '0:00';
  }
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function PlaybackControls({
  videoRef,
  canControl,
  onPlay,
  onPause,
  onSeek,
  videoReady,
  onBlockedControlAttempt,
  onToggleFullscreen,
  overlay = false,
  isFullscreen = false,
}: PlaybackControlsProps) {
  const { t } = useI18n();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [volume, setVolume] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem('sw.volume');
      const next = raw !== null ? Number.parseFloat(raw) : NaN;
      return Number.isFinite(next) && next >= 0 && next <= 1 ? next : 0.7;
    } catch {
      return 0.7;
    }
  });
  const [muted, setMuted] = useState(false);
  const preMuteVolumeRef = useRef(0.7);
  const seekValueRef = useRef(0);
  const seekInteractionActiveRef = useRef(false);

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
      videoRef.current.muted = muted;
    }
    try {
      window.localStorage.setItem('sw.volume', String(volume));
    } catch {
      // ignore storage failures (private mode / quota)
    }
  }, [muted, videoReady, videoRef, volume]);

  const isSilent = muted || volume === 0;
  const toggleMute = useCallback(() => {
    if (isSilent) {
      setMuted(false);
      if (volume === 0) {
        setVolume(preMuteVolumeRef.current || 0.7);
      }
    } else {
      preMuteVolumeRef.current = volume;
      setMuted(true);
    }
  }, [isSilent, volume]);

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
    // Send first; only mutate the local element if the socket accepted the
    // command, so a dropped socket can't desync this client from the room.
    if (video.paused) {
      if (onPlay(timeMs)) {
        video.play().catch(() => {});
      }
    } else if (onPause(timeMs)) {
      video.pause();
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
      // Send first; only move the local element if the room accepted the seek.
      if (onSeek(Math.round(newTime * 1000))) {
        video.currentTime = newTime;
      }
    },
    [canControl, onBlockedControlAttempt, onSeek, videoRef]
  );

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
          onToggleFullscreen?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onToggleFullscreen, skipBy, togglePlay]);

  const handleSeekStart = () => {
    // Seed the pending value with the real current position so an interaction
    // that produces no change event (thumb click without moving, arrow at a
    // boundary) commits the current time instead of a stale ref (often 0).
    const video = videoRef.current;
    seekValueRef.current = video ? video.currentTime : currentTime;
    seekInteractionActiveRef.current = true;
    setIsSeeking(true);
  };
  const handleSeekChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(event.target.value);
    if (!seekInteractionActiveRef.current) {
      seekInteractionActiveRef.current = true;
      setIsSeeking(true);
    }
    seekValueRef.current = value;
    setCurrentTime(value);
  };
  const handleSeekEnd = useCallback(() => {
    if (!seekInteractionActiveRef.current) {
      return;
    }
    seekInteractionActiveRef.current = false;
    setIsSeeking(false);
    const video = videoRef.current;
    if (!canControl) {
      onBlockedControlAttempt?.();
      // Snap the scrubber back to the real position (drag set local state only).
      if (video) {
        setCurrentTime(video.currentTime);
      }
      return;
    }
    // Send first; only move the element if accepted, otherwise revert the
    // scrubber to the element's real position so they can't diverge.
    if (onSeek(Math.round(seekValueRef.current * 1000))) {
      if (video) {
        video.currentTime = seekValueRef.current;
      }
    } else if (video) {
      setCurrentTime(video.currentTime);
    }
  }, [canControl, onBlockedControlAttempt, onSeek, videoRef]);
  const handleSeekKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (SCRUBBER_KEYS.has(event.key)) {
      handleSeekStart();
    }
  };
  const handleSeekKeyUp = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (SCRUBBER_KEYS.has(event.key)) {
      handleSeekEnd();
    }
  };

  const scrubberFill = {
    '--slider-fill': `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        'px-4 pb-3 pt-2',
        overlay
          ? 'bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-8 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
          : 'border-t border-white/[0.06] bg-stage-2'
      )}
    >
      <p id={ACCESS_NOTE_ID} className="sr-only">
        Space toggles play, arrow keys seek, and F toggles fullscreen.
      </p>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onMouseDown={handleSeekStart}
        onTouchStart={handleSeekStart}
        onChange={handleSeekChange}
        onKeyDown={handleSeekKeyDown}
        onKeyUp={handleSeekKeyUp}
        onBlur={handleSeekEnd}
        onMouseUp={handleSeekEnd}
        onTouchEnd={handleSeekEnd}
        disabled={!canControl}
        className="sw-scrubber mb-2.5 w-full"
        style={scrubberFill}
        aria-label="Playback position"
        aria-describedby={ACCESS_NOTE_ID}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      />

      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1" role="group" aria-label="Playback actions">
          <IconBtn label={t.back5} onClick={() => skipBy(-SKIP_SECONDS)}>
            <Skip5BackIcon size={19} />
          </IconBtn>
          <IconBtn
            label="Play or pause video"
            onClick={togglePlay}
            big
            ariaPressed={isPlaying}
            describedBy={ACCESS_NOTE_ID}
          >
            {isPlaying ? (
              <PauseIcon size={21} />
            ) : (
              <PlayIcon size={21} className="ml-0.5" />
            )}
          </IconBtn>
          <IconBtn label={t.fwd5} onClick={() => skipBy(SKIP_SECONDS)}>
            <Skip5ForwardIcon size={19} />
          </IconBtn>
        </div>

        <span className="ml-2 whitespace-nowrap font-mono text-xs tabular-nums text-white/65">
          {formatTime(currentTime)}
          <span className="mx-1 text-white/35">/</span>
          {formatTime(duration)}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <IconBtn label={isSilent ? t.unmute : t.mute} onClick={toggleMute}>
            {isSilent ? <VolumeMutedIcon size={19} /> : <VolumeIcon size={19} />}
          </IconBtn>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(event) => {
              const next = Number.parseFloat(event.target.value);
              setVolume(next);
              if (next > 0) {
                setMuted(false);
              }
            }}
            className="sw-range hidden w-[92px] sm:block"
            aria-label={t.volume}
            aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} percent`}
          />
        </div>

        <IconBtn
          label={isFullscreen ? t.exit_fullscreen : t.fullscreen}
          onClick={() => onToggleFullscreen?.()}
        >
          {isFullscreen ? <ExitFullscreenIcon size={19} /> : <FullscreenIcon size={19} />}
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  big = false,
  ariaPressed,
  describedBy,
  children,
}: {
  label: string;
  onClick: () => void;
  big?: boolean;
  ariaPressed?: boolean;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={ariaPressed}
      aria-describedby={describedBy}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors',
        big
          ? 'h-11 w-11 rounded-full bg-accent text-white shadow-[0_2px_14px_rgba(22,185,129,0.35)] hover:bg-accent-strong'
          : 'h-9 w-9 rounded-[10px] text-white/80 hover:bg-white/10 hover:text-white'
      )}
    >
      {children}
    </button>
  );
}
