import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router';
import { getHomeArrivalNotice } from '../types/navigation';
import { useUi } from './useUi';
import type {
  ChatMessage,
  FileVerifyResult,
  ReferenceFileState,
  RoomStatus,
  SyncRelatedMessage,
  WsMessage,
  WsParticipant,
} from '../types/ws';

interface UseRoomWsHandlerOptions {
  navigate: NavigateFunction;
  setParticipants: (
    value: WsParticipant[] | ((current: WsParticipant[]) => WsParticipant[])
  ) => void;
  addMessage: (message: ChatMessage) => void;
  setFileUrl: (url: string | null) => void;
  setFileVersion: (version: number) => void;
  fileVersionRef: MutableRefObject<number>;
  setHostDisconnected: (value: boolean) => void;
  setGraceCountdown: (value: number) => void;
  setVerifyResult: (value: FileVerifyResult | null) => void;
  setRoomStatus: (value: RoomStatus) => void;
  setReferenceFile: (value: ReferenceFileState) => void;
  clearPlaybackState: () => void;
  onSyncMessage: (message: SyncRelatedMessage) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useRoomWsHandler({
  navigate,
  setParticipants,
  addMessage,
  setFileUrl,
  setFileVersion,
  fileVersionRef,
  setHostDisconnected,
  setGraceCountdown,
  setVerifyResult,
  setRoomStatus,
  setReferenceFile,
  clearPlaybackState,
  onSyncMessage,
  videoRef,
}: UseRoomWsHandlerOptions) {
  const { pushToast } = useUi();
  const graceTimerRef = useRef<number | null>(null);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current !== null) {
      window.clearInterval(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearGraceTimer, [clearGraceTimer]);

  return useCallback(
    (msg: WsMessage) => {
      switch (msg.type) {
        case 'room_state': {
          setParticipants(msg.participants);
          const nextFileVersion = msg.file_version ?? msg.file_info.file_version;
          const previousFileVersion = fileVersionRef.current;

          setFileVersion(nextFileVersion);
          fileVersionRef.current = nextFileVersion;
          setRoomStatus(msg.room_status);
          setReferenceFile({
            fileName: msg.file_info.file_name,
            fileVersion: msg.file_info.file_version,
          });

          if (previousFileVersion > 0 && nextFileVersion !== previousFileVersion) {
            setFileUrl(null);
            setVerifyResult(null);
            clearPlaybackState();
          }

          const video = videoRef.current;
          if (video && video.readyState > 0) {
            video.currentTime = msg.playback_state.current_time_ms / 1000;

            if (msg.playback_state.is_playing) {
              video.play().catch(() => {});
            } else {
              video.pause();
            }
          }

          break;
        }

        case 'user_joined':
          setParticipants((currentParticipants) => {
            const nextParticipant: WsParticipant = {
              user_id: msg.user_id,
              username: msg.username,
              is_ready: false,
            };

            return [
              ...currentParticipants.filter(
                (participant) => participant.user_id !== msg.user_id
              ),
              nextParticipant,
            ];
          });
          break;

        case 'user_left':
          setParticipants((currentParticipants) =>
            currentParticipants.filter((participant) => participant.user_id !== msg.user_id)
          );
          break;

        case 'chat_message':
          addMessage({
            id: msg.id,
            user_id: msg.user_id,
            username: msg.username,
            content: msg.content,
            created_at: msg.created_at,
          });
          break;

        case 'file_verify_response':
          setVerifyResult({
            match: msg.match,
            reason: msg.reason,
            file_version: msg.file_version,
            file_hash: msg.file_hash,
          });

          if (msg.match && msg.file_version !== undefined) {
            setFileVersion(msg.file_version);
            fileVersionRef.current = msg.file_version;
          }
          break;

        case 'file_changed':
          setFileVersion(msg.file_version ?? 0);
          fileVersionRef.current = msg.file_version ?? 0;
          setRoomStatus('waiting_ready');
          setReferenceFile({
            fileName: msg.file_name,
            fileVersion: msg.file_version ?? 0,
          });
          setFileUrl(null);
          setVerifyResult(null);
          clearPlaybackState();
          break;

        case 'participant_ready':
          setParticipants((currentParticipants) =>
            currentParticipants.map((participant) =>
              participant.user_id === msg.user_id
                ? { ...participant, is_ready: msg.is_ready }
                : participant
            )
          );
          break;

        case 'host_disconnected': {
          clearGraceTimer();
          setHostDisconnected(true);
          setRoomStatus('closing');

          const totalSeconds = Math.round(msg.grace_period_ms / 1000);
          setGraceCountdown(totalSeconds);

          let remainingSeconds = totalSeconds;
          graceTimerRef.current = window.setInterval(() => {
            remainingSeconds -= 1;
            setGraceCountdown(Math.max(remainingSeconds, 0));

            if (remainingSeconds <= 0) {
              clearGraceTimer();
            }
          }, 1000);

          break;
        }

        case 'host_reconnected':
          clearGraceTimer();
          setHostDisconnected(false);
          setGraceCountdown(0);
          setRoomStatus('paused');
          break;

        case 'room_closed':
          clearGraceTimer();
          navigate('/', {
            state: {
              arrivalNotice: getHomeArrivalNotice(
                msg.reason === 'host_left'
                  ? 'room_closed_host_left'
                  : msg.reason === 'host_timeout'
                  ? 'room_closed_host_timeout'
                  : msg.reason === 'deleted'
                  ? 'room_closed_deleted'
                  : 'room_closed_generic'
              ),
            },
          });
          break;

        case 'sync_state':
          setRoomStatus(msg.is_playing ? 'playing' : 'paused');
          onSyncMessage(msg);
          break;

        case 'sync_correction':
        case 'sync_check':
        case 'playback_rate':
          onSyncMessage(msg);
          break;

        case 'error':
          if (msg.code === 'tab_replaced') {
            navigate('/', {
              state: {
                arrivalNotice: getHomeArrivalNotice('tab_replaced'),
              },
            });
          } else if (msg.code === 'room_gone') {
            navigate('/', { state: { arrivalNotice: getHomeArrivalNotice('room_not_found') } });
          } else if (msg.code === 'rate_limited') {
            pushToast({
              tone: 'warning',
              title: 'Slow down',
              description: msg.message || 'You are sending messages too quickly.',
              durationMs: 3200,
            });
          }
          break;

        default:
          break;
      }
    },
    [
      addMessage,
      clearGraceTimer,
      clearPlaybackState,
      navigate,
      onSyncMessage,
      pushToast,
      setFileUrl,
      setFileVersion,
      fileVersionRef,
      setGraceCountdown,
      setHostDisconnected,
      setParticipants,
      setReferenceFile,
      setRoomStatus,
      setVerifyResult,
      videoRef,
    ]
  );
}
