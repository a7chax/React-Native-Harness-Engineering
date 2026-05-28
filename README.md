# React Native Harness Engineering

A harness-engineering setup for React Native / Expo apps that combines **Jest** (unit/UI/snapshot), **Maestro** (E2E on a real device), **ADB screen recording**, **ffmpeg frame extraction**, and **jest-image-snapshot pixel diff** — with a critical extra step at each layer: after every recorded run the video is split into still frames, the frames are **read** to confirm what actually happened on screen, **and** diffed against committed baselines so visual drift fails the Jest gate. Maestro reporting "all steps passed" is not trusted on its own; the pixels are verified — twice.

The app under test is a small, clean **auth flow** (mock/local auth, no backend) used to exercise the harness end-to-end.

## Quick Start

### Prerequisites

- Node.js 18+
- Android emulator or physical device (`adb devices` shows one `device`)
- [Maestro CLI](https://maestro.mobile.dev/) (`maestro --version`)
- `ffmpeg` (for extracting frames from recordings)
- Expo dev build installed on the device + Metro running (`npx expo start`)

### Setup

```bash
npm install
adb devices            # confirm a device/emulator is attached
npx expo start         # Metro bundler (the dev build loads JS from here)
```

### Running the harness

```bash
# Jest: unit + UI + snapshots
npx jest --watchAll=false

# Type check
npx tsc --noEmit

# A single Maestro E2E flow
maestro test .maestro/login_test.yaml

# Full per-screen device run (record + extract frames) — see the script below
```

---

## App under test (auth flow)

A tab-less Expo Router stack (`app/_layout.tsx`):

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/index.tsx` | **Login** — email/password validation, links to Register/Forgot, → Home |
| `/register` | `app/register.tsx` | **Register** — name/email/password/confirm validation, → Home |
| `/forgot-password` | `app/forgot-password.tsx` | **Forgot Password** — email validation, mock "reset link sent" |
| `/home` | `app/home.tsx` | **Home** — post-login landing, logout → Login |

Shared building blocks: `lib/authValidation.ts` (validators), `components/ui/{FormTextInput,PrimaryButton,AuthScreen}.tsx`, and `components/RegisterForm/`.

---

## Harness architecture

```
Jest Layer (Unit / UI / Snapshots)            ← fast, no device
        ↓ (green gate)
ADB screen recording ═══════════ Maestro E2E flow   ← real device, recorded
        ↓                               ↓
   video.mp4  ──►  ffmpeg frame extraction (1 fps)
                            ↓
                   read frames = visual verification
                            ↓
              jest-image-snapshot pixel diff vs baselines
                            ↓
                  attach recording + diff PNGs
                  to the issue tracker
```

**Jest** catches logic/structure/regression bugs without a device. **Maestro** drives real user flows. **ADB** captures the screen as MP4. **ffmpeg + frame reading** turns the video into still images that can actually be inspected (an MP4 can't be "watched" by a coding agent — frames can be read). **jest-image-snapshot** then closes the loop by diffing those frames against committed baselines, so visual regressions (layout shift, color drift, missing icons) fail the Jest gate the same way structural snapshots do.

### Why ADB screen recording (not Maestro's recorder)?

| Feature | ADB `screenrecord` | Maestro record |
|---------|--------------------|----------------|
| Independence | ✅ Universal | ❌ Maestro-only |
| Runs alongside the flow | ✅ Non-blocking | ❌ Blocking |
| Full-screen capture | ✅ Whole device | ⚠️ Flow only |
| Overhead | ✅ Low (hardware encoder) | ❌ Higher |

> ⚠️ Record with `screenrecord` **only**. Do **not** also run a live `adb screencap` loop in parallel to sample frames — on weaker emulators the combined load makes the app ANR ("isn't responding") mid-flow. Extract frames from the saved video afterward instead.

---

## Test layers

### Layer 1 — Unit (Jest)
Pure logic: validators, helpers, transforms.
```typescript
import { validateEmail, EMAIL_ERROR } from '@/lib/authValidation';

it('rejects malformed emails', () => {
  expect(validateEmail('foo@bar')).toBe(EMAIL_ERROR);
  expect(validateEmail('a@b.co')).toBeNull();
});
```

### Layer 2 — UI (React Native Testing Library)
Component behavior through interactions; mock navigation.
```typescript
fireEvent.press(getByTestId('login-submit-button'));
expect(getByText('Enter a valid email address')).toBeTruthy();
expect(mockReplace).not.toHaveBeenCalled();
```

### Layer 3 — Snapshots
Structural regression detection; update only when the change is intentional.
```bash
npx jest --updateSnapshot
```

### Layer 4 — E2E (Maestro)
Full flows on the device, keyed off stable `testID`s. Use `scrollUntilVisible` before fields/asserts (Maestro `tapOn` does not auto-scroll).
```yaml
appId: com.anonymous.reactnativeuitest
---
- launchApp
- assertVisible: "Welcome back"
- tapOn: { id: "login-submit-button" }
- assertVisible: "Enter a valid email address"
- tapOn: { id: "login-email-input" }
- inputText: "john@example.com"
- hideKeyboard
- tapOn: { id: "login-password-input" }
- inputText: "secret123"
- hideKeyboard
- tapOn: { id: "login-submit-button" }
- assertVisible: { id: "home-screen" }
```

### Layer 5 — Device recording + frame inspection
Every recorded run is split into frames and visually verified (see below).

### Layer 6 — Visual regression (jest-image-snapshot)
The extracted frames are also diffed pixel-by-pixel against committed baselines under `__tests__/visual/__image_snapshots__/`. Closes the gap Maestro can't fill — Maestro asserts on `id`/`text`, not pixels, so a button drifting 4 px or a color token swap looks "passing" to it. Visual regressions show up as ordinary Jest assertion failures, gated by the same `--ci` run as the other layers.

```bash
# Diff every Maestro-extracted frame against its baseline
npx jest __tests__/visual/maestro-frames-test.ts --ci --watchAll=false

# Accept intentional visual changes (after reviewing the *-diff.png)
npx jest __tests__/visual/maestro-frames-test.ts -u
```

The Android status bar (clock, battery, signal) is **cropped before diff** via `lib/visual/frameUtils.ts → cropTopRows()` — without that mask, per-run chrome drift would dominate every comparison. Per-flow overrides live in `STATUS_BAR_PX_BY_FLOW` inside the suite. On fresh checkouts with no extracted frames yet, the suite reports as a single skipped test so CI stays green.

> Library choice: [`jest-image-snapshot`](https://github.com/americanexpress/jest-image-snapshot) over [`react-native-owl`](https://github.com/FormidableLabs/react-native-owl) — extends the existing `jest-expo` preset, consumes the frames Layer 5 already produces (no second device driver contending with `screenrecord`/Maestro), works with the managed Expo workflow, actively maintained (Owl archived 2023).

---

## Test results & coverage

`npx jest --coverage --watchAll=false --ci` → **11 suites passing + 1 intentionally skipped (the `maestro-frames-test.ts` conditional suite — engages only when extracted frames exist), 54 tests passing**, 5 snapshots. Overall coverage **99.18% statements · 94.04% branch · 100% functions · 99.14% lines**.

| Layer | File | % Stmts | % Branch | % Funcs | % Lines |
|-------|------|--------:|---------:|--------:|--------:|
| **All files** | — | **99.18** | **94.04** | **100** | **99.14** |
| Unit (logic) | `lib/authValidation.ts` | 100 | 100 | 100 | 100 |
| Unit (logic) | `components/RegisterForm/validation.ts` | 100 | 100 | 100 | 100 |
| Unit (visual) | `lib/visual/frameUtils.ts` | 100 | 100 | 100 | 100 |
| UI (screen) | `app/index.tsx` — Login | 100 | 100 | 100 | 100 |
| UI (screen) | `app/register.tsx` | 100 | 100 | 100 | 100 |
| UI (screen) | `app/forgot-password.tsx` | 100 | 100 | 100 | 100 |
| UI (screen) | `app/home.tsx` | 100 | 100 | 100 | 100 |
| UI (component) | `components/RegisterForm/index.tsx` | 100 | 100 | 100 | 100 |
| UI (component) | `components/ui/FormTextInput.tsx` | 100 | 100 | 100 | 100 |
| UI (component) | `components/ui/PrimaryButton.tsx` | 100 | 100 | 100 | 100 |
| UI (component) | `components/ui/AuthScreen.tsx` | 100 | 50 | 100 | 100 |
| Shared | `components/themed-text.tsx` | 100 | 90.9 | 100 | 100 |

**Unit coverage** (pure logic — validators) is **100%** across the board. **UI coverage** (screens + components) is **100% of statements/functions/lines**; the only sub-100% branch is `AuthScreen`'s optional `subtitle`/theme branch. Regenerate anytime with `npx jest --coverage` (HTML report at `coverage/lcov-report/index.html`).

> Navigation/theme scaffolding (`app/_layout.tsx`, `hooks/use-color-scheme.ts`) has no dedicated tests and is intentionally excluded from the goals above.

---

## Recording inspection (read the video as frames)

You can't watch an `.mp4` — you read **images**. After a recorded run, split the video into stills and read them to confirm errors render, success/empty states appear, the right screen is shown, and there's **no redbox or ANR dialog**.

```bash
LOCAL=".maestro/recordings/20260527-212929-login_test.mp4"
FRAMES="/tmp/maestro-frames/$(basename "$LOCAL" .mp4)"
mkdir -p "$FRAMES"

# 1 frame per second (good for short flows); use fps=1/3 for long flows
ffmpeg -loglevel error -y -i "$LOCAL" -vf fps=1 "$FRAMES/frame_%03d.png"
```

`frame_NNN.png` ≈ second `NNN` of the run, so frames map to Maestro log steps by timestamp. Read a spread plus the frames at each **action boundary** (right after each `inputText` / `tapOn` / assertion) — the "perfect" moments to look — rather than every frame.

### Full per-screen run (record + extract)

```bash
D=127.0.0.1:6555            # adb device id
FLOW=".maestro/login_test.yaml"
STAMP="$(date +%Y%m%d-%H%M%S)"; BASE="$(basename "$FLOW" .yaml)"
LOCAL=".maestro/recordings/${STAMP}-${BASE}.mp4"; REMOTE="/sdcard/m-${STAMP}.mp4"
FRAMES="/tmp/maestro-frames/${STAMP}-${BASE}"; mkdir -p .maestro/recordings "$FRAMES"

# Pre-warm so Maestro's launchApp cold-start doesn't ANR while Metro rebuilds
adb -s $D shell am force-stop com.anonymous.reactnativeuitest
adb -s $D shell monkey -p com.anonymous.reactnativeuitest -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12

adb -s $D shell screenrecord --bit-rate 3000000 "$REMOTE" &   # record ONLY (no parallel screencap)
sleep 1
maestro test "$FLOW"; RC=$?
adb -s $D shell pkill -INT screenrecord || true; sleep 2
adb -s $D pull "$REMOTE" "$LOCAL"; adb -s $D shell rm -f "$REMOTE"
ffmpeg -loglevel error -y -i "$LOCAL" -vf fps=1 "$FRAMES/frame_%03d.png"
echo "exit=$RC video=$LOCAL frames=$(ls "$FRAMES" | wc -l)"
```

---

## Error diagnosis — what to do when a flow fails

A non-zero Maestro exit, **or** any frame showing an ANR/redbox, means the run is not trustworthy even if some steps reported `COMPLETED`. The procedure:

1. **Find the failing step** in the Maestro log (the last `COMPLETED`, then the `FAILED` line).
2. **Read the frames around that moment** action-by-action. Because frames are 1 fps and the log is timestamped, you can pinpoint the exact second and see what was on screen — wrong scroll position, keyboard covering a field, an ANR/redbox dialog, an unexpected screen.
3. **Check Maestro's own debug artifacts** at `~/.maestro/tests/<timestamp>/` — it saves a screenshot on failure plus logs and the command list.
4. **Apply the fix** based on what the frames show, then re-run and re-inspect.

### Failure patterns seen in this repo (and the fixes)

| Symptom in the frames | Cause | Fix |
|-----------------------|-------|-----|
| "isn't responding" ANR dialog mid-flow | Emulator overloaded by `screenrecord` + a parallel `screencap` sampler | Record with `screenrecord` only; extract frames from the video afterward |
| ANR right after `launchApp` | Cold start raced with Metro's first bundle rebuild | **Pre-warm** the app (force-stop + launch + ~12s) before `maestro test` |
| `Element not found` for a lower field | `tapOn` doesn't auto-scroll; the field was off-screen / behind the keyboard | `scrollUntilVisible` before each field tap and assertion |

---

## Project structure

```
react-native-testing-sample/
├── README.md                     ← this overview
├── HARNESS_GUIDE.md              ← engineering deep-dive
├── jest.setup.ts                 ← registers toMatchImageSnapshot (Layer 6)
├── app/                          ← Expo Router screens (tab-less stack)
│   ├── _layout.tsx               ← Stack: index, register, forgot-password, home
│   ├── index.tsx                 ← Login
│   ├── register.tsx              ← Register
│   ├── forgot-password.tsx       ← Forgot Password
│   ├── home.tsx                  ← Home
│   └── __tests__/                ← screen UI tests + snapshots
├── lib/
│   ├── authValidation.ts         ← shared validators
│   ├── __tests__/
│   └── visual/
│       └── frameUtils.ts         ← cropTopRows + status-bar masking (Layer 6)
├── components/
│   ├── RegisterForm/             ← register form + validation + tests
│   └── ui/                       ← FormTextInput, PrimaryButton, AuthScreen (+ tests)
├── __tests__/visual/             ← visual regression layer (Layer 6)
│   ├── image-snapshot-matcher-test.ts   ← matcher wiring smoke test
│   ├── frameUtils-test.ts               ← cropTopRows unit tests
│   ├── maestro-frames-test.ts           ← diffs Maestro frames vs baselines
│   └── __image_snapshots__/             ← committed PNG baselines (regression contract)
├── .maestro/
│   ├── login_test.yaml
│   ├── register_form_test.yaml
│   ├── forgot_password_test.yaml
│   ├── home_test.yaml
│   └── recordings/
│       ├── *.mp4                 ← raw recordings (git-ignored)
│       └── frames/               ← extracted PNGs per flow (git-ignored, regenerated)
└── .skills/
    └── harness-engineering/      ← TDD + recording + frame-inspection harness skill
```

---

## Common commands

```bash
npx jest --watchAll=false --ci                     # all jest layers (incl. visual)
npx jest app/__tests__/login-screen-test.tsx       # one suite
npx jest __tests__/visual/ --ci                    # visual regression only (Layer 6)
npx jest --updateSnapshot                          # accept intentional snapshot changes
npx jest __tests__/visual/maestro-frames-test.ts -u  # accept intentional visual changes
npx tsc --noEmit                                   # type check
maestro test .maestro/home_test.yaml               # one E2E flow
ffmpeg -i video.mp4 -vf fps=1 frame_%03d.png       # split a recording into frames
ls -lh .maestro/recordings/                        # list recordings
```

---

## Execution pipeline

```
START
  ├─► Jest (unit + UI + snapshots) + tsc            ← green gate
  ├─► Device check (adb devices)
  ├─► Pre-warm app (avoid cold-start ANR)
  ├─► screenrecord  +  maestro test   (recorded run)
  ├─► pull video → .maestro/recordings/
  ├─► ffmpeg: extract frames (1 fps) → .maestro/recordings/frames/<flow>/
  ├─► READ frames → verify on-screen behavior        ← required, not optional
  ├─► jest-image-snapshot pixel diff → catch visual drift (Layer 6)
  └─► attach recording + *-diff.png to issue tracker (Linear)
END
```

---

## Troubleshooting

```bash
# Device not connected
adb devices

# Jest failures (verbose)
npx jest --verbose --watchAll=false

# App ANR / sluggish first launch → pre-warm before Maestro
adb shell am force-stop com.anonymous.reactnativeuitest
adb shell monkey -p com.anonymous.reactnativeuitest -c android.intent.category.LAUNCHER 1

# Maestro element not found → it doesn't auto-scroll; use scrollUntilVisible

# Inspect a recording frame-by-frame
ffmpeg -i .maestro/recordings/<file>.mp4 -vf fps=1 /tmp/frames/frame_%03d.png

# Maestro's own failure screenshot + logs
ls ~/.maestro/tests/
```

---

## Best practices

- ✅ TDD: write a failing test first (Red → Green → Refactor)
- ✅ Stable `testID`s for every E2E assertion
- ✅ `scrollUntilVisible` before lower fields/asserts in Maestro
- ✅ Record with `screenrecord` only; inspect via extracted frames
- ✅ Pre-warm the app before recorded runs
- ✅ Don't trust a green Maestro log alone — confirm the frames
- ✅ Update snapshots only for intentional changes (structural **and** visual)
- ✅ Visual regression: diff **action-boundary frames only**, mask the status bar, attach `*-diff.png` artifacts on failure

---

## Deep dive

See **[HARNESS_GUIDE.md](./HARNESS_GUIDE.md)** for architecture, design principles, timing analysis, and the full diagnostics playbook.

## References

- [Jest](https://jestjs.io/) · [React Native Testing Library](https://callstack.github.io/react-native-testing-library/) · [Maestro](https://maestro.mobile.dev/) · [ADB](https://developer.android.com/tools/adb) · [Expo](https://docs.expo.dev/) · [ffmpeg](https://ffmpeg.org/) · [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot)

---

**Harness Version**: 2.1 · **Stack**: React Native + Expo Router + Jest + Maestro + ADB + ffmpeg + jest-image-snapshot

---

## Harness engineering for agentic AI coding

When an AI agent generates code, the harness is what makes its output trustworthy:

1. **Verification without human review** — jest + tsc gate every change; the device recording + frames prove real behavior.
2. **Deterministic feedback loop** — clear pass/fail plus visual evidence guide the next iteration.
3. **Safety through layers** — unit → UI → structural snapshot → E2E → recorded-and-inspected → **visual regression** (pixel diff).
4. **Trust through artifacts** — each screen's recording is attached to its tracker issue, frames are inspected (and, on failure, read action-by-action), **and** every action-boundary frame is diffed against a committed baseline. A green Maestro log no longer ends the trust chain; the pixels do.

```
AGENT CODE  →  HARNESS (jest · tsc · maestro · record · ffmpeg frames · pixel diff)  →  PASS/FAIL + frames + *-diff.png  →  next iteration
```

Reference: OpenAI — [Harness Engineering for AI](https://openai.com/index/harness-engineering/).
