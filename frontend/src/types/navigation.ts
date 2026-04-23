import type { StateTone } from '../components/ui/StatePanel';

export type HomeArrivalNoticeKey =
  | 'room_closed_host_left'
  | 'room_closed_host_timeout'
  | 'room_closed_deleted'
  | 'room_closed_generic'
  | 'tab_replaced'
  | 'room_not_found'
  | 'access_lost'
  | 'room_load_failed'
  | 'room_connection_failed';

export interface HomeArrivalNotice {
  key: HomeArrivalNoticeKey;
  eyebrow: string;
  title: string;
  description: string;
  tone: StateTone;
}

export interface HomeLocationState {
  arrivalNotice?: HomeArrivalNotice;
  flash?: string;
}

export function getHomeArrivalNotice(key: HomeArrivalNoticeKey): HomeArrivalNotice {
  switch (key) {
    case 'room_closed_host_left':
      return {
        key,
        eyebrow: 'Session Ended',
        title: 'The host closed this room',
        description:
          'That synced session has ended, but your dashboard is still ready for a fresh room or a quick rejoin.',
        tone: 'warning',
      };
    case 'room_closed_host_timeout':
      return {
        key,
        eyebrow: 'Session Timed Out',
        title: 'The host did not reconnect in time',
        description:
          'SyncWatch preserved the room for a while, then closed it when the host could not return.',
        tone: 'warning',
      };
    case 'room_closed_deleted':
      return {
        key,
        eyebrow: 'Room Removed',
        title: 'This room was deleted by the host',
        description:
          'You were returned safely to the dashboard. Start another session or open one of your recent rooms.',
        tone: 'danger',
      };
    case 'room_closed_generic':
      return {
        key,
        eyebrow: 'Session Ended',
        title: 'This room is no longer active',
        description:
          'The synced session was closed, and the dashboard is ready for whatever you want to do next.',
        tone: 'warning',
      };
    case 'tab_replaced':
      return {
        key,
        eyebrow: 'Tab Switched',
        title: 'This session moved to another tab',
        description:
          'Only one active room tab stays connected at a time, so this one was closed to protect the shared session state.',
        tone: 'primary',
      };
    case 'room_not_found':
      return {
        key,
        eyebrow: 'Room Missing',
        title: 'That room is no longer available',
        description:
          'It may have been deleted or the room code now points to a closed session.',
        tone: 'warning',
      };
    case 'access_lost':
      return {
        key,
        eyebrow: 'Access Changed',
        title: 'You no longer have access to this room',
        description:
          'Your membership changed, so SyncWatch returned you to the dashboard instead of leaving you in a broken session.',
        tone: 'danger',
      };
    case 'room_load_failed':
      return {
        key,
        eyebrow: 'Room Unavailable',
        title: "We couldn't restore this room right now",
        description:
          'The dashboard is still available while you retry later or open another synced room.',
        tone: 'warning',
      };
    case 'room_connection_failed':
      return {
        key,
        eyebrow: 'Connection Issue',
        title: 'Could not reopen the live room channel',
        description:
          'The room link could not be restored right now. Your dashboard is ready while the connection recovers.',
        tone: 'primary',
      };
  }
}
