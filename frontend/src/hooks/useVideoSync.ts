import { useCallback, useEffect, useRef } from 'react';
import type { WsMessage } from '../types/ws';

interface UseVideoSyncOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  send: (type: string, payload?: Record<string, any>) => boolean;
  fileVersion: number;
  lastSeq: React.MutableRefObject<number>;
}

export function useVideoSync({ videoRef, send, fileVersion, lastSeq }: UseVideoSyncOptions) {
  const nudgeTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSyncMessage = useCallback(
    (msg: WsMessage) => {
      const video = videoRef.current;
      if (!video) return;

      // Seq ordering: skip stale messages
      if (msg.seq !== undefined) {
        if (msg.seq <= lastSeq.current) return;
        lastSeq.current = msg.seq;
      }

      // file_version check for sync messages
      if (msg.file_version !== undefined && msg.file_version !== fileVersion) return;

      switch (msg.type) {
        case 'sync_state': {
          const targetSec = (msg.current_time_ms || 0) / 1000;
          if (Math.abs(video.currentTime - targetSec) > 0.3) {
            video.currentTime = targetSec;
          }
          if (msg.is_playing && video.paused) {
            video.play().catch(() => {
              send('playback_error', { error_code: 'autoplay_blocked' });
            });
          } else if (!msg.is_playing && !video.paused) {
            video.pause();
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
    [videoRef, send, fileVersion, lastSeq]
  );

  useEffect(() => {
    return () => clearTimeout(nudgeTimer.current);
  }, []);

  return { handleSyncMessage };
}
