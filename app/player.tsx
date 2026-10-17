import { NowPlaying } from '@/components/player/NowPlaying';
import { usePlayerParams } from '@/lib/player/usePlayerParams';

/** `reactnativeuitest://player?track=<id>&at=<ms>&paused=1` (and `stall=<ms>` in development). */
export default function PlayerScreen() {
  const { params, applyKey } = usePlayerParams();
  return <NowPlaying params={params} applyKey={applyKey} />;
}
