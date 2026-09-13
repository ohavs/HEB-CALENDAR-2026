import { useEffect, useState } from 'react';

/** האם שאילתת המדיה מתקיימת כרגע. מתעדכן בשינוי גודל המסך. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** מסך רחב - פריסת שתי עמודות במקום חלונית נגררת. */
export const useIsDesktop = (): boolean => useMediaQuery('(min-width: 1024px)');
