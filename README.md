# React Native Testing Harness Guide 🧪

## Overview

This is an [Expo](https://expo.dev) project with an integrated **automated testing harness** that combines unit tests, UI tests, snapshot tests, device screen recording, and end-to-end testing through Maestro. This guide explains the complete testing workflow and how to use it.

---

## Testing Harness Architecture

The testing system is a comprehensive suite designed for **React Native/Expo projects** with automated orchestration across multiple test layers:

```
┌─────────────────────────────────────────────────────────────┐
│                   AUTOMATED TEST HARNESS                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Unit Tests (Jest)          → Pure logic, hooks, helpers   │
│ 2. UI Tests (React Testing)   → Component interactions       │
│ 3. Snapshot Tests             → Visual/structural regression │
│ 4. Device Recording (ADB)     → Real device screen capture   │
│ 5. E2E Tests (Maestro)        → User flow automation         │
│ 6. Linear Integration         → Issue tracking & artifacts   │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

3. Connect Android device/emulator

   ```bash
   adb devices
   ```

### Running Tests

**Run the complete test harness:**

```bash
npm test
```

This automatically executes:
- ✅ All unit tests
- ✅ All UI/component tests
- ✅ Snapshot tests
- ✅ ADB screen recording
- ✅ Maestro e2e flows
- ✅ Linear issue creation
- ✅ Video attachment to Linear

---

## Test Layers

### 1. Unit Tests

Pure logic, utilities, hooks, and state transformations.

**File Structure:**
```
components/
  EmailInput.tsx
  __tests__/
    EmailInput-test.tsx
```

**Run unit tests only:**
```bash
npx jest --watchAll=false
```

**Example:**
```typescript
describe('EmailInput Component', () => {
  it('does not show error initially', () => {
    const { getByTestId } = render(<EmailInput />);
    expect(getByTestId('email-error')).not.toBeVisible();
  });

  it('shows error on invalid email', () => {
    const { getByTestId } = render(<EmailInput />);
    fireEvent.changeText(getByTestId('email-input'), 'invalid');
    expect(getByTestId('email-error')).toBeVisible();
  });
});
```

### 2. UI Tests

Component/screen behavior through user interactions (press, input, navigation).

**Testing Library patterns:**
- Use `getByTestId`, `getByText`, `getByPlaceholder`
- Test via `fireEvent` or `userEvent`
- Assert visibility, enabled state, accessibility
- Avoid testing implementation details

**Example:**
```typescript
it('hides error when email becomes valid', () => {
  const { getByTestId } = render(<EmailInput />);
  
  fireEvent.changeText(getByTestId('email-input'), 'valid@email.com');
  expect(getByTestId('email-error')).not.toBeVisible();
});
```

### 3. Snapshot Tests

Capture component structure and prevent unintentional visual changes.

**Update snapshots when changes are intentional:**
```bash
npx jest --updateSnapshot
```

**Snapshot file:**
```
components/__tests__/__snapshots__/EmailInput-test.tsx.snap
```

---

## Device Recording & E2E Testing

### ADB Screen Recording

**Automatic during test execution**, or manual:

```bash
adb shell screenrecord /sdcard/test-recording.mp4 &
# ... run tests ...
adb shell pkill -INT screenrecord
adb pull /sdcard/test-recording.mp4 ./test-recording.mp4
```

**Recordings saved to:**
```
.maestro/recordings/
  YYYYMMDD-HHMMSS-<flow-name>.mp4
```

### Maestro E2E Flows

Automated user flow testing on real device/emulator.

**Flow file:**
```yaml
# .maestro/sample_test.yaml
appId: com.anonymous.reactnativeuitest
---
- launchApp
- assertVisible:
    text: Welcome!
- assertVisible:
    id: email-input
- tap:
    id: email-input
- inputText: invalid_email
- hideKeyboard
- assertVisible:
    id: email-error
```

**Run Maestro flow:**
```bash
maestro test .maestro/sample_test.yaml
```

**Run with device recording:**
```bash
FLOW=".maestro/sample_test.yaml"
BASENAME="$(basename "$FLOW" .yaml)"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL=".maestro/recordings/${STAMP}-${BASENAME}.mp4"
REMOTE="/sdcard/maestro-${STAMP}.mp4"

mkdir -p .maestro/recordings
adb shell screenrecord "$REMOTE" &
sleep 2
maestro test "$FLOW"
kill $!
adb pull "$REMOTE" "$LOCAL"
adb shell rm -f "$REMOTE"
echo "✅ Recording saved: $LOCAL"
```

---

## Linear Integration

### Automatic Issue Creation/Update

When tests complete, a Linear issue is created with:
- **Test results**: Pass/fail summary
- **Test specifications**: Each test case documented
- **Device info**: Emulator/device details
- **Video attachment**: Actual MP4 file uploaded (not link)

### Issue Example

**Issue**: ARU-8 - EmailInput Component - Comprehensive Testing Complete

**Description includes:**
```markdown
## 🎥 E2E Test Recording Attached
**Video File**: E2E Test Recording - sample_test (1.58 MB)
* **Device**: Android emulator 127.0.0.1:6555
* **Maestro Flow**: sample_test.yaml
* **Recorded**: 2026-05-16 00:35:45
* **Status**: ✅ Video successfully uploaded and attached to this issue

## Test Coverage
- ✅ Unit tests: 6 passed
- ✅ UI tests: All interactions verified
- ✅ Snapshots: Visual structure validated
- ✅ E2E: Maestro flow executed
- ✅ Recording: Device screen captured
```

### Attachment Format

Video files are uploaded directly to Linear as attachments:
- **Format**: MP4 (binary upload, not base64)
- **Location**: Linear issue attachments
- **Size**: Full device recording
- **Access**: Click attachment in Linear to download/view

---

## Complete Workflow: "test" Command

When you run `npm test`, the harness automatically:

```bash
npm test
```

**Execution Flow:**

1. **Run Jest unit tests**
   ```
   npx jest --watchAll=false
   Results: 6 passed, 6 total
   ```

2. **Run UI tests** (same Jest execution)
   ```
   Results: All component interactions verified
   ```

3. **Verify snapshots** (included in Jest)
   ```
   Results: 1 snapshot passed
   ```

4. **Check device connection**
   ```
   adb devices → Must show "device" status
   ```

5. **Start ADB screen recording**
   ```
   adb shell screenrecord /sdcard/maestro-TIMESTAMP.mp4
   ```

6. **Run Maestro flows**
   ```
   maestro test .maestro/sample_test.yaml
   Tests user interactions on device screen
   ```

7. **Stop recording & pull video**
   ```
   Recording saved to .maestro/recordings/TIMESTAMP-sample_test.mp4
   ```

8. **Create/Update Linear issue**
   ```
   Issue: ARU-8 (or new issue if not exists)
   Status: Done
   Priority: High
   ```

9. **Upload video to Linear**
   ```
   Method: Direct binary PUT to signed URL
   Finalize: Create attachment link in issue
   ```

10. **Update issue description**
    ```
    Add video info at TOP of description
    Include metadata, timestamps, device info
    ```

**Total Time**: ~2-3 minutes (including recording time)

---

## Test Quality Standards

### For Each Component/Feature:

1. **Unit Layer**
   - Pure logic tests (validators, formatters, hooks)
   - Edge case assertions
   - Error state handling

2. **UI Layer**
   - User interaction tests
   - Visibility assertions
   - Navigation intent verification

3. **Visual Layer**
   - Snapshot testing
   - Structure verification
   - No unintended changes

### Best Practices:

- ✅ Write tests first (Red -> Green -> Refactor)
- ✅ Use testing-library patterns (avoid implementation details)
- ✅ One assertion per "concept" (group related logic)
- ✅ Clear test names describing expected behavior
- ✅ Mock only when unavoidable
- ✅ Keep tests deterministic and repeatable

---

## Common Tasks

### Run Specific Test Suite

```bash
npx jest components/__tests__/EmailInput-test.tsx --watchAll=false
```

### Update Snapshots

```bash
npx jest --updateSnapshot
```

### Run with Coverage Report

```bash
npx jest --coverage --watchAll=false
```

### Record Maestro Flow Manually

```bash
maestro record --local
# Opens Maestro Studio for interactive recording
```

### View Device Recording

```bash
# Locate MP4 file
ls -lh .maestro/recordings/

# Play in default video player
open .maestro/recordings/TIMESTAMP-flow-name.mp4  # macOS
vlc .maestro/recordings/TIMESTAMP-flow-name.mp4   # Linux/VLC
```

### Check Linear Issues

- Visit: https://linear.app/arungi-cahaya/issues
- Filter: Status = Done, Label = test-results
- View: Video attachments in issue descriptions

---

## Project Structure

```
react-native-testing-sample/
├── README.md                    ← You are here
├── package.json                 ← Test scripts
├── tsconfig.json
├── app/                         ← Application code
├── components/
│   ├── EmailInput.tsx          ← Component
│   └── __tests__/
│       ├── EmailInput-test.tsx  ← Unit/UI tests
│       └── __snapshots__/       ← Snapshot files
├── .maestro/
│   ├── sample_test.yaml         ← E2E flow
│   ├── flip_webview_test.yaml   ← E2E flow
│   └── recordings/              ← Device recordings
├── .skills/
│   └── rn-tdd-test-guardrails/
│       └── SKILL.md             ← Test harness rules
└── node_modules/
```

---

## Troubleshooting

### Issue: No device connected

```bash
# Check devices
adb devices

# If empty, start emulator
emulator -avd <avd_name>
```

### Issue: Maestro flow fails

```bash
# Verify app is installed
adb shell pm list packages | grep reactnativeuitest

# Check device logs
adb logcat | grep maestro
```

### Issue: Recording file is empty

```bash
# Verify screenrecord is running
adb shell ps | grep screenrecord

# Try manual recording
adb shell screenrecord --time-limit=30 /sdcard/test.mp4
adb pull /sdcard/test.mp4 ./test.mp4
```

### Issue: Linear attachment fails

```bash
# Check file size
ls -lh .maestro/recordings/

# Ensure device is connected during upload
adb devices
```

---

## Learn More

- [Jest Testing Framework](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro E2E Framework](https://maestro.mobile.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [Linear API Docs](https://linear.app/api-reference)

---

## Contributing

When adding new features or components:

1. **Write failing tests first** (Red)
2. **Implement minimal code** (Green)
3. **Refactor while tests pass** (Refactor)
4. **Run full test harness** (`npm test`)
5. **Verify Linear issue** created with video

---

**Last Updated**: 2026-05-16
**Test Harness Version**: 1.0
**Framework**: React Native + Expo + Jest + Maestro + Linear
