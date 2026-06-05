import { forwardRef, useEffect, useRef } from 'react';

interface VideoPlayerProps {
  src: string | null;
  isInteractive: boolean;
  onCanPlay: () => void;
  onError: (message: string) => void;
  onClickToggle: () => void;
  onToggleFullscreen: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, isInteractive, onCanPlay, onError, onClickToggle, onToggleFullscreen }, ref) => {
    const clickTimerRef = useRef<number | null>(null);

    useEffect(
      () => () => {
        if (clickTimerRef.current !== null) {
          window.clearTimeout(clickTimerRef.current);
        }
      },
      []
    );

    const handleClick = () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
      // Debounce so a double-click (fullscreen) doesn't also toggle playback.
      clickTimerRef.current = window.setTimeout(() => {
        onClickToggle();
        clickTimerRef.current = null;
      }, 220);
    };

    const handleDoubleClick = () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      onToggleFullscreen();
    };

    const handleError = () => {
      const video = (ref as React.RefObject<HTMLVideoElement>)?.current;
      const mediaError = video?.error;
      if (mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        onError('codec_unsupported');
      } else {
        onError('media_error');
      }
    };

    return (
      <video
        ref={ref}
        src={src ?? undefined}
        className={`h-full w-full object-contain ${isInteractive ? 'cursor-pointer' : 'cursor-default'}`}
        controls={false}
        // playsInline keeps the video inline on iPhone instead of forcing iOS's
        // native fullscreen player, whose own play/pause/seek controls bypass our
        // handlers and desync viewers.
        playsInline
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onCanPlay={onCanPlay}
        onError={handleError}
        aria-label="Room video player"
      />
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
