import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessage } from '../types/ws';
import client from '../api/client';

interface UseWebSocketOptions {
  roomId: string;
  onMessage: (msg: WsMessage) => void;
  lastSeqRef?: React.MutableRefObject<number>;
  fileVersionRef?: React.MutableRefObject<number>;
}

export function useWebSocket({ roomId, onMessage, lastSeqRef, fileVersionRef }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  const intentionalClose = useRef(false);
  const hasConnectedBefore = useRef(false);
  onMessageRef.current = onMessage;

  const connect = useCallback(async () => {
    if (intentionalClose.current) return;

    try {
      const { data } = await client.post('/auth/ws-ticket', { room_id: roomId });
      if (intentionalClose.current) return; // Check again after async
      const ticket = data.ticket;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomId}?ticket=${ticket}`);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempt.current = 0;
        // If reconnecting, send reconnect message
        if (hasConnectedBefore.current) {
          ws.send(JSON.stringify({
            type: 'reconnect',
            last_seq: lastSeqRef?.current ?? 0,
            file_version: fileVersionRef?.current ?? 0,
          }));
        }
        hasConnectedBefore.current = true;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          // Don't reconnect if tab was replaced
          if (msg.type === 'error' && msg.code === 'tab_replaced') {
            intentionalClose.current = true;
          }
          onMessageRef.current(msg);
        } catch {
          // Invalid JSON
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        // Only reconnect if not intentionally closed
        if (!intentionalClose.current) {
          const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
          reconnectAttempt.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      if (!intentionalClose.current) {
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    }
  }, [roomId]);

  useEffect(() => {
    intentionalClose.current = false;
    connect();
    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((type: string, payload: Record<string, any> = {}): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
      return true;
    }
    return false;
  }, []);

  return { send, isConnected };
}
