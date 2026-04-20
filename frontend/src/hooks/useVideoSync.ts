import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessage } from '../types/ws';

interface UseVideoSyncOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  send: (type: string, payload?: Record<string, unknown>) => boolean;
  fileVersionRef: React.MutableRefObject<number>;
}

export function useVideoSync({ videoRef, send, fileVersionRef }: UseVideoSyncOptions) {
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const resumePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video
      .play()
      .then(() => setAutoplayBlocked(false))
      .catch(() => {
        // Still blocked — keep overlay up
      });
  }, [videoRef]);

  const handleSyncMessage = useCallback(
    (msg: WsMessage) => {
      const video = videoRef.current;
      if (!video) return;

      // Seq is already checked and updated by handleWsMessage in RoomPage — no duplicate check here.

      // file_version check — read current ref, not stale closure value
      if (msg.file_version !== undefined && msg.file_version !== fileVersionRef.current) return;

      switch (msg.type) {
        case 'sync_state': {
          const targetSec = (msg.current_time_ms || 0) / 1000;
          if (Math.abs(video.currentTime - targetSec) > 0.3) {
            video.currentTime = targetSec;
          }
          if (msg.is_playing && video.paused) {
            video.play().then(() => setAutoplayBlocked(false)).catch(() => {
              setAutoplayBlocked(true);
              send('playback_error', { error_code: 'autoplay_blocked' });
            });
          } else if (!msg.is_playing && !video.paused) {
            video.pause();
            setAutoplayBlocked(false);
          }
          break;
        }

        case 'sync_check': {
          // Only report — server decides correction
          const currentMs = Math.round(video.currentTime * 1000);
          const buffered = video.buffered.length > 0
            ? Math.round((video.buffered.end(video.buffered.length - 1) - video.currentTime) * 1000)
            : 0;

          let status = 'playing';
          if (video.paused) status = 'paused';
          if (video.readyState < 3) status = 'buffering';

          send('sync_report', {
            current_time_ms: currentMs,
            is_playing: !video.paused,
            buffer_health_ms: buffered,
            playback_status: status,
          });
          break;
        }

        case 'sync_correction': {
          const targetSec = (msg.target_time_ms || 0) / 1000;
          if (msg.action === 'seek') {
            video.currentTime = targetSec;
          }
          break;
        }

        case 'playback_rate': {
          video.playbackRate = msg.rate || 1.0;
          clearTimeout(nudgeTimer.current);
          nudgeTimer.current = setTimeout(() => {
            if (videoRef.current) videoRef.current.playbackRate = 1.0;
          }, 5000);
          break;
        }
      }
    },
    [videoRef, send, fileVersionRef]
  );

  useEffect(() => {
    return () => clearTimeout(nudgeTimer.current);
  }, []);

  return { handleSyncMessage, autoplayBlocked, resumePlayback };
}
