import { forwardRef } from 'react';

interface VideoPlayerProps {
  src: string | null;
  isInteractive: boolean;
  onCanPlay: () => void;
  onError: (message: string) => void;
  onClickToggle: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, isInteractive, onCanPlay, onError, onClickToggle }, ref) => {
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
        className={`group relative flex h-full flex-1 items-center justify-center bg-black ${isInteractive ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={onClickToggle}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-black/65 to-transparent" />

        <video
          ref={ref}
          src={src ?? undefined}
          className="h-full w-full object-contain"
          controls={false}
          onCanPlay={onCanPlay}
          onError={handleError}
        />

        <div className="pointer-events-none absolute inset-x-4 bottom-6 z-20 flex justify-center opacity-0 transition duration-300 group-hover:opacity-100 md:justify-end">
          <div className="rounded-full border border-outline-variant/20 bg-black/55 px-4 py-2 text-xs uppercase tracking-[0.2em] text-on-surface-variant backdrop-blur-xl">
            {isInteractive ? 'Click Video To Play Or Pause' : 'Synced To Host Timeline'}
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
