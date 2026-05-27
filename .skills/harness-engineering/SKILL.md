--- 
name: harness-engineering
description: >
  Full React Native testing-harness workflow — not just TDD guardrails. Write failing
  tests first and complete unit, UI, and snapshot coverage; then run the device harness:
  ADB screen recording + Maestro E2E, extract frames with ffmpeg and read them to verify
  on-screen behavior, and attach the recording to the issue tracker.
  Use this skill whenever the user asks to implement or fix app behavior, components,
  hooks, navigation flows, or test coverage in React Native/Expo projects.
  When user says "test", automatically runs all unit tests, UI tests, snapshot tests,
  starts ADB screen recording, executes Maestro flows, stops recording upon completion,
  then extracts frames from the recording and reads them to verify on-screen behavior.
tags: [react-native, expo, tdd, unit-test, ui-test, snapshot, maestro, adb, ffmpeg, frame-analysis, auto-test]
---

# React Native Harness Engineering Skill

Use this workflow for feature work and bug fixes in React Native/Expo codebases.

## Core Principle

Run **Red -> Green -> Refactor** for every behavior change:

1. **Red**: write a failing test that reproduces the requirement/bug.
2. **Green**: implement the minimum code to pass.
3. **Refactor**: clean code while keeping tests green.

If no failing test was created first, treat implementation as incomplete.

## Mandatory Test Surfaces

For each feature/bug change, cover all relevant layers:

1. **Unit test**
   - Pure logic, helpers, hooks, state transforms, formatters, validators.
   - Assert exact expected behavior and edge cases.
2. **UI test**
   - Component/screen behavior through user interactions (press, input, visibility, navigation intent).
   - Use testing-library patterns over implementation details.
3. **Snapshot update**
   - Update snapshot only when UI change is intentional.
   - Never blindly accept snapshots; confirm the visual/structural delta is expected.

When a layer is not applicable, explicitly state why.

## Execution Workflow

1. Clarify acceptance criteria and impacted files.
2. Create/extend failing tests first (unit/UI/snapshot as applicable).
3. Run the targeted failing tests to confirm **Red**.
4. Implement minimal production change.
5. Re-run targeted tests for **Green**.
6. Run broader related tests to detect regressions.
7. If snapshots changed, review diff and update intentionally.
8. Summarize what changed and what is now covered by tests.

## Test Quality Bar

- Prefer behavior-focused assertions.
- Include at least one negative or edge-path assertion when relevant.
- Avoid over-mocking core behavior unless unavoidable.
- Keep tests deterministic and readable.

## Comprehensive Test Execution

When the user asks to "test" or run tests, execute ALL test surfaces in this order:

1. **Run all unit tests**: `npx jest --watchAll=false`
2. **Run all UI tests**: `npx jest --testNamePattern=".*" --watchAll=false`
3. **Run snapshot tests**: All snapshots are automatically tested within jest runs
4. **Start ADB recording**: Initialize `adb screenrecord` on the connected device
5. **Run Maestro flows**: Execute all `.maestro/*.yaml` flows
6. **Stop ADB recording**: Automatically terminate recording and pull video when Maestro completes
7. **Extract & inspect frames**: Split the pulled video into stills with `ffmpeg` (every 1s, or every 3s for long flows) and read them to verify on-screen behavior
8. **Create/Update Linear issue**: Document test results and specifications
9. **Upload recording to Linear**: Attach video file directly to the Linear issue (not links)
10. **Update issue description**: Add video attachment info at the top of description for visibility

This is the **default behavior** when the user says "test". No additional prompt is required.

## Completion Gate (Maestro + device recording)

When all unit/UI/snapshot tests pass, automatically proceed to Maestro with device recording.

**Auto-execution order:**
1. Run all tests (unit, UI, snapshot)
2. If tests pass, auto-start ADB recording
3. Run Maestro flows
4. Auto-stop recording and pull video to `.maestro/recordings/`
5. Extract frames from the recording and read them to verify on-screen behavior
6. Create or update Linear issue with test results
7. Upload video recording directly as Linear attachment
8. Update Linear issue description with video attachment details prominently displayed at the top

### Before Maestro: `adb screenrecord` (required)

Always capture a device video **before** starting Maestro. Do not run `maestro test` / `maestro record` until recording is started.

1. **Prerequisites**
   - Android device or emulator attached: `adb devices` shows one `device`.
   - App installed and reachable on that device.

2. **Output folder** (repo-relative, do not use project root)
   - Save all pulls under: `.maestro/recordings/`
   - Create the folder if missing: `mkdir -p .maestro/recordings`
   - Filename pattern: `YYYYMMDD-HHMMSS-<flow-basename>.mp4`  
     Example: `.maestro/recordings/20260516-143022-flip_webview_test.mp4`

3. **Start recording on device, then run Maestro**

