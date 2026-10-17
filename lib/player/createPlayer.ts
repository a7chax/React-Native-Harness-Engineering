import { ExpoAudioPlayer } from './ExpoAudioPlayer';
import type { PlayerAdapter } from './PlayerAdapter';

/**
 * Creates the app's player. RNTL tests mock this module to hand the screen a
 * `FakePlayer` they control.
 */
export function createPlayer(): PlayerAdapter {
  return new ExpoAudioPlayer();
}
