import { create } from 'zustand';
import type { ChatMessage, WsParticipant } from '../types/ws';

type StateUpdater<T> = T | ((current: T) => T);

interface RoomStoreState {
  participants: WsParticipant[];
  messages: ChatMessage[];
  fileUrl: string | null;
  fileVersion: number;
  hostDisconnected: boolean;
  graceCountdown: number;
  setParticipants: (value: StateUpdater<WsParticipant[]>) => void;
  setMessages: (value: StateUpdater<ChatMessage[]>) => void;
  addMessage: (message: ChatMessage) => void;
  setFileUrl: (url: string | null) => void;
  setFileVersion: (version: number) => void;
  setHostDisconnected: (value: boolean) => void;
  setGraceCountdown: (value: number) => void;
  resetRoom: () => void;
}

function resolveState<T>(current: T, value: StateUpdater<T>) {
  return typeof value === 'function'
    ? (value as (currentState: T) => T)(current)
    : value;
}

export const useRoomStore = create<RoomStoreState>((set) => ({
  participants: [],
  messages: [],
  fileUrl: null,
  fileVersion: 0,
  hostDisconnected: false,
  graceCountdown: 0,
  setParticipants: (value) =>
    set((state) => ({
      participants: resolveState(state.participants, value),
    })),
  setMessages: (value) =>
    set((state) => ({
      messages: resolveState(state.messages, value),
    })),
  addMessage: (message) =>
    set((state) => ({
      messages: state.messages.some((currentMessage) => currentMessage.id === message.id)
        ? state.messages
        : [...state.messages, message],
    })),
  setFileUrl: (fileUrl) =>
    set((state) => {
      if (state.fileUrl && state.fileUrl !== fileUrl) {
        URL.revokeObjectURL(state.fileUrl);
      }
      return { fileUrl };
    }),
  setFileVersion: (fileVersion) => set({ fileVersion }),
  setHostDisconnected: (hostDisconnected) => set({ hostDisconnected }),
  setGraceCountdown: (graceCountdown) => set({ graceCountdown }),
  resetRoom: () =>
    set((state) => {
      if (state.fileUrl) {
        URL.revokeObjectURL(state.fileUrl);
      }
      return {
        participants: [],
        messages: [],
        fileUrl: null,
        fileVersion: 0,
        hostDisconnected: false,
        graceCountdown: 0,
      };
    }),
}));
