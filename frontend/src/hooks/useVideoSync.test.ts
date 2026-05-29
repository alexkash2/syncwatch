import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useVideoSync } from './useVideoSync';

function makeMockVideo(paused = true): HTMLVideoElement {
  return {
    currentTime: 0,
    paused,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    buffered: { length: 0 },
  } as unknown as HTMLVideoElement;
}

describe('useVideoSync', () => {
  it('seeks and plays when sync_state is_playing=true and video is paused with large drift', async () => {
    const mockVideo = makeMockVideo(true);
    const videoRef = { current: mockVideo };
    const send = vi.fn().mockReturnValue(true);

    const { result } = renderHook(() =>
      useVideoSync({ videoRef, send, fileVersion: 1 })
    );

    await act(async () => {
      result.current.handleSyncMessage({
        type: 'sync_state',
        is_playing: true,
        current_time_ms: 5000,
        file_version: 1,
      });
    });

    expect(mockVideo.currentTime).toBeCloseTo(5, 1);
    expect(mockVideo.play).toHaveBeenCalledTimes(1);
  });

  it('pauses when sync_state is_playing=false and video is playing', async () => {
    const mockVideo = makeMockVideo(false); // paused=false → playing
    const videoRef = { current: mockVideo };
    const send = vi.fn().mockReturnValue(true);

    const { result } = renderHook(() =>
      useVideoSync({ videoRef, send, fileVersion: 1 })
    );

    await act(async () => {
      result.current.handleSyncMessage({
        type: 'sync_state',
        is_playing: false,
        current_time_ms: 1000,
        file_version: 1,
      });
    });

    expect(mockVideo.pause).toHaveBeenCalledTimes(1);
    expect(mockVideo.play).not.toHaveBeenCalled();
  });

  it('sends sync_report on sync_check', async () => {
    const mockVideo = makeMockVideo(true);
    const videoRef = { current: mockVideo };
    const send = vi.fn().mockReturnValue(true);

    const { result } = renderHook(() =>
      useVideoSync({ videoRef, send, fileVersion: 1 })
    );

    await act(async () => {
      result.current.handleSyncMessage({
        type: 'sync_check',
        current_time_ms: 0,
      });
    });

    expect(send).toHaveBeenCalledWith('sync_report', expect.objectContaining({
      is_playing: expect.any(Boolean),
      current_time_ms: expect.any(Number),
    }));
  });

  it('stores snapshot when videoRef is null, then resyncToLastState applies it once video is ready', async () => {
    const videoRef: { current: HTMLVideoElement | null } = { current: null };
    const send = vi.fn().mockReturnValue(true);

    const { result } = renderHook(() =>
      useVideoSync({ videoRef, send, fileVersion: 1 })
    );

    // Call with null video — must not throw
    await act(async () => {
      expect(() =>
        result.current.handleSyncMessage({
          type: 'sync_state',
          is_playing: true,
          current_time_ms: 8000,
        })
      ).not.toThrow();
    });

    // Now attach a real mock video
    const mockVideo = makeMockVideo(true);
    videoRef.current = mockVideo;

    // resyncToLastState should apply the stored snapshot
    await act(async () => {
      result.current.resyncToLastState();
    });

    expect(mockVideo.currentTime).toBeCloseTo(8, 1);
    expect(mockVideo.play).toHaveBeenCalledTimes(1);
  });

  it('resyncToLastState is a no-op when snapshot file_version differs from hook fileVersion', async () => {
    const mockVideo = makeMockVideo(true);
    const videoRef = { current: mockVideo };
    const send = vi.fn().mockReturnValue(true);

    // Hook uses fileVersion=1; store a snapshot with implicit version=1
    const { result, rerender } = renderHook(
      ({ fileVersion }: { fileVersion: number }) =>
        useVideoSync({ videoRef, send, fileVersion }),
      { initialProps: { fileVersion: 1 } }
    );

    await act(async () => {
      result.current.handleSyncMessage({
        type: 'sync_state',
        is_playing: true,
        current_time_ms: 3000,
        file_version: 1,
      });
    });

    // Re-render the hook with a different fileVersion — snapshot is now stale
    rerender({ fileVersion: 2 });

    const playCallsBefore = (mockVideo.play as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      result.current.resyncToLastState();
    });

    // play() should not have been called again
    expect((mockVideo.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(playCallsBefore);
  });
});
