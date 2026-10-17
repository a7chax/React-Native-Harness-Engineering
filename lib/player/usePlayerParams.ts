import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';

import { CATALOG, getTrack } from '@/lib/music/catalog';

import { parsePlayerParams, type PlayerParams } from './params';

const OPTIONS = {
  trackIds: CATALOG.map((track) => track.id),
  durationMsFor: (id: string) => getTrack(id)?.durationMs ?? 0,
  isDev: __DEV__,
};

/**
 * Whether a link opens the Now Playing route: `reactnativeuitest://player?...`
 * (the route as the host) or `reactnativeuitest:///player?...` (as the path).
 */
function isPlayerLink(url: string): boolean {
  const { hostname, path } = Linking.parse(url);
  return hostname === 'player' || path?.replace(/\/+$/, '') === 'player';
}

/**
 * The Now Playing route's validated deep-link parameters, plus `applyKey`,
 * which goes up on every incoming link to this route. An identical link leaves
 * the route params unchanged, so the screen keys its apply effect on
 * `applyKey` as well to re-apply it. A link to another route (such as `home`)
 * leaves it alone, even while this screen stays mounted under that route.
 */
export function usePlayerParams(): { params: PlayerParams; applyKey: number } {
  const raw = useLocalSearchParams();
  const [applyKey, setApplyKey] = useState(0);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isPlayerLink(url)) setApplyKey((key) => key + 1);
    });
    return () => subscription.remove();
  }, []);

  return { params: parsePlayerParams(raw, OPTIONS), applyKey };
}
