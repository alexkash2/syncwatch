import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react';

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

export function PlaybackControls({
  videoRef,
  isHost,
  onPlay,
  onPause,
  onSeek,
  videoReady,
  onNonHostControlAttempt,
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
    <div className="h-20 md:h-24 bg-surface-container/60 backdrop-blur-2xl border-t border-outline-variant/20 flex flex-col justify-center px-4 md:px-12 shrink-0">
      <div className="w-full mb-3">
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
          className="w-full h-1 bg-surface-container-highest rounded appearance-none cursor-pointer accent-primary-container disabled:cursor-default disabled:opacity-50"
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 md:gap-6">
          <button
            onClick={() => skipBy(-SKIP_SECONDS)}
            disabled={!isHost}
            className="text-on-surface-variant text-base md:text-lg cursor-pointer disabled:opacity-40 disabled:cursor-default hover:text-primary transition-colors"
            title={`Rewind ${SKIP_SECONDS}s`}
          >
            -5s
          </button>

          <button
            onClick={togglePlay}
            disabled={!isHost}
            className="text-on-surface-variant text-base md:text-lg cursor-pointer disabled:opacity-40 disabled:cursor-default hover:text-primary transition-colors"
            title="Play or pause"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => skipBy(SKIP_SECONDS)}
            disabled={!isHost}
            className="text-on-surface-variant text-base md:text-lg cursor-pointer disabled:opacity-40 disabled:cursor-default hover:text-primary transition-colors"
            title={`Forward ${SKIP_SECONDS}s`}
          >
            +5s
          </button>

          <span className="text-[10px] md:text-xs uppercase tracking-widest text-primary-container font-mono ml-2">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <span className="text-on-surface-variant text-sm" title="Volume only affects you">
            Vol
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number.parseFloat(event.target.value))}
            className="w-16 md:w-24 h-[2px] bg-surface-container-highest appearance-none cursor-pointer accent-primary"
            title="Volume (only affects you)"
            aria-label="Your volume"
          />

          <button
            onClick={toggleFullscreen}
            className="text-on-surface-variant text-sm md:text-base cursor-pointer hover:text-primary transition-colors"
            title="Fullscreen"
          >
            {isFullscreen ? 'Exit' : 'Full'}
          </button>
        </div>
      </div>
    </div>
  );
}
