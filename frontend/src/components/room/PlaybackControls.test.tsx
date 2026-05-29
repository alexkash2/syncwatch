import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlaybackControls } from './PlaybackControls';
import type { RefObject } from 'react';

function makeVideoRef(paused = true): RefObject<HTMLVideoElement | null> {
  const video = {
    currentTime: 0,
    duration: 120,
    paused,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    volume: 1,
  } as unknown as HTMLVideoElement;

  return { current: video };
}

describe('PlaybackControls', () => {
  it('calls onPlay when canControl=true and video is paused (button click)', async () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const videoRef = makeVideoRef(true);

    render(
      <PlaybackControls
        videoRef={videoRef}
        canControl={true}
        onPlay={onPlay}
        onPause={onPause}
        onSeek={vi.fn()}
        videoReady={true}
        visible={true}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /play or pause/i }));

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPause).not.toHaveBeenCalled();
  });

  it('blocks control and calls onBlockedControlAttempt when canControl=false (button click)', async () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onBlockedControlAttempt = vi.fn();
    const videoRef = makeVideoRef(true);

    render(
      <PlaybackControls
        videoRef={videoRef}
        canControl={false}
        onPlay={onPlay}
        onPause={onPause}
        onSeek={vi.fn()}
        videoReady={true}
        visible={true}
        onBlockedControlAttempt={onBlockedControlAttempt}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /play or pause/i }));

    expect(onPlay).not.toHaveBeenCalled();
    expect(onPause).not.toHaveBeenCalled();
    expect(onBlockedControlAttempt).toHaveBeenCalledTimes(1);
  });

  it('Space key triggers onPlay when canControl=true', () => {
    const onPlay = vi.fn();
    const videoRef = makeVideoRef(true);

    render(
      <PlaybackControls
        videoRef={videoRef}
        canControl={true}
        onPlay={onPlay}
        onPause={vi.fn()}
        onSeek={vi.fn()}
        videoReady={true}
        visible={true}
      />
    );

    fireEvent.keyDown(window, { code: 'Space' });

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('Space key is inert when canControl=false (calls onBlockedControlAttempt, not onPlay)', () => {
    const onPlay = vi.fn();
    const onBlockedControlAttempt = vi.fn();
    const videoRef = makeVideoRef(true);

    render(
      <PlaybackControls
        videoRef={videoRef}
        canControl={false}
        onPlay={onPlay}
        onPause={vi.fn()}
        onSeek={vi.fn()}
        videoReady={true}
        visible={true}
        onBlockedControlAttempt={onBlockedControlAttempt}
      />
    );

    fireEvent.keyDown(window, { code: 'Space' });

    expect(onPlay).not.toHaveBeenCalled();
    expect(onBlockedControlAttempt).toHaveBeenCalledTimes(1);
  });

  it('seekbar is disabled when canControl=false', () => {
    const videoRef = makeVideoRef(true);

    render(
      <PlaybackControls
        videoRef={videoRef}
        canControl={false}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onSeek={vi.fn()}
        videoReady={true}
        visible={true}
      />
    );

    expect(screen.getByRole('slider', { name: /playback position/i })).toBeDisabled();
  });

  it('seekbar is enabled when canControl=true', () => {
    const videoRef = makeVideoRef(true);

    render(
      <PlaybackControls
        videoRef={videoRef}
        canControl={true}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onSeek={vi.fn()}
        videoReady={true}
        visible={true}
      />
    );

    expect(screen.getByRole('slider', { name: /playback position/i })).not.toBeDisabled();
  });
});
