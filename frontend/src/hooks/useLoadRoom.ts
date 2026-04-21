import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router';
import { getChatHistory, getRoom } from '../api/rooms';
import { getHomeArrivalNotice } from '../types/navigation';
import type { RoomDetail } from '../types/room';
import type { ChatMessage, WsParticipant } from '../types/ws';

interface UseLoadRoomOptions {
  roomId: string;
  setRoom: (room: RoomDetail) => void;
  setParticipants: (participants: WsParticipant[]) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setChatCursor: (cursor: string | null) => void;
  setChatLoadError: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  navigate: NavigateFunction;
}

export function useLoadRoom({
  roomId,
  setRoom,
  setParticipants,
  setMessages,
  setChatCursor,
  setChatLoadError,
  setLoading,
  navigate,
}: UseLoadRoomOptions) {
  useEffect(() => {
    if (!roomId) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const room = await getRoom(roomId);
        if (cancelled) {
          return;
        }

        setRoom(room);
        setParticipants(room.participants || []);
      } catch (error) {
        console.error('Failed to load room:', error);
        if (!cancelled) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          const arrivalNotice = getHomeArrivalNotice(
            status === 404
              ? 'room_not_found'
              : status === 403
              ? 'access_lost'
              : 'room_load_failed'
          );

          navigate('/', { state: { arrivalNotice } });
        }
        return;
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      // Chat history is optional for opening the room — a failure should show
      // a retry affordance instead of kicking the user back to the dashboard.
      try {
        const history = await getChatHistory(roomId);
        if (!cancelled) {
          setMessages(history.messages);
          setChatCursor(history.next_cursor ?? null);
          setChatLoadError(false);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        if (!cancelled) {
          setChatLoadError(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    roomId,
    setChatCursor,
    setChatLoadError,
    setLoading,
    setMessages,
    setParticipants,
    setRoom,
  ]);
}
