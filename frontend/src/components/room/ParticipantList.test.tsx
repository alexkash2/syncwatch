import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParticipantList } from './ParticipantList';

const participants = [
  { user_id: 'u1', username: 'alice', is_ready: true },
  { user_id: 'u2', username: 'bob', is_ready: false },
  { user_id: 'u3', username: 'carol', is_ready: true },
];

describe('ParticipantList', () => {
  it('marks the host', () => {
    render(<ParticipantList participants={participants} hostId="u2" currentUserId="u1" />);
    expect(screen.getByText('Host')).toBeInTheDocument();
  });

  it('marks the current user', () => {
    render(
      <ParticipantList participants={participants} hostId="u1" currentUserId="u3" />
    );
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders host first, then alphabetical', () => {
    render(<ParticipantList participants={participants} hostId="u3" currentUserId="u1" />);
    const avatars = Array.from(document.querySelectorAll('div'))
      .filter((div) => /^[A-Z]$/.test(div.textContent || ''))
      .map((div) => div.textContent);

    expect(avatars).toEqual(['C', 'A', 'B']);
  });

  it('shows readiness states', () => {
    render(<ParticipantList participants={participants} hostId="u1" currentUserId="u2" />);
    expect(screen.getAllByText('Ready')).toHaveLength(2);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });
});
