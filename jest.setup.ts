/**
 * Jest setup wired into the `jest-expo` preset via `setupFilesAfterEnv`
 * (see `package.json` → `jest.setupFilesAfterEnv`).
 *
 * Currently registers `toMatchImageSnapshot` for the visual regression
 * layer of the harness (see HARNESS_GUIDE.md → "Layer 6: Visual Regression").
 * Add additional matchers / global setup here as the harness grows.
 */

import { toMatchImageSnapshot } from 'jest-image-snapshot';

expect.extend({ toMatchImageSnapshot });
