import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { SyncRelatedMessage } from '../types/ws';

interface UseVideoSyncOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  send: (type: string, payload?: Record<string, unknown>) => boolean;
  fileVersion: number;
}

export function useVideoSync({
  videoRef,
  send,
  fileVersion,
}: UseVideoSyncOptions) {
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  // Track whatever the room currently thinks is_playing so `resumePlayback`
  // can refuse to kick off local playback while the shared timeline is paused.
  const isRoomPlayingRef = useRef(false);

  // Last authoritative playback snapshot from sync_state (P2-2/P2-3).
  // Stored so we can re-apply it once the video element is ready (canplay).
  const lastSyncSnapshotRef = useRef<{
    is_playing: boolean;
    current_time_ms: number;
    file_version: number;
  } | null>(null);

  const sendSyncReport = useCallback(
    (video: HTMLVideoElement) => {
      let playbackStatus: 'playing' | 'paused' | 'buffering' | 'error' | 'waiting_interaction' =
        'playing';

      if (autoplayBlocked) {
        playbackStatus = 'waiting_interaction';
      } else if (video.error) {
        playbackStatus = 'error';
      } else if (video.readyState < 3 && !video.paused) {
        playbackStatus = 'buffering';
      } else if (video.paused) {
        playbackStatus = 'paused';
      }

      send('sync_report', {
        current_time_ms: Math.round(video.currentTime * 1000),
        is_playing: !video.paused,
        buffer_health_ms: getBufferHealthMs(video),
        playback_status: playbackStatus,
      });
    },
    [autoplayBlocked, send]
  );

  const resumePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // If the shared room is currently paused, do NOT start local playback on
    // user tap — that would desync this viewer against the host. Just dismiss
    // the overlay; the next sync_state with is_playing=true will retry play(),
    // and by then the browser already has the user-gesture it wanted.
    if (!isRoomPlayingRef.current) {
      setAutoplayBlocked(false);
      return;
    }

    video
      .play()
      .then(() => setAutoplayBlocked(false))
      .catch(() => {
        // Keep overlay visible until the browser accepts user interaction.
      });
  }, [videoRef]);

  const handleSyncMessage = useCallback(
    (msg: SyncRelatedMessage) => {
      // Persist the latest authoritative sync_state snapshot BEFORE the
      // video-null guard below. On reconnect the local file is usually still
      // restoring (videoRef null), so without this the fresh room state would
      // be dropped and resyncToLastState() would replay nothing — or a stale
      // pre-disconnect state — once the player becomes ready (P2-2/P2-3).
      if (
        msg.type === 'sync_state' &&
        (msg.file_version === undefined || msg.file_version === fileVersion)
      ) {
        isRoomPlayingRef.current = msg.is_playing;
        lastSyncSnapshotRef.current = {
          is_playing: msg.is_playing,
          current_time_ms: msg.current_time_ms,
          file_version: msg.file_version ?? fileVersion,
        };
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (msg.file_version !== undefined && msg.file_version !== fileVersion) {
        return;
      }

      switch (msg.type) {
        case 'sync_state': {
          const targetSeconds = msg.current_time_ms / 1000;
          const driftSeconds = Math.abs(video.currentTime - targetSeconds);

          if (driftSeconds > 0.25) {
            video.currentTime = targetSeconds;
          }

          if (msg.is_playing) {
            if (video.paused) {
              video
                .play()
                .then(() => setAutoplayBlocked(false))
                .catch(() => {
                  setAutoplayBlocked(true);
                  send('playback_error', { error_code: 'autoplay_blocked' });
                });
            }
          } else {
            // Room paused. Always clear the autoplay overlay even if the local
            // video was never started — otherwise the viewer stays prompted to
            // "resume" into a paused room, and tapping desynced the timeline.
            setAutoplayBlocked(false);
            if (!video.paused) {
              video.pause();
            }
          }
          break;
        }

        case 'sync_check':
          sendSyncReport(video);
          break;

        case 'sync_correction':
          if (msg.action === 'seek') {
            video.currentTime = msg.target_time_ms / 1000;
          }
          break;

        case 'playback_rate':
          video.playbackRate = msg.rate;
          clearTimeout(nudgeTimerRef.current);
          nudgeTimerRef.current = setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.playbackRate = 1.0;
            }
          }, 5000);
          break;
      }
    },
    [fileVersion, send, sendSyncReport, videoRef]
  );

  // Re-applies the last known sync_state snapshot to the video element.
  // Called from onVideoCanPlay after a reconnect so a frozen player resumes
  // instead of staying stuck (P2-2/P2-3). No-op if no snapshot or no video.
  const resyncToLastState = useCallback(() => {
    const video = videoRef.current;
    const snapshot = lastSyncSnapshotRef.current;
    if (!video || !snapshot) {
      return;
    }

    // Only apply if the snapshot belongs to the currently loaded file version.
    if (snapshot.file_version !== fileVersion) {
      return;
    }

    isRoomPlayingRef.current = snapshot.is_playing;

    const targetSeconds = snapshot.current_time_ms / 1000;
    const driftSeconds = Math.abs(video.currentTime - targetSeconds);
    if (driftSeconds > 0.25) {
      video.currentTime = targetSeconds;
    }

    if (snapshot.is_playing) {
      if (video.paused) {
        video
          .play()
          .then(() => setAutoplayBlocked(false))
          .catch(() => {
            setAutoplayBlocked(true);
            send('playback_error', { error_code: 'autoplay_blocked' });
          });
      }
    } else {
      setAutoplayBlocked(false);
      if (!video.paused) {
        video.pause();
      }
    }
  }, [fileVersion, send, videoRef]);

  useEffect(() => {
    return () => clearTimeout(nudgeTimerRef.current);
  }, []);

  return { handleSyncMessage, autoplayBlocked, resumePlayback, resyncToLastState };
}

function getBufferHealthMs(video: HTMLVideoElement) {
  for (let index = 0; index < video.buffered.length; index += 1) {
    const start = video.buffered.start(index);
    const end = video.buffered.end(index);

    if (video.currentTime >= start && video.currentTime <= end) {
      return Math.round((end - video.currentTime) * 1000);
    }
  }

  return 0;
}
