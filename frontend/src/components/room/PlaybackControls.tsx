import { useCallback, useEffect, useRef, useState } from 'react';

interface PlaybackControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
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
  const [volume, setVolume] = useState(0.7);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Re-run when videoReady changes (video element appears/disappears)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncState = () => {
      if (!isSeeking) setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      setIsPlaying(!video.paused);
    };

    // Sync immediately
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
  }, [videoRef, videoReady, isSeeking]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume, videoRef, videoReady]);

  const togglePlay = useCallback(() => {
    if (!isHost) {
      onNonHostControlAttempt?.();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const timeMs = Math.round(video.currentTime * 1000);
    if (video.paused) {
      video.play().catch(() => {});
      onPlay(timeMs);
    } else {
      video.pause();
      onPause(timeMs);
    }
  }, [isHost, videoRef, onPlay, onPause, onNonHostControlAttempt]);

  const skipBy = useCallback((seconds: number) => {
    if (!isHost) {
      onNonHostControlAttempt?.();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const newTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    video.currentTime = newTime;
    onSeek(Math.round(newTime * 1000));
  }, [isHost, videoRef, onSeek, onNonHostControlAttempt]);

  const toggleFullscreen = useCallback(() => {
    const container = videoRef.current?.closest('section');
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, [videoRef]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBy(-SKIP_SECONDS);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipBy(SKIP_SECONDS);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, skipBy, toggleFullscreen]);

  const seekValueRef = useRef(0);

  const handleSeekStart = () => setIsSeeking(true);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seekValueRef.current = val;
    setCurrentTime(val);
  };

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
    if (!isHost) return;
    const video = videoRef.current;
    if (video) {
      video.currentTime = seekValueRef.current;
    }
    onSeek(Math.round(seekValueRef.current * 1000));
  }, [isHost, videoRef, onSeek]);

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '00:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="h-20 md:h-24 bg-surface-container/60 backdrop-blur-2xl border-t border-outline-variant/20 flex flex-col justify-center px-4 md:px-12 shrink-0">
      {/* Progress bar */}
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

      {/* Controls row */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 md:gap-6">
          <button
            onClick={() => skipBy(-SKIP_SECONDS)}
            disabled={!isHost}
            className="text-on-surface-variant text-base md:text-lg cursor-pointer disabled:opacity-40 disabled:cursor-default hover:text-primary transition-colors"
            title={`Rewind ${SKIP_SECONDS}s (←)`}
          >
            ⏪
          </button>

          <button
            onClick={togglePlay}
            disabled={!isHost}
            className="text-on-surface-variant text-2xl md:text-3xl cursor-pointer disabled:opacity-40 disabled:cursor-default hover:text-primary transition-colors"
            title="Play/Pause (Space)"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button
            onClick={() => skipBy(SKIP_SECONDS)}
            disabled={!isHost}
            className="text-on-surface-variant text-base md:text-lg cursor-pointer disabled:opacity-40 disabled:cursor-default hover:text-primary transition-colors"
            title={`Forward ${SKIP_SECONDS}s (→)`}
          >
            ⏩
          </button>

          <span className="text-[10px] md:text-xs uppercase tracking-widest text-primary-container font-mono ml-2">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <span
            className="text-on-surface-variant text-sm"
            title="Volume only affects you"
          >
            🔊
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 md:w-24 h-[2px] bg-surface-container-highest appearance-none cursor-pointer accent-primary"
            title="Volume (only affects you)"
            aria-label="Your volume"
          />

          <button
            onClick={toggleFullscreen}
            className="text-on-surface-variant text-sm md:text-base cursor-pointer hover:text-primary transition-colors"
            title="Fullscreen (F)"
          >
            {isFullscreen ? '⊖' : '⛶'}
          </button>
        </div>
      </div>
    </div>
  );
}
