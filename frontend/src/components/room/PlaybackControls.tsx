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
import {
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  Skip5BackIcon,
  Skip5ForwardIcon,
  VolumeIcon,
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
    }
    try {
      window.localStorage.setItem('sw.volume', String(volume));
    } catch {
      // ignore storage failures (private mode / quota)
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
    <div className="shrink-0 border-t border-white/[0.06] bg-stage-2 px-5 pb-4 pt-3">
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
        className="sw-scrubber mb-[14px] w-full"
        style={scrubberFill}
        aria-label="Playback position"
        aria-describedby={ACCESS_NOTE_ID}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
      />

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-[6px]" role="group" aria-label="Playback actions">
          <IconBtn label={t.back5} onClick={() => skipBy(-SKIP_SECONDS)}>
            <Skip5BackIcon size={20} />
          </IconBtn>
          <IconBtn
            label="Play or pause video"
            onClick={togglePlay}
            big
            ariaPressed={isPlaying}
            describedBy={ACCESS_NOTE_ID}
          >
            {isPlaying ? (
              <PauseIcon size={22} />
            ) : (
              <PlayIcon size={22} className="ml-0.5" />
            )}
          </IconBtn>
          <IconBtn label={t.fwd5} onClick={() => skipBy(SKIP_SECONDS)}>
            <Skip5ForwardIcon size={20} />
          </IconBtn>
        </div>

        <span className="ml-2 whitespace-nowrap font-mono text-[13px] tabular-nums text-on-stage-2">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-[10px] text-on-stage sm:w-[150px]">
          <VolumeIcon size={19} className="shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number.parseFloat(event.target.value))}
            className="sw-range hidden flex-1 sm:block"
            aria-label={t.volume}
            aria-valuetext={`${Math.round(volume * 100)} percent`}
          />
        </div>

        <div className="mx-[6px] h-[22px] w-px shrink-0 bg-white/[0.14]" />

        <IconBtn label={t.fullscreen} onClick={() => onToggleFullscreen?.()}>
          <FullscreenIcon size={19} />
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
      className={
        'inline-flex shrink-0 items-center justify-center text-on-stage transition hover:bg-white/[0.14] ' +
        (big ? 'h-[46px] w-[46px] rounded-full bg-white/10' : 'h-[38px] w-[38px] rounded-[9px]')
      }
    >
      {children}
    </button>
  );
}
