import { forwardRef } from 'react';

interface VideoPlayerProps {
  src: string;
  onCanPlay: () => void;
  onError: (errorCode: string) => void;
  onClickToggle?: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onCanPlay, onError, onClickToggle }, ref) => {
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
        className="flex-1 flex items-center justify-center bg-black relative cursor-pointer"
        onClick={onClickToggle}
      >
        <video
          ref={ref}
          src={src}
          className="w-full h-full object-contain"
          controls={false}
          onCanPlay={onCanPlay}
          onError={handleError}
        />
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
