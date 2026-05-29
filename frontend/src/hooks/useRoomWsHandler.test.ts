import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { WsParticipant } from '../types/ws';

const pushToast = vi.hoisted(() => vi.fn());

vi.mock('./useUi', () => ({
  useUi: () => ({ pushToast }),
}));

import { useRoomWsHandler } from './useRoomWsHandler';

function makeOptions() {
  return {
    navigate: vi.fn(),
    setParticipants: vi.fn(),
    addMessage: vi.fn(),
    setFileUrl: vi.fn(),
    setFileVersion: vi.fn(),
    fileVersionRef: { current: 0 },
    setHostDisconnected: vi.fn(),
    setGraceCountdown: vi.fn(),
    setVerifyResult: vi.fn(),
    setRoomStatus: vi.fn(),
    setReferenceFile: vi.fn(),
    clearPlaybackState: vi.fn(),
    onSyncMessage: vi.fn(),
  };
}

describe('useRoomWsHandler', () => {
  it('chat_message → addMessage called with mapped shape', () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useRoomWsHandler(opts));

    act(() => {
      result.current({
        type: 'chat_message',
        id: 'msg1',
        user_id: 'u1',
        username: 'alice',
        content: 'hello',
        created_at: '2024-01-01T00:00:00Z',
      });
    });

    expect(opts.addMessage).toHaveBeenCalledWith({
      id: 'msg1',
      user_id: 'u1',
      username: 'alice',
      content: 'hello',
      created_at: '2024-01-01T00:00:00Z',
    });
  });

  it('participant_ready → setParticipants called; updater toggles is_ready', () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useRoomWsHandler(opts));

    act(() => {
      result.current({
        type: 'participant_ready',
        user_id: 'u2',
        is_ready: true,
      });
    });

    expect(opts.setParticipants).toHaveBeenCalledTimes(1);

    // Verify updater logic by applying it to a sample array
    const updater = (opts.setParticipants as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as (current: WsParticipant[]) => WsParticipant[];

    const before: WsParticipant[] = [
      { user_id: 'u2', username: 'bob', is_ready: false },
    ];
    const after = updater(before);
    expect(after[0].is_ready).toBe(true);
  });

  it('error rate_limited → pushToast called', () => {
    const opts = makeOptions();
    pushToast.mockClear();
    const { result } = renderHook(() => useRoomWsHandler(opts));

    act(() => {
      result.current({
        type: 'error',
        code: 'rate_limited',
        message: 'slow',
      });
    });

    expect(pushToast).toHaveBeenCalledTimes(1);
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'warning' })
    );
  });

  it('error file_version_mismatch → pushToast NOT called', () => {
    const opts = makeOptions();
    pushToast.mockClear();
    const { result } = renderHook(() => useRoomWsHandler(opts));

    act(() => {
      result.current({
        type: 'error',
        code: 'file_version_mismatch',
        message: '',
      });
    });

    expect(pushToast).not.toHaveBeenCalled();
  });

  it('error with unknown code and message → pushToast called (generic fallback)', () => {
    const opts = makeOptions();
    pushToast.mockClear();
    const { result } = renderHook(() => useRoomWsHandler(opts));

    act(() => {
      result.current({
        type: 'error',
        code: 'something_else',
        message: 'oops',
      });
    });

    expect(pushToast).toHaveBeenCalledTimes(1);
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'oops' })
    );
  });

  it('host_reconnected with room_status → setRoomStatus called with that status', () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useRoomWsHandler(opts));

    act(() => {
      result.current({
        type: 'host_reconnected',
        room_status: 'waiting_ready',
      });
    });

    expect(opts.setRoomStatus).toHaveBeenCalledWith('waiting_ready');
  });

  it('host_reconnected without room_status → setRoomStatus called with "paused"', () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useRoomWsHandler(opts));

    act(() => {
      result.current({
        type: 'host_reconnected',
      });
    });

    expect(opts.setRoomStatus).toHaveBeenCalledWith('paused');
  });

  it('sync_state → setRoomStatus called AND onSyncMessage called', () => {
    const opts = makeOptions();
    const { result } = renderHook(() => useRoomWsHandler(opts));

    act(() => {
      result.current({
        type: 'sync_state',
        is_playing: true,
        current_time_ms: 4000,
      });
    });

    expect(opts.setRoomStatus).toHaveBeenCalledWith('playing');
    expect(opts.onSyncMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sync_state', is_playing: true })
    );
  });
});
