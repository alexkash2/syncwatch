import { useEffect, useState } from 'react';

/** True when the viewport is phone-width. Single breakpoint per the design (≤760px). */
export function useIsMobile(breakpoint = 760) {
  const query = `(max-width:${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const onChange = () => setIsMobile(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