```bash
FLOW=".maestro/flip_webview_test.yaml"
BASENAME="$(basename "$FLOW" .yaml)"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL=".maestro/recordings/${STAMP}-${BASENAME}.mp4"
REMOTE="/sdcard/maestro-${STAMP}.mp4"

mkdir -p .maestro/recordings
adb shell screenrecord "$REMOTE" &
sleep 1
maestro test "$FLOW"
adb shell pkill -INT screenrecord || true
sleep 1
adb pull "$REMOTE" "$LOCAL"
adb shell rm -f "$REMOTE"
echo "Recording saved to $LOCAL"
```

4. **After Maestro**
   - Confirm `$LOCAL` exists and is non-empty.
   - Mention the saved path in the completion summary.
   - If recording failed or pull is empty, report the adb error; do not claim the run was recorded.

## Recording Inspection (extract frames and read them)

You cannot watch an `.mp4` directly — you read **images**. After the recording is pulled, split it into still frames and read them to verify what actually happened on screen (errors shown, success states, navigation, no redbox/ANR). This is a **required verification step**, not optional. Maestro reporting all steps `COMPLETED` is not sufficient on its own — confirm the pixels.

> ⚠️ Do **not** capture frames with a live `adb screencap` loop running in parallel with `screenrecord` + Maestro. On weak emulators the combined load makes the app ANR ("isn't responding") mid-flow. Always record with `screenrecord` only, then extract frames from the saved video afterward.

### Extract frames with `ffmpeg`

```bash
LOCAL=".maestro/recordings/20260527-200804-register_form_test.mp4"
FRAMES="/tmp/maestro-frames/$(basename "$LOCAL" .mp4)"
mkdir -p "$FRAMES"

# Default: 1 frame per second (fine-grained; good for short flows)
ffmpeg -loglevel error -y -i "$LOCAL" -vf fps=1 "$FRAMES/frame_%03d.png"

# Lighter sweep: 1 frame every 3 seconds (long flows)
# ffmpeg -loglevel error -y -i "$LOCAL" -vf fps=1/3 "$FRAMES/frame_%03d.png"
```

- Use **`fps=1`** for short flows (≲ 60s) so no action is missed; use **`fps=1/3`** (every 3s) for longer flows to keep the frame count manageable.
- `frame_NNN.png` ≈ second `NNN` of the run, so correlate frames to Maestro log steps by timestamp.
- `ffmpeg` may not appear on a restricted `which` PATH but is still runnable at `/usr/bin/ffmpeg`.

### Read the frames

- Read a spread across the run **plus the frames at each action boundary** (right after each `inputText`, `tapOn`, assertion, navigation). The Maestro log's `COMPLETED` steps tell you roughly when each action happened, so pick the "perfect" moment to look rather than reading every frame.
- For each key frame confirm the expected UI: validation errors with their exact text, success/empty states, the correct screen, and **no redbox or ANR dialog**.
- If a frame shows an ANR ("isn't responding") or a redbox, the run is **not** trustworthy even if Maestro reported success — fix reliability (below), re-run, and re-inspect.
- Summarize findings by referencing specific frames (e.g. "frame 043 shows all four validation errors").

### Reliability (so the run is clean enough to inspect)

- **Pre-warm** the app before `maestro test` (`am force-stop` + launcher intent + ~10–12s wait) so Maestro's `launchApp` cold-start doesn't ANR while Metro rebuilds the JS bundle.
- `tapOn` does **not** auto-scroll. On scrollable screens use `scrollUntilVisible` before each field tap and assertion; assert a field's inline error right after typing while it is on screen.

## Issue Tracking Upload

After Maestro execution completes and recording is pulled:

1. **Prepare recording for upload**
   - Recording is saved at `.maestro/recordings/<timestamp>-<flow-name>.mp4`
   - Verify file exists and is non-empty before uploading

2. **Upload to Linear issue**
   - Create or update Linear issue with test results
   - Use `linear-prepare_attachment_upload` to get signed upload URL
   - Upload video file via PUT request (raw binary, not base64)
   - Use `linear-create_attachment_from_upload` to link video to issue
   - **Do NOT provide links** — upload actual file content to Linear

3. **Attachment metadata**
   - Title: `E2E Test Recording - [Flow Name]`
   - Subtitle: `Maestro Flow: [flow-basename.yaml]`
   - Include: timestamp, device info, test status

4. **Update issue description with video details**
   - Add video attachment info at the **TOP** of the issue description
   - Format:
     ```
     ## 🎥 E2E Test Recording Attached
     **Video File**: `E2E Test Recording - [Flow Name]` (size)
     * **Device**: [device info]
     * **Maestro Flow**: [flow-name.yaml]
     * **Recorded**: [timestamp]
     * **Status**: ✅ Video successfully uploaded and attached to this issue
     ```
   - Include reference pointing to attachment: "See attached video above ⬆️"
   - Make video prominence clear and easy to find in description

5. **Verification**
   - Confirm attachment appears in Linear issue
   - Verify file size matches original recording
   - Verify description displays video info at top
   - Include attachment path in completion summary
