import { forwardRef, useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string | null;
  isInteractive: boolean;
  onCanPlay: () => void;
  onError: (message: string) => void;
  onPointerDown: () => void;
  onClickToggle: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, isInteractive, onCanPlay, onError, onPointerDown, onClickToggle }, ref) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const clickTimerRef = useRef<number | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
      const syncFullscreenState = () => {
        const root = rootRef.current;
        const fullscreenElement = document.fullscreenElement;

        setIsFullscreen(Boolean(root && fullscreenElement && fullscreenElement.contains(root)));
      };

      syncFullscreenState();
      document.addEventListener('fullscreenchange', syncFullscreenState);
      return () => {
        document.removeEventListener('fullscreenchange', syncFullscreenState);
        if (clickTimerRef.current !== null) {
          window.clearTimeout(clickTimerRef.current);
        }
      };
    }, []);

    const toggleFullscreen = () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void root.requestFullscreen();
      }
    };

    const handleClick = () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }

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

      toggleFullscreen();
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
      <div
        ref={rootRef}
        className={`group relative flex h-full flex-1 touch-manipulation items-center justify-center bg-black ${isInteractive ? 'cursor-pointer' : 'cursor-default'}`}
        onPointerDown={onPointerDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-black/65 to-transparent" />

        <div
          className={`relative flex h-full w-full items-center justify-center ${
            isFullscreen ? 'px-0' : 'px-6 sm:px-10 md:px-14 lg:px-20 xl:px-28 2xl:px-36'
          }`}
        >
          {!isFullscreen && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-black sm:w-10 md:w-14 lg:w-20 xl:w-28 2xl:w-36" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-black sm:w-10 md:w-14 lg:w-20 xl:w-28 2xl:w-36" />
            </>
          )}

          <video
            ref={ref}
            src={src ?? undefined}
            className="h-full w-full object-contain"
            controls={false}
            onCanPlay={onCanPlay}
            onError={handleError}
            aria-label="Room video player"
          />
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
