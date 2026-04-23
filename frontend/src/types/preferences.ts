export interface AppPreferences {
  reduceMotion: boolean;
  showHotkeys: boolean;
  compactSidebar: boolean;
  confirmViewerLeave: boolean;
  showRoomOnboarding: boolean;
}

export const defaultAppPreferences: AppPreferences = {
  reduceMotion: false,
  showHotkeys: true,
  compactSidebar: false,
  confirmViewerLeave: false,
  showRoomOnboarding: true,
};

export const APP_PREFERENCES_STORAGE_KEY = 'syncwatch.preferences';
