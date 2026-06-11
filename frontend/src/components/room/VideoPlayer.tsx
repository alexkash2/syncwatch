import { forwardRef, useEffect, useRef } from 'react';

interface VideoPlayerProps {
  src: string | null;
  isInteractive: boolean;
  hideCursor?: boolean;
  onCanPlay: () => void;
  onError: (message: string) => void;
  onClickToggle: () => void;
  /** Tap on a touch device — reveals/hides the control bar instead of pausing. */
  onTouchTap?: () => void;
  onToggleFullscreen: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  (
    { src, isInteractive, hideCursor = false, onCanPlay, onError, onClickToggle, onTouchTap, onToggleFullscreen },
    ref
  ) => {
    const clickTimerRef = useRef<number | null>(null);
    const lastPointerTypeRef = useRef<string>('mouse');

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
        // A finger tap must never pause the whole room — on touch it only
        // toggles the control bar; play/pause lives on the explicit button.
        if (lastPointerTypeRef.current === 'touch') {
          onTouchTap?.();
        } else {
          onClickToggle();
        }
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
        className={`h-full w-full object-contain ${
          hideCursor ? 'cursor-none' : isInteractive ? 'cursor-pointer' : 'cursor-default'
        }`}
        controls={false}
        // playsInline keeps the video inline on iPhone instead of forcing iOS's
        // native fullscreen player, whose own play/pause/seek controls bypass our
        // handlers and desync viewers.
        playsInline
        onPointerDown={(event) => {
          lastPointerTypeRef.current = event.pointerType || 'mouse';
        }}
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
