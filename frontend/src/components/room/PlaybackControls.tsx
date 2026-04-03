import { useCallback, useEffect, useRef, useState } from 'react';

interface PlaybackControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isHost: boolean;
  onPlay: (timeMs: number) => void;
  onPause: (timeMs: number) => void;
  onSeek: (timeMs: number) => void;
}

export function PlaybackControls({ videoRef, isHost, onPlay, onPause, onSeek }: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isSeeking, setIsSeeking] = useState(false);
  const rafRef = useRef<number>();

  // Update time display
  useEffect(() => {
    const update = () => {
      const video = videoRef.current;
      if (video) {
        if (!isSeeking) setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
        setIsPlaying(!video.paused);
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef, isSeeking]);

  // Volume control (always local)
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume, videoRef]);

  const togglePlay = useCallback(() => {
    if (!isHost) return;
    const video = videoRef.current;
    if (!video) return;
    const timeMs = Math.round(video.currentTime * 1000);
    if (video.paused) {
      onPlay(timeMs);
    } else {
      onPause(timeMs);
    }
  }, [isHost, videoRef, onPlay, onPause]);

  const handleSeekStart = () => setIsSeeking(true);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
    if (!isHost) return;
    onSeek(Math.round(currentTime * 1000));
  }, [isHost, currentTime, onSeek]);

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '00:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
        <div className="flex items-center gap-4 md:gap-10">
          <button
            onClick={togglePlay}
            disabled={!isHost}
            className="text-on-surface-variant text-2xl md:text-3xl cursor-pointer disabled:opacity-40 disabled:cursor-default hover:text-primary transition-colors"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span className="text-[10px] md:text-xs uppercase tracking-widest text-primary-container font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <span className="text-on-surface-variant text-sm">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 md:w-24 h-[2px] bg-surface-container-highest appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>
    </div>
  );
}
