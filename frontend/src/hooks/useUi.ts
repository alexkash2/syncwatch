import { useContext } from 'react';
import { UiContext } from '../contexts/UiContext';

export function useUi() {
  return useContext(UiContext);
}
