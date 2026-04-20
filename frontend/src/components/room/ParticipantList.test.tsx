import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipantList } from './ParticipantList';

const participants = [
  { user_id: 'u1', username: 'alice', is_ready: true },
  { user_id: 'u2', username: 'bob', is_ready: false },
  { user_id: 'u3', username: 'carol', is_ready: true },
];

describe('ParticipantList', () => {
  it('marks the host', () => {
    render(<ParticipantList participants={participants} hostId="u2" />);
    // "Host" badge next to bob
    expect(screen.getByText('Host')).toBeInTheDocument();
  });

  it('marks the current user as "(you)"', () => {
    render(
      <ParticipantList
        participants={participants}
        hostId="u1"
        currentUserId="u3"
      />
    );
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('renders host first, then alphabetical', () => {
    render(<ParticipantList participants={participants} hostId="u3" />);
    // Avatar divs show the first letter. They appear once per participant,
    // in render order, so they give us a clean ordering probe.
    const avatars = Array.from(document.querySelectorAll('div'))
      .filter((d) => /^[A-Z]$/.test(d.textContent || ''))
      .map((d) => d.textContent);
    expect(avatars).toEqual(['C', 'A', 'B']); // carol (host), then alphabetical
  });

  it('shows the ready/not-ready legend', () => {
    render(<ParticipantList participants={participants} hostId="u1" />);
    expect(screen.getByText(/Ready — video loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/Not ready/i)).toBeInTheDocument();
  });
});
