import { useCallback, useEffect, useState, type RefObject } from 'react';

interface FullscreenCapableElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}
interface FullscreenCapableDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

function isIPhone() {
  return typeof navigator !== 'undefined' && /iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Device-aware fullscreen for the player column.
 *
 * - Desktop / Android / iPad / macOS Safari → real Fullscreen API on the target
 *   element (with the `webkit` prefix fallback), so our custom controls render
 *   on top of the video.
 * - iPhone Safari → the Fullscreen API is unavailable on a non-`<video>`
 *   element, so we fall back to CSS pseudo-fullscreen (a fixed, 100dvh overlay).
 *   This keeps our own controls and the sync path intact instead of opening
 *   iOS's native player, which would bypass our handlers and desync viewers.
 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [pseudo, setPseudo] = useState(false);
  const [real, setReal] = useState(false);

  useEffect(() => {
    const sync = () => {
      const el = targetRef.current;
      const doc = document as FullscreenCapableDocument;
      const fsEl = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setReal(Boolean(el && fsEl && (fsEl === el || fsEl.contains(el))));
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [targetRef]);

  // Escape exits CSS pseudo-fullscreen (the browser handles it for real FS).
  useEffect(() => {
    if (!pseudo) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPseudo(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pseudo]);

  const toggle = useCallback(() => {
    const el = targetRef.current as FullscreenCapableElement | null;
    if (!el) {
      return;
    }
    const doc = document as FullscreenCapableDocument;
    const canRealFs =
      typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';

    if (isIPhone() || !canRealFs) {
      setPseudo((value) => !value);
      return;
    }

    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } else {
      void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    }
  }, [targetRef]);

  // Force-exit both pseudo and real fullscreen. Called when the fullscreen
  // surface is about to disappear (e.g. the file is cleared) so an iPhone user
  // isn't stranded in a fixed black overlay with no Escape key.
  const exit = useCallback(() => {
    setPseudo(false);
    const doc = document as FullscreenCapableDocument;
    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    }
  }, []);

  return { isFullscreen: pseudo || real, isPseudo: pseudo, toggle, exit };
}
