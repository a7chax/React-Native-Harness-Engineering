/**
 * Jest setup wired into the `jest-expo` preset via `setupFilesAfterEnv`
 * (see `package.json` → `jest.setupFilesAfterEnv`).
 *
 * - Registers `toMatchImageSnapshot` for the visual regression layer of the
 *   harness (see HARNESS_GUIDE.md → "Layer 6: Visual Regression").
 * - Calls Reanimated's `setUpTests()`, which sets the test frame time and adds
 *   the `toHaveAnimatedStyle` / `toHaveAnimatedProps` matchers. Tests that
 *   render Reanimated components run on real timers: `jest.useFakeTimers()`
 *   stops `useFrameCallback` from firing under jest-expo.
 *
 * Add additional matchers / global setup here as the harness grows.
 */

import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { setUpTests } from 'react-native-reanimated';

expect.extend({ toMatchImageSnapshot });

setUpTests();
