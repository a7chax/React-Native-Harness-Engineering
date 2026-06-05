# React Native Testing Harness Engineering Guide

## Overview

This document describes the **harness engineering architecture** for React Native/Expo applications. The harness is a sophisticated orchestration system integrating multiple test layers, device control, flow automation, and result aggregation into a unified testing pipeline.

The end-to-end layer is built on **Appium + WebdriverIO** (UiAutomator2 driver, Mocha framework, TypeScript via `tsx`). Each E2E test captures **one screenshot** (pass or fail), and those screenshots are then **pixel-diffed against committed baselines** by a Jest visual-regression layer. The thesis: a green E2E log is *not* trusted on its own — the screenshot is read **and** diffed against a baseline, so visual regressions still fail the Jest gate.

---

## Table of Contents

1. [Harness Architecture](#harness-architecture)
2. [Design Principles](#design-principles)
3. [System Components](#system-components)
4. [Test Layer Integration](#test-layer-integration)
5. [Execution Pipeline](#execution-pipeline)
6. [Screenshot Strategy](#screenshot-strategy)
7. [Quality Assurance Framework](#quality-assurance-framework)
8. [Implementation Guide](#implementation-guide)
9. [Troubleshooting & Diagnostics](#troubleshooting--diagnostics)

---

## Harness Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEST HARNESS ORCHESTRATOR                    │
│                     (Automated Execution)                       │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ├─────────────────┬──────────────────┬─────────────────┐
           │                 │                  │                 │
      ┌────▼─────┐      ┌───▼──────┐    ┌────▼──────┐    ┌─────▼────┐
      │   JEST   │      │  APPIUM  │    │  PER-TEST │    │  RESULT  │
      │  LAYER   │      │ + WDIO   │    │ SCREENSHOT│    │  TRACKING│
      │          │      │  E2E     │    │  CAPTURE  │    └─────┬────┘
      └────┬─────┘      └───┬──────┘    └────┬──────┘          │
           │                │                │                 │
      ┌────▼─────────┬──────▼───┐       ┌────▼──────┐    ┌─────▼─────┐
      │ Unit + UI    │ Structural│      │ afterTest  │    │  Issue    │
      │ + Visual     │ Snapshots │      │ saves 1 PNG│    │  Tracking │
      │ Regression   │           │      │ per test   │    │           │
      │ ✓ Jest gate  │ ✓ .snap   │      │ (pass/fail)│    │ Metadata, │
      │ ✓ Layer 6    │           │      │            │    │ Screenshot│
      │   pixel diff │           │      │            │    │ Diff PNGs │
      └──────┬───────┴───────────┘      └────┬───────┘    └─────┬─────┘
             │                               │                  │
             │   ┌───────────────────────────┘                  │
             │   │  screenshots feed Layer 6 (jest-image-snapshot)
             ▼   ▼                                               │
      ┌──────────────────┐                                       │
      │ VISUAL REGRESSION│ ── crop status bar → pixelmatch ──────┘
      │  (Jest, 2% diff) │
      └────────┬─────────┘
               │
   ┌───────────▼──────────────┐
   │      TEST COMPLETION      │
   │  Report + Visual Diff     │
   └───────────────────────────┘
```

The E2E flow is: **Appium (WebdriverIO) drives the app → the `afterTest` hook saves one screenshot per test → `jest-image-snapshot` crops the status bar and diffs each screenshot against a committed baseline.** No video, no frame extraction, no external media tooling.

---

## Design Principles

### 1. **Orchestration-First**

The harness coordinates multiple independent testing systems through a unified execution pipeline:

- **Jest** handles unit/UI/snapshot testing
- **Appium + WebdriverIO** drives the real device through end-to-end flows
- **Per-test screenshot capture** records one stable image per test
- **Visual regression (Jest)** diffs those images against committed baselines
- **Result aggregation** combines outputs

Each layer operates independently; the harness sequences them.

### 2. **Sequenced, Deterministic Stages**

E2E and visual regression run as a clean two-stage handoff rather than a racing background recorder:

```
Timeline:
T=0s      ├─ Jest gate (unit + UI + snapshots) must pass
T=5s      ├─ Verify device online (adb devices)
T=6s      ├─ Appium auto-starts (@wdio/appium-service)
T=6-60s   ├─ [WebdriverIO specs] ════════════════════════════
          │   └─ afterTest saves 1 PNG per test → screenshots/
T=60s     ├─ Appium session ends, screenshots on disk
T=61-63s  └─ [Jest visual regression] diff PNGs vs baselines
```

One screenshot per test means one stable visual-regression key — the old "which intermediate frame do we diff" ambiguity is gone.

### 3. **Artifact-Centric**

The harness produces verifiable artifacts:

- **Test Reports**: JSON/text from Jest and the WebdriverIO `spec` reporter
- **Per-test Screenshots**: one PNG per E2E test in `automation_test/screenshots/` (git-ignored, regenerated each run)
- **Visual Baselines**: committed PNGs under `__tests__/visual/__image_snapshots__/`
- **Diff PNGs**: written on visual-regression failure (git-ignored)
- **Metadata**: timestamps, device info, environment

Each baseline is immutable until intentionally updated with `-u`.

### 4. **Fail-Fast with Diagnostics**

Jest failures prevent the Appium run (no point running E2E if unit/UI/snapshot tests fail). The screenshot-capture hook is best-effort: it logs a warning and **never fails the run** if a single screenshot cannot be taken.

---

## System Components

### Jest Test Layer

**Purpose**: Pure logic, component interaction, and structure validation

**Files**:
```
components/ui/
├── AuthScreen.tsx
├── FormTextInput.tsx
├── PrimaryButton.tsx
└── __tests__/
    ├── AuthScreen-test.tsx       ← Unit + UI tests
    ├── FormTextInput-test.tsx
    └── PrimaryButton-test.tsx

app/
├── index.tsx                     ← Login screen
├── home.tsx
├── forgot-password.tsx
├── register.tsx
└── __tests__/
    ├── login-screen-test.tsx
    ├── home-screen-test.tsx
    ├── forgot-password-screen-test.tsx
    ├── register-screen-test.tsx
    └── __snapshots__/*.snap       ← Structural snapshots
```

**Execution**:
```bash
npx jest --watchAll=false
```

**Output**:
- Test results (pass/fail)
- Coverage metrics
- Snapshot diffs
- Error traces

### Appium + WebdriverIO E2E

**Purpose**: Automate real user interactions and validate app behavior on a real device/emulator

**Stack**:
- **Appium 3** server with the **UiAutomator2** driver (Android)
- **WebdriverIO** testrunner (`@wdio/cli`), **Mocha** framework, **`spec`** reporter
- **TypeScript** specs run directly via **`tsx`** (no build step)
- **`@wdio/appium-service`** auto-starts/stops the Appium server from `PATH` — you never launch it manually

**Architecture — Page-Object Model**: raw selector strings never appear in specs. Each screen is a page object (a singleton instance) extending `BaseScreen`; specs depend only on `../screens`, `../helpers/app`, and `../data/testData`.

**Layout** (`automation_test/`):
```
automation_test/
├── data/
│   └── testData.ts        # APP ids, login/registration fixtures, TITLES, MESSAGES
├── helpers/
│   ├── app.ts             # launchAppFresh / restartApp (terminate + activate)
│   ├── gestures.ts        # setField, hideKeyboardIfVisible, scrollIntoView
│   └── selectors.ts       # byTestId / byText / byTextContains / scrollToTestId
├── screens/
│   ├── BaseScreen.ts      # abstract page-object base (root, waitUntilLoaded, el, textOf)
│   ├── LoginScreen.ts     # page objects, each default-exports a singleton instance
│   ├── HomeScreen.ts
│   ├── ForgotPasswordScreen.ts
│   ├── RegisterScreen.ts
│   └── index.ts           # re-exports: loginScreen, homeScreen, ...
├── specs/
│   ├── login.e2e.ts
│   ├── home.e2e.ts
│   ├── forgot-password.e2e.ts
│   └── register.e2e.ts
├── wdio.conf.ts           # capabilities, appium service, mocha opts, afterTest hook
├── tsconfig.json          # @wdio/globals/types + webdriverio types
└── screenshots/           # git-ignored, regenerated each run
```

**Selector mapping** — React Native `testID` → Android `resource-id`: under the UiAutomator2 driver a React Native `testID` maps to the native **`resource-id`** (exact string, no package prefix). All locator logic lives in `automation_test/helpers/selectors.ts`:

- `byTestId(id)` resolves via a `resource-id` `UiSelector` on Android (works for container/`Text` nodes that set only `testID` and for inputs/buttons alike); accessibility-id (`~`) on iOS.
- `byText(text)` / `byTextContains(text)` match visible text via XPath (Android) / predicate string (iOS).
- `scrollToTestId(id)` uses `UiScrollable.scrollIntoView` so off-screen fields (the long Register form) can be brought into view before interaction.

**Execution Model**:
1. Jest gate must already be green.
2. `@wdio/appium-service` starts Appium on `127.0.0.1:4723`.
3. WebdriverIO connects with the Android capabilities (UiAutomator2, `appPackage` `com.anonymous.reactnativeuitest`, `.MainActivity`).
4. Each spec runs its Mocha `describe/it` cases; `beforeEach` does `launchAppFresh()` (terminate + activate) for a clean state.
5. The `afterTest` hook saves one screenshot per test.

### Per-test Screenshot Capture

**Purpose**: Produce exactly one stable image per test as the visual-regression key

**Mechanism** — the `afterTest` hook in `automation_test/wdio.conf.ts`:
```typescript
afterTest: async function (test) {
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const file = path.join(
      SCREENSHOT_DIR,
      `${screenshotName(test.parent, test.title)}.png`,
    );
    await driver.saveScreenshot(file);
  } catch (err) {
    console.warn(`[afterTest] screenshot capture failed: ${(err as Error).message}`);
  }
}
```

**Properties**:
- **One screenshot per test**, taken on both pass and fail.
- **Stable, title-based naming**: `screenshotName(parent, title)` slugifies the full test title (`<describe>-<it>`) into a filesystem-safe, lower-case key. The same test always writes the same filename, which is exactly the baseline key Layer 6 diffs against.
- **Output dir**: `automation_test/screenshots/` by default, overridable via the `APPIUM_SHOT_DIR` env var.
- **Git-ignored & regenerated**: the directory is not committed; it is repopulated on every run. Only the baselines are tracked.
- **Best-effort**: a capture failure logs a warning and never fails the run.

This replaces the older device-recording approach (a background recorder plus media frame extraction). One stable screenshot per test = one stable visual-regression key, with none of the "which intermediate frame" flakiness.

---

## Test Layer Integration

### Layer 1: Unit Testing (Jest)

**Scope**: Pure logic, utilities, hooks

**Example**:
```typescript
describe('cropTopRows', () => {
  it('rejects a negative row count', () => {
    expect(() => cropTopRows(buf, -1)).toThrow();
  });

  it('returns a shorter image when rows > 0', () => {
    const out = PNG.sync.read(cropTopRows(buf, 4));
    expect(out.height).toBe(originalHeight - 4);
  });
});
```

**Coverage**: Logic branches, error paths, edge cases

### Layer 2: UI Testing (React Testing Library)

**Scope**: Component rendering, user interactions

**Example**:
```typescript
describe('Login screen', () => {
  it('shows an inline error on invalid email', () => {
    const { getByTestId } = render(<LoginScreen />);
    fireEvent.changeText(getByTestId('login-email-input'), 'invalid');
    fireEvent.press(getByTestId('login-submit-button'));
    expect(getByTestId('login-email-error')).toBeVisible();
  });
});
```

**Coverage**: Element presence, user interactions, navigation

### Layer 3: Snapshot Testing

**Scope**: Component structure (regression detection)

**Files**: `app/__tests__/__snapshots__/*.snap`

**Purpose**: Catch unintentional UI-tree changes

**Update Strategy**:
```bash
npx jest --updateSnapshot
# Only when intentional changes are made
```

### Layer 4: E2E Testing (Appium + WebdriverIO)

**Scope**: Complete user flows on a real device/emulator

The four specs cover the app's core auth flows:

| Flow            | WDIO spec                      | What it covers                                           |
| --------------- | ------------------------------ | -------------------------------------------------------- |
| Login           | `specs/login.e2e.ts`           | Empty-submit validation errors; valid login → Home       |
| Home            | `specs/home.e2e.ts`            | Welcome text on Home; logout returns to Login            |
| Forgot password | `specs/forgot-password.e2e.ts` | Empty-submit email error; valid email → success message  |
| Register        | `specs/register.e2e.ts`        | Per-field validation (scrolled into view); valid → Home  |

**Page-object example** (`screens/LoginScreen.ts`):
```typescript
import { BaseScreen } from "./BaseScreen";
import { byTestId } from "../helpers/selectors";
import { setField } from "../helpers/gestures";

class LoginScreen extends BaseScreen {
  readonly rootTestId = "login-screen";

  async fillEmail(v: string): Promise<void> {
    await setField(byTestId("login-email-input"), v);
  }
  async fillPassword(v: string): Promise<void> {
    await setField(byTestId("login-password-input"), v);
  }
  async submit(): Promise<void> {
    const button = this.el("login-submit-button");
    await button.waitForDisplayed({ timeout: 15000 });
    await button.click();
  }
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }
  async emailErrorText(): Promise<string> {
    return this.textOf("login-email-error");
  }
}

export default new LoginScreen();
```

**Spec example** (`specs/login.e2e.ts`):
```typescript
import { loginScreen, homeScreen } from "../screens";
import { launchAppFresh } from "../helpers/app";
import { MESSAGES, VALID_LOGIN } from "../data/testData";

describe("Login", () => {
  beforeEach(async () => {
    await launchAppFresh();
    await loginScreen.waitUntilLoaded();
  });

  it("shows inline validation errors when submitting an empty form", async () => {
    await loginScreen.submit();
    expect(await loginScreen.emailErrorText()).toEqual(MESSAGES.login.invalidEmail);
    expect(await loginScreen.passwordErrorText()).toEqual(MESSAGES.login.passwordRequired);
  });

  it("navigates to Home with valid credentials", async () => {
    await loginScreen.login(VALID_LOGIN.email, VALID_LOGIN.password);
    await homeScreen.waitUntilLoaded();
    await expect(homeScreen.root).toBeDisplayed();
  });
});
```

**Coverage**: End-to-end workflows, navigation, system integration

### Layer 5: Per-test Screenshot Capture

**Scope**: One stable image per E2E test (visual verification, debugging, and the Layer 6 input)

**Captured**: the final rendered screen state of each test, on both pass and fail.

**Where**:
- `automation_test/screenshots/<test-title-slug>.png` (git-ignored, regenerated each run; override dir via `APPIUM_SHOT_DIR`).

**Usage**:
- Manual review of what the app actually showed at the end of each test
- Debugging unexpected behavior (failed tests still produce a screenshot)
- The committed-baseline input for Layer 6 visual regression

Because the filename is derived from the test title, the mapping from test → screenshot → baseline is one-to-one and stable across runs.

### Layer 6: Visual Regression (jest-image-snapshot)

**Scope**: Pixel-level regression detection on the per-test Appium screenshots

**Why this layer exists**: Layers 1–3 catch logic / element / component-tree regressions. Layers 4–5 prove end-to-end behavior and capture a screenshot. None of them catch *visual* regressions — a button drifting 4px, a colour-token swap, a missing icon — because WebdriverIO asserts on `resource-id` / text, not on pixels. Layer 6 closes that gap by diffing each screenshot against a committed PNG baseline, gated by the same Jest gate as Layers 1–3.

**Library**: [`jest-image-snapshot`](https://github.com/americanexpress/jest-image-snapshot) (actively maintained, pure-JS pixel diff via `pixelmatch`). Chosen over `react-native-owl` because it (a) extends the existing `jest-expo` preset rather than replacing it, (b) consumes the screenshots Layer 5 already produces instead of spinning up its own device driver, (c) doesn't contend with the device for the Appium session, and (d) works with the managed Expo workflow with no `prebuild`.

**Files**:
```
__tests__/visual/
├── image-snapshot-matcher-test.ts       ← wiring smoke test
├── frameUtils-test.ts                    ← unit tests for cropTopRows
├── appium-screenshots-test.ts            ← diffs Appium screenshots vs baselines
└── __image_snapshots__/
    ├── harness-fixture-red-16.png        ← matcher contract baseline
    └── appium-<test-title>.png           ← per-test baselines

lib/visual/
└── frameUtils.ts                         ← cropTopRows + status-bar constants

jest.setup.ts                             ← registers toMatchImageSnapshot
```

**Input**:
- `automation_test/screenshots/*.png` — produced by the `afterTest` hook (Layer 5).

**Output**:
- **Pass**: silent — baseline matched within tolerance.
- **Fail**: Jest assertion failure + diff PNG written to `__tests__/visual/__image_snapshots__/__diff_output__/<id>-diff.png` (git-ignored; upload alongside the screenshot to the issue tracker).

**Tolerance**: `failureThreshold: 0.02`, `failureThresholdType: 'percent'` — up to 2% of pixels may differ to absorb emulator font hinting / sub-pixel drift between runs. Tune per screenshot if needed.

**Status-bar masking**: Before diffing, each screenshot is fed through `cropTopRows(buf, statusBarPxFor(slug))` (default `ANDROID_STATUS_BAR_PX_DEFAULT = 75`, overridable per screenshot in `appium-screenshots-test.ts` via `STATUS_BAR_PX_BY_SHOT`). This strips the Android status bar — clock, battery, signal — which otherwise drifts every run and produces 100% false-positive diffs. The crop is applied to the new screenshot, and the baseline is itself a cropped image, so the regression contract is over the masked body only. Smoke tests cover both directions: a status-bar-only change is invisible (masked away) while a body-region change is detected.

**Discipline**: Because there is exactly one screenshot per test (the final state), there is no "which frame" ambiguity — the per-test image *is* the diff key. Keep tests deterministic (`launchAppFresh` per test) so the captured screen is stable run-to-run.

**Update strategy** (same rule as Layer 3 structural snapshots):
```bash
npx jest __tests__/visual/appium-screenshots-test.ts -u
# Only after reviewing the diff PNG and confirming the visual change is intentional.
```

**Fresh-checkout behavior**: When no screenshots have been captured yet, `appium-screenshots-test.ts` reports as a single skipped suite so CI stays green on PRs that don't run the device harness. Run `npm run test:appium` first to populate screenshots, then this suite engages.

---

## Execution Pipeline

### Full Harness Execution Flow

```
START
  │
  ├─► [UNIT TESTS] (Jest - 1-2s)
  │   ├─ Run all unit tests
  │   ├─ Run all UI tests
  │   ├─ Validate snapshots
  │   └─ Report results
  │
  ├─► JEST PASS?
  │   ├─ NO → EXIT (Fail-fast)
  │   └─ YES ↓
  │
  ├─► [DEVICE CHECK] (5s)
  │   ├─ adb devices → list
  │   └─ Verify "device" status
  │
  ├─► DEVICE READY?
  │   ├─ NO → EXIT (Manual intervention)
  │   └─ YES ↓
  │
  ├─► [RUN APPIUM SUITE] (20-55s)
  │   ├─ @wdio/appium-service auto-starts Appium (127.0.0.1:4723)
  │   ├─ wdio run automation_test/wdio.conf.ts
  │   ├─ Mocha specs drive the app via page objects
  │   └─ afterTest saves 1 screenshot per test → screenshots/
  │
  ├─► [VISUAL REGRESSION] (Jest - 1-2s)
  │   ├─ npx jest __tests__/visual/appium-screenshots-test.ts
  │   ├─ cropTopRows() masks the Android status bar
  │   ├─ Diff each screenshot vs committed baseline (2% threshold)
  │   └─ Write *-diff.png on failure (git-ignored)
  │
  ├─► [RESULT AGGREGATION] (2s)
  │   ├─ Parse Jest output
  │   ├─ Verify screenshots exist
  │   ├─ Check WDIO spec-reporter results
  │   └─ Combine metadata
  │
  ├─► [ISSUE CREATION] (Optional - 3s)
  │   ├─ Create/update issue
  │   ├─ Document results
  │   └─ Attach screenshot(s) + diff PNG(s)
  │
  └─► END (Total: 35-70s)
```

### Timing Analysis

| Phase | Duration | Notes |
|-------|----------|-------|
| Jest (unit + UI + snapshots) | 1-2s | Gate — must pass first |
| Device check | ~1s | `adb devices` |
| Appium auto-start | ~3s | `@wdio/appium-service` |
| Appium suite (4 specs) | 20-55s | Per-test screenshot via `afterTest` |
| Visual regression (Jest) | 1-2s | Crop + pixel diff vs baselines |
| Result aggregation | 2s | Parse + combine metadata |
| **Total** | **~30-65s** | Two clean stages, no media post-processing |

The pipeline is a deterministic two-stage handoff (drive → diff) rather than a racing recorder; there is no separate stop/pull/extract phase, so there is less to go wrong and nothing to clean up off-device.

---

## Screenshot Strategy

### One Screenshot Per Test

The harness captures exactly **one screenshot per E2E test**, on both pass and fail, in the `afterTest` hook. This is the unit of visual evidence:

- It is the screen state at the end of the test — the moment that matters for verifying the assertion.
- It is taken even on failure, so a red test still leaves an inspectable image.
- It is the single, unambiguous input to Layer 6 (no "which frame" decision).

### Stable, Title-Based Naming

`screenshotName(test.parent, test.title)` slugifies the full test title (`<describe>-<it>`) into a filesystem-safe, lower-case key:

```
"Login" + "navigates to Home with valid credentials"
  → login-navigates-to-home-with-valid-credentials.png
```

The same test always writes the same filename, and the Layer 6 baseline key is `appium-<that-slug>.png`. The mapping test → screenshot → baseline is therefore one-to-one and stable.

### Status-Bar Crop Before Diff

Raw Android screenshots include the status bar (clock, battery, signal), which drifts every run. Before any diff, `cropTopRows(buf, ANDROID_STATUS_BAR_PX_DEFAULT)` (default 75px) removes the top rows. Crop (not blackout) is chosen because it shrinks the diff surface, keeps baselines smaller, and makes "did the mask take effect" obvious from baseline image dimensions.

### Where Files Go

```
automation_test/screenshots/                       ← git-ignored, regenerated each run
  login-navigates-to-home-with-valid-credentials.png
  home-logout-returns-to-login.png
  ...

__tests__/visual/__image_snapshots__/              ← committed baselines
  appium-login-navigates-to-home-with-valid-credentials.png
  ...
  __diff_output__/                                  ← git-ignored, only on failure
    appium-...-diff.png
```

### Git-Ignored & Regenerated vs Committed Baselines

- **Screenshots** (`automation_test/screenshots/`) are git-ignored and regenerated on every run. Never committed.
- **Diff output** (`__diff_output__/`) is git-ignored; it appears only when a diff fails.
- **Baselines** (`__tests__/visual/__image_snapshots__/appium-*.png`) **are** committed. They are the source of truth and change only via an intentional `-u` update after the diff PNG has been reviewed.
- Override the screenshot output directory (e.g. in CI) with `APPIUM_SHOT_DIR`.

---

## Quality Assurance Framework

### Test Coverage Layers

```
┌──────────────────────────────────────┐
│  COMPONENT REQUIREMENTS              │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐   │
│  │ 1. UNIT TESTS (Logic)        │   │
│  │ • Pure functions             │   │
│  │ • Hooks & state              │   │
│  │ • Validators, formatters     │   │
│  └──────────────────────────────┘   │
│           ↓                          │
│  ┌──────────────────────────────┐   │
│  │ 2. UI TESTS (Interactions)   │   │
│  │ • Rendering                  │   │
│  │ • User actions               │   │
│  │ • Navigation                 │   │
│  └──────────────────────────────┘   │
│           ↓                          │
│  ┌──────────────────────────────┐   │
│  │ 3. SNAPSHOTS (Structure)     │   │
│  │ • Component tree             │   │
│  │ • Props & styling            │   │
│  │ • Regression detection       │   │
│  └──────────────────────────────┘   │
│           ↓                          │
│  ┌──────────────────────────────┐   │
│  │ 4. E2E TESTS (Appium+WDIO)   │   │
│  │ • Complete user journeys     │   │
│  │ • Cross-component flows      │   │
│  │ • System integration         │   │
│  └──────────────────────────────┘   │
│           ↓                          │
│  ┌──────────────────────────────┐   │
│  │ 5. SCREENSHOT CAPTURE        │   │
│  │ • 1 PNG per test (pass/fail) │   │
│  │ • Stable title-based naming  │   │
│  │ • Visual evidence + Layer-6  │   │
│  │   input                      │   │
│  └──────────────────────────────┘   │
│           ↓                          │
│  ┌──────────────────────────────┐   │
│  │ 6. VISUAL REGRESSION         │   │
│  │ • Status-bar crop            │   │
│  │ • Pixel diff vs baseline     │   │
│  │ • Fails the Jest gate        │   │
│  └──────────────────────────────┘   │
│                                      │
└──────────────────────────────────────┘
```

### Quality Gates

**Gate 1: Unit/UI/Snapshot Tests**
```
Condition: All unit/UI/snapshot tests pass
Failure: Stop, report errors
Success: Continue to device check
```

**Gate 2: Device Connection**
```
Condition: `adb devices` shows at least one online device
Failure: Stop, user must connect device/emulator
Success: Continue to Appium E2E
```

**Gate 3: Screenshot Capture**
```
Condition: afterTest writes a PNG per test
Failure: Logged warning only — never fails the run (data loss only)
Success: Screenshots available for Layer 6
```

**Gate 4: Visual Regression**
```
Condition: Each screenshot matches its baseline within 2% pixel tolerance
Failure: Jest assertion fails; diff PNG written for review
Success: No visual regression — proceed to result aggregation
```

### Metrics & Reporting

**Test Results**:
- Total tests run (Jest + WebdriverIO)
- Passed / Failed count
- Pass rate (%)
- Execution time

**Coverage**:
- Unit test coverage (%)
- Component test coverage (%)
- E2E flow coverage (4 flows: login, home, forgot-password, register)

**Visual Regression**:
- Screenshots captured (count)
- Baselines matched / failed
- Pixel-diff percentage per failing screenshot
- Status-bar crop applied (px)

---

## Implementation Guide

### Setup

#### 1. Install Node Dependencies

```bash
npm install
```

This pulls the E2E stack: `webdriverio`, `@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`, `@wdio/appium-service`, `@wdio/spec-reporter`, and `tsx`.

#### 2. Install Appium + the UiAutomator2 Driver

```bash
# Install Appium 3 globally
npm i -g appium

# Install the Android driver
appium driver install uiautomator2

# Verify
appium --version
appium driver list --installed
```

You do **not** start Appium manually — `@wdio/appium-service` auto-starts it from `PATH` when the run begins.

#### 3. Setup Device/Emulator

```bash
# Start the emulator (AVD Pixel_9a already exists)
emulator -avd Pixel_9a &

# Or connect a physical device via USB

# Verify
adb devices
# Output should show: device | emulator-5554
```

#### 4. Build & Install the App

This is a **managed Expo project** with no committed `android/` folder, so the native app must be prebuilt before it can be installed:

```bash
# From the repo ROOT — generates native code, builds, installs, and launches:
npx expo run:android
```

This installs `com.anonymous.reactnativeuitest` on the running device. Alternatively, set `APP_PATH` to an `.apk` and the runner will install it for you.

### Running Tests

#### Full Harness (Recommended)

```bash
# 1) Jest gate (unit + UI + snapshots)
npx jest --watchAll=false

# 2) Appium E2E — captures one screenshot per test
npm run test:appium        # = wdio run automation_test/wdio.conf.ts

# 3) Visual regression — diff screenshots vs baselines
npx jest __tests__/visual/appium-screenshots-test.ts
```

#### Individual Layers

**Unit / UI / Snapshots**:
```bash
npx jest --watchAll=false
```

**A single test file**:
```bash
npx jest app/__tests__/login-screen-test.tsx --watchAll=false
```

**With Coverage**:
```bash
npx jest --coverage --watchAll=false
```

**Update Structural Snapshots**:
```bash
npx jest --updateSnapshot
```

**Appium E2E Only**:
```bash
npm run test:appium
# or directly:
npx wdio run automation_test/wdio.conf.ts
```

**Override device / app / screenshot dir** (all optional, sensible defaults):
```bash
APP_PATH=/abs/path/to/app.apk DEVICE_NAME=Pixel_9a \
  npx wdio run automation_test/wdio.conf.ts

APPIUM_SHOT_DIR=/tmp/shots npm run test:appium
```

**Update Visual Baselines** (after reviewing the diff PNG):
```bash
npx jest __tests__/visual/appium-screenshots-test.ts -u
```

### Typecheck

The root `tsconfig.json` **excludes** `automation_test/` (the Appium suite has its own `tsconfig.json` with the WebdriverIO/Mocha globals), so there are two typecheck commands:

```bash
# App + Jest layers:
npx tsc --noEmit

# Appium suite (WDIO globals):
npx tsc -p automation_test/tsconfig.json --noEmit
```

Both are green.

---

## Troubleshooting & Diagnostics

### Issue: Appium Session Won't Start

**Symptom**: WebdriverIO errors connecting to `127.0.0.1:4723`, "could not find a driver", or the session never initializes.

**Diagnosis**:
```bash
# Is the driver installed?
appium driver list --installed   # expect uiautomator2

# Is the Appium binary on PATH? (@wdio/appium-service needs it)
which appium
appium --version

# Is anything already bound to 4723?
adb devices                       # device must be online first
```

**Solution**:
- Install the driver: `appium driver install uiautomator2`.
- Make sure `appium` is on `PATH` so `@wdio/appium-service` can launch it.
- Ensure a device/emulator is **online** before the run (see next issue).

### Issue: `adb devices` Is Empty

**Symptom**: `adb devices` shows no devices, or a device stuck in `offline`/`unauthorized`.

**Diagnosis**:
```bash
adb kill-server
adb start-server
adb devices
adb emu avd name        # confirm an emulator is up
```

**Solution**:
- Start the emulator: `emulator -avd Pixel_9a`.
- Connect a physical device via USB and enable USB debugging.
- For `unauthorized`, accept the RSA prompt on the device.
- Re-run: `adb kill-server && adb devices`.

### Issue: App Not Installed

**Symptom**: Appium fails to activate `com.anonymous.reactnativeuitest`, or the launch activity is not found.

**Diagnosis**:
```bash
# Is the package installed?
adb shell pm list packages | grep reactnativeuitest
```

**Solution**:
- This is a managed Expo project (no committed `android/`). Build and install with:
  ```bash
  npx expo run:android
  ```
- Or pass a prebuilt APK via `APP_PATH=/abs/path/to/app.apk` so Appium installs it before the run.

### Issue: Element Not Found

**Symptom**: A page-object call times out waiting for an element (`waitForDisplayed` / "element not found").

**Diagnosis**:
```bash
# Confirm the app is foregrounded
adb shell dumpsys activity activities | grep -i resumed

# Device logs
adb logcat | grep -i reactnativeuitest
```

**Solution**:
- Verify the `testID` exists in the component and matches the page object (e.g. `login-email-input`, `login-submit-button`). On Android the `testID` becomes the native `resource-id`.
- For an off-screen field (the long Register form), use the page object's scroll helper — `scrollIntoView(testId)` / `scrollToTestId(id)` resolves a `UiScrollable.scrollIntoView` selector — before interacting.
- Increase the per-element timeout in the page object (`waitForDisplayed({ timeout: ... })`) if the screen is slow to render.
- Rebuild/reinstall the app if the component changed: `npx expo run:android`.

### Issue: Screenshot Capture Fails

**Symptom**: `[afterTest] screenshot capture failed: ...` in the run log, or a screenshot is missing.

**Diagnosis & behavior**:
- The `afterTest` hook is wrapped in try/catch — it **logs a warning and never fails the run**. A missing screenshot only means that test won't be diffed by Layer 6 this run.
```bash
# Confirm the output dir and check what was written
ls automation_test/screenshots/
echo "$APPIUM_SHOT_DIR"     # if you overrode the location
```

**Solution**:
- Ensure the session is still alive when `afterTest` runs (a crashed/closed driver can't screenshot).
- Confirm the process can write to `automation_test/screenshots/` (or your `APPIUM_SHOT_DIR`).
- Re-run the suite; screenshots are regenerated every run.

### Issue: Visual Regression Fails

**Symptom**: `npx jest __tests__/visual/appium-screenshots-test.ts` reports a `toMatchImageSnapshot` failure.

**Diagnosis**:
```bash
# Inspect the generated diff
ls __tests__/visual/__image_snapshots__/__diff_output__/
```

**Solution**:
- Open the `*-diff.png` and decide: real regression vs intended change.
- If the change is intentional, update the baseline: `npx jest __tests__/visual/appium-screenshots-test.ts -u`.
- If a different emulator profile changed the status-bar height, add a per-screenshot override in `STATUS_BAR_PX_BY_SHOT` in `appium-screenshots-test.ts`.
- If no screenshots exist yet, the suite skips — run `npm run test:appium` first.

### Issue: Jest Tests Fail

**Symptom**: Red test output, errors shown.

**Diagnosis**:
```bash
npx jest --verbose --watchAll=false
npx jest app/__tests__/login-screen-test.tsx --watchAll=false
```

**Solution**:
- Read the error carefully.
- Update structural snapshots if intentional: `npx jest -u`.
- Mock external dependencies if needed.
- Check `testID` values match the component.

### Diagnostic Commands

```bash
# Full device info
adb shell getprop ro.build.version.release
adb shell getprop ro.product.model

# App info
adb shell pm list packages | grep reactnativeuitest

# Memory/CPU
adb shell top -n 1 | head -20

# Foreground activity
adb shell dumpsys activity activities | grep -i resumed

# Jest execution logs
npx jest --watchAll=false 2>&1 | tee test-log.txt

# Appium suite logs
npm run test:appium 2>&1 | tee appium-log.txt
```

---

## Best Practices

### Writing Testable Components

1. **Use testID for assertions**
   ```typescript
   <TextInput testID="login-email-input" />
   ```
   The same `testID` is the native `resource-id` Appium locates on Android.

2. **Avoid implementation details**
   ```typescript
   // Good
   fireEvent.changeText(getByTestId('login-email-input'), 'test@example.com');

   // Bad
   fireEvent.changeText(getByDisplayValue('old@example.com'), 'test@example.com');
   ```

3. **Clear error states with their own testID**
   ```typescript
   {showError && <Text testID="login-email-error">Enter a valid email address</Text>}
   ```

### Writing Reliable Tests

1. **Wait for elements (RNTL)**
   ```typescript
   await waitFor(() => {
     expect(getByTestId('login-email-error')).toBeVisible();
   });
   ```

2. **Mock external APIs**
   ```typescript
   jest.mock('@react-native-async-storage/async-storage', () => ({
     getItem: jest.fn().mockResolvedValue(null),
   }));
   ```

3. **Reset app state per E2E test**
   ```typescript
   beforeEach(async () => {
     await launchAppFresh();          // terminate + activate → clean state
     await loginScreen.waitUntilLoaded();
   });
   ```

### Screenshots & Visual Analysis

1. **Review failing-test screenshots**
   - Every test (pass or fail) leaves a PNG in `automation_test/screenshots/`.
   - On a failure, read that image to see exactly what the app showed.

2. **Review diff PNGs before updating baselines**
   - A visual-regression failure writes `__diff_output__/<id>-diff.png`.
   - Only run `-u` after confirming the change is intentional.

3. **Attach evidence to the tracker**
   ```
   Test: Login → navigates to Home with valid credentials
   - Device: Pixel_9a (emulator)
   - E2E: PASS
   - Screenshot: login-navigates-to-home-with-valid-credentials.png
   - Visual regression: baseline matched (0.0% diff)
   ```

---

## Architecture Decisions

### Why Per-test Screenshots Over Video Recording?

**Video recording + frame extraction** (the previous approach):
- Required a background recorder racing the test, then a media-extraction step.
- Forced a "which intermediate frame do we diff?" decision — frames drift in timing run-to-run, producing flaky diffs even on a stable build.
- Added an external media dependency and off-device cleanup.

**Per-test screenshot capture** (current):
- One deterministic image per test, taken at the end state that matters.
- A stable, title-based filename = a stable visual-regression key (no frame ambiguity).
- No external media tooling, no background process, nothing to pull/clean off-device.

### Why Multiple Test Layers?

- **Unit**: Fast feedback (broken logic)
- **UI**: Integration check (broken rendering)
- **Snapshots**: Regression detection (broken structure)
- **E2E (Appium)**: System validation (broken workflows)
- **Screenshot**: Visual evidence (what the device actually showed)
- **Visual regression**: Pixel-level proof (drift the E2E asserts can't see)

Each layer catches a different class of bug.

### Why Appium + WebdriverIO + the Page-Object Model?

- **Appium / UiAutomator2**: drives the real Android runtime, mapping React Native `testID` → native `resource-id`.
- **WebdriverIO + Mocha + tsx**: TypeScript specs with no build step; the `spec` reporter gives readable output.
- **Page objects**: raw selectors live in `helpers/selectors.ts` and screens; specs read like prose and survive UI refactors.
- **`@wdio/appium-service`**: zero-touch server lifecycle — no manual Appium process to babysit.

---

## Extensibility

### Adding a New E2E Flow

1. Add a page object in `automation_test/screens/`:
   ```typescript
   import { BaseScreen } from "./BaseScreen";
   class CheckoutScreen extends BaseScreen {
     readonly rootTestId = "checkout-screen";
     async addToCart(): Promise<void> {
       const btn = this.el("add-to-cart");
       await btn.waitForDisplayed({ timeout: 15000 });
       await btn.click();
     }
   }
   export default new CheckoutScreen();
   ```
2. Re-export it from `screens/index.ts`.
3. Add a spec `automation_test/specs/checkout.e2e.ts` that depends only on `../screens`, `../helpers/app`, `../data/testData`.
4. Run `npm run test:appium` — the `afterTest` hook captures a screenshot per new test.
5. Run `npx jest __tests__/visual/appium-screenshots-test.ts -u` once to commit the new baselines.

### Adding Coverage Reports

```bash
npx jest --coverage --watchAll=false
open coverage/lcov-report/index.html
```

### Custom Result Aggregation

```bash
npx jest --json > test-results.json
node scripts/aggregate-results.js test-results.json
```

---

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Appium](https://appium.io/docs/en/latest/)
- [Appium UiAutomator2 Driver](https://github.com/appium/appium-uiautomator2-driver)
- [WebdriverIO](https://webdriver.io/)
- [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot)
- [ADB Documentation](https://developer.android.com/tools/adb)
- [Expo CLI](https://docs.expo.dev/more/expo-cli/)

---

**Document Version**: 2.0
**Last Updated**: 2026-05-31
**Audience**: Engineering teams implementing React Native harness engineering

---

## Harness Engineering for Agentic AI Systems

### The Agentic AI Context

Modern software development increasingly involves **agentic AI systems** (Claude, GPT, specialized coding agents) that generate, modify, and refactor code autonomously. In this paradigm, harness engineering shifts from being merely a quality assurance tool to becoming a **core infrastructure requirement**.

### Why Harness Engineering is Critical for AI-Generated Code

#### 1. **Verification Without Human Review**

AI agents generate code at machine speed, but code correctness is not guaranteed:

```
Traditional: Code → Human Review → Test → Deploy
AI-Assisted: Code → Harness Verification → Agent Feedback → Iterate
```

The harness provides **automated verification** that agents can trust and iterate from.

#### 2. **Deterministic Feedback Loop**

Agents learn through feedback. A well-designed harness provides clear signals:

```
Agent generates code
    ↓
Harness runs: Unit → UI → Snapshots → Appium E2E → Screenshot → Visual Diff
    ↓
Result: ✅ PASS or ❌ FAIL with exact error (+ diff PNG)
    ↓
Agent analyzes failure and refines code
    ↓
(Repeat until PASS)
```

Without structured harnesses, agents lack the feedback precision needed for safe iteration.

#### 3. **Safety Through Layered Testing**

Multiple test layers catch different bug classes:

| Layer | Catches | Agent Trust Level |
|-------|---------|---|
| Unit Tests | Logic errors | ⭐⭐⭐⭐⭐ |
| UI Tests | Integration bugs | ⭐⭐⭐⭐⭐ |
| Snapshots | Structural regressions | ⭐⭐⭐⭐ |
| Appium E2E | Complete flow failures | ⭐⭐⭐⭐⭐ |
| Screenshot Capture | Visual evidence | ⭐⭐⭐⭐ |
| Visual Regression | Pixel-level drift | ⭐⭐⭐⭐⭐ |

All layers → agent can confidently iterate.

#### 4. **Reproducibility & Trust**

Screenshots and pixel diffs prove actual behavior (not theoretical):

```
Test Output:
  ✅ Unit: passed
  ✅ UI: all assertions passed
  ✅ Snapshot: no changes
  ✅ Appium E2E: 4 flows completed successfully
  ✅ Screenshots: 1 PNG per test captured
  ✅ Visual regression: all baselines matched (≤2% diff)
```

Agent sees: "I can trust this code works. The device actually ran it *and the pixels match*."

#### 5. **Speed at Scale**

Harness engineering enables rapid iteration:

- **Without harness**: Agent generates code → human reviews → human tests → 2-4 hours per cycle
- **With harness**: Agent generates code → automated harness → agent reviews results → 5-10 minutes per cycle

The speed difference compounds: 10 iterations = 20-40 hours vs 50-100 minutes.

### Harness Engineering Philosophy for AI

#### Core Principle: "Test Everything, Trust Nothing"

When code is AI-generated:
1. Don't trust the logic (test it)
2. Don't trust the UI (render it, then screenshot it)
3. Don't trust the flow (automate it with Appium)
4. Don't trust a green log (diff the pixels against a baseline)
5. Don't skip layers (all six matter)

#### Implementation Pattern

```python
# AI Agent workflow
while not done:
    code = agent.generate(requirements)
    result = harness.run(code)  # ← Critical

    if result.all_pass:
        done = True
    else:
        agent.refine(code, result.failures)
```

#### What Makes a Good Harness for AI?

1. **Fast**: Roughly a minute per run (agents iterate quickly)
2. **Reliable**: Same code = same results (deterministic — one screenshot per test, no frame lottery)
3. **Clear**: Pass/fail signals + diff PNGs (agents understand errors)
4. **Comprehensive**: All layers (catches diverse bugs)
5. **Traceable**: Screenshots + logs (agents learn from history)

This project's harness satisfies all five criteria.

### Real-World Example: Login Screen

```
Iteration 1:
  Agent: "Add email validation to the login screen"
  Harness: ❌ FAIL - Unit test fails (regex invalid)
  Agent: "Fix regex pattern"

Iteration 2:
  Harness: ❌ FAIL - Visual regression (error text shifted layout 6px)
  Agent: "Reserve space for the error row"

Iteration 3:
  Harness: ✅ PASS - All layers pass, baselines match
  Agent: "Component is ready"

Result: Correct code in 3 iterations (~15 minutes)
Without harness: Would require human testing (30+ minutes)
```

### Reference & Further Reading

**OpenAI's Harness Engineering Blog**:
- URL: https://openai.com/index/harness-engineering/
- Key Takeaway: "Harness engineering is the infrastructure that makes agentic systems reliable and scalable"

**Key Concepts**:
1. Testing infrastructure = Code infrastructure (equal importance)
2. Agentic systems need deterministic feedback loops
3. Multiple test layers catch different bug classes
4. Screenshots + pixel diffs provide ground truth
5. Fast iteration requires automated verification

---

## Screenshot Inspection & Failure Diagnosis

A green WebdriverIO log is **not** sufficient evidence. The per-test screenshot is the source of truth, and it is both **read** (by a human or agent) and **diffed** against a committed baseline by Layer 6.

### Where the screenshots are

Each test writes one PNG, named by its full title, into `automation_test/screenshots/` (override with `APPIUM_SHOT_DIR`). They are git-ignored and regenerated every run:

```bash
ls automation_test/screenshots/
# login-shows-inline-validation-errors-when-submitting-an-empty-form.png
# login-navigates-to-home-with-valid-credentials.png
# ...
```

Read the image for the failing (or suspicious) test to confirm: validation errors with exact text, success/empty states, the correct screen, and **no redbox or ANR dialog**.

### When a flow fails

1. **Locate the failing test** in the `spec`-reporter output (the failing `it` and its error/stack).
2. **Open that test's screenshot** in `automation_test/screenshots/` to see the actual screen at the end of the test.
3. **Check the WebdriverIO/Appium log** for the failing command (selector, timeout) and the device `logcat`.
4. **Fix, re-run, re-inspect.** Treat any run with a redbox/ANR in the screenshot as failed even if WebdriverIO exited 0.

### Failure patterns & fixes (observed in this repo)

| Symptom in screenshot / log | Root cause | Fix |
|-----------------------------|-----------|-----|
| `element not found` on a lower field | UiAutomator2 does not auto-scroll; the field is off-screen / behind the keyboard | `scrollIntoView(testId)` (via `scrollToTestId`) before tapping the field; `hideKeyboardIfVisible()` after typing |
| Stale screen between tests | Previous test left app state behind | `launchAppFresh()` (terminate + activate) in `beforeEach` |
| Visual diff fails on the top rows only | Android status bar (clock/battery) drifted | Status bar is cropped by `cropTopRows`; if a different emulator changed its height, add an entry to `STATUS_BAR_PX_BY_SHOT` |
| Session never starts | `uiautomator2` driver missing, or device offline | `appium driver install uiautomator2`; ensure `adb devices` shows an online device |

### Reliability checklist for a clean run

- Jest + both `tsc` projects green first (don't run E2E on broken code).
- Device/emulator online (`adb devices`) and the app installed (`npx expo run:android`).
- `launchAppFresh()` in `beforeEach` for deterministic state.
- `scrollIntoView` before lower fields/asserts; `hideKeyboardIfVisible` after typing.
- One screenshot per test → one baseline; review the diff PNG before any `-u`.
- Each flow's screenshot is attached to its tracker issue with the result summary.

---

## Conclusion

Harness engineering for React Native is not just a testing practice—it's an **enabling technology for AI-assisted development**. By providing structured, automated verification with per-test screenshots and pixel-level baselines, this harness allows agentic AI systems to safely generate, test, and refine mobile application code.

The combination of:
- **Jest** (fast unit/UI/snapshot feedback)
- **Appium + WebdriverIO** (real-device flow validation via a page-object model)
- **Per-test screenshot capture** (one stable image per test)
- **Visual regression (jest-image-snapshot)** (pixel proof the E2E asserts can't see)
- **Orchestration** (a clean drive → diff handoff)

...creates a harness that agentic systems can trust and iterate from confidently. A green log alone is never enough: the screenshot is read **and** diffed against a baseline, so visual regressions still fail the Jest gate.
