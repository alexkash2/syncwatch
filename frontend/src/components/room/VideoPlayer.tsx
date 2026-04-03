import { forwardRef } from 'react';

interface VideoPlayerProps {
  src: string;
  onCanPlay: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onCanPlay }, ref) => {
    return (
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <video
          ref={ref}
          src={src}
          className="w-full h-full object-contain"
          controls={false}
          onCanPlay={onCanPlay}
        />
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
