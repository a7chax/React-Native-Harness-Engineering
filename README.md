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

### Why ADB Screen Recording Instead of Maestro Record?

**Maestro `record` mode** is designed for **creating** test flows interactively (Maestro Studio).  
**ADB `screenrecord`** is for **capturing** device output independently.

**Key Advantages of ADB Recording:**

| Feature | ADB screenrecord | Maestro record |
|---------|------------------|-----------------|
| **Purpose** | Device video capture | Flow creation tool |
| **Independence** | Works on any app | Maestro-specific |
| **CI/CD Integration** | ✅ Perfect for automation | ❌ Interactive only |
| **Parallel Usage** | ✅ Run while Maestro executes | ❌ Blocks Maestro |
| **File Control** | ✅ Full device recording | ❌ Only generated flows |
| **Storage Flexibility** | ✅ Save anywhere (local/remote) | ❌ Maestro-managed storage |
| **Debugging** | ✅ See actual device behavior | ⚠️ Only recorded actions |

**Decision Rationale:**
- 🎯 **Orchestration**: Start ADB recording → run Maestro → stop recording (parallel execution)
- 📹 **Full Capture**: Records everything the user sees (including error states, animations)
- 🔄 **Reusability**: Same video file supports multiple analysis tools
- 🤖 **Automation**: Works in CI/CD pipelines without interactive steps
- 📊 **Traceability**: Device output tied directly to test execution timestamp

---

### ADB Screen Recording

**Automatic during test execution**, or manual:

```bash
adb shell screenrecord /sdcard/test-recording.mp4 &
# ... run tests ...
kill $!
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
appId: com.example.app
---
- launchApp
- assertVisible:
    text: Welcome!
- assertVisible:
    id: email-input
- tap:
    id: email-input
- inputText: test@example.com
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

## Issue Tracking Integration

### Automatic Issue Creation/Update

When tests complete, an issue can be created with:
- **Test results**: Pass/fail summary
- **Test specifications**: Each test case documented
- **Device info**: Emulator/device details
- **Video attachment**: Actual MP4 file uploaded (not link)

### Issue Template

**Example structure:**
```markdown
## 🎥 E2E Test Recording Attached
**Video File**: E2E Test Recording - sample_test (1.58 MB)
* **Device**: Android emulator 127.0.0.1:6555
* **Maestro Flow**: sample_test.yaml
* **Recorded**: 2026-05-16 00:35:45
* **Status**: ✅ Video successfully recorded and captured

## Test Coverage
- ✅ Unit tests: 6 passed
- ✅ UI tests: All interactions verified
- ✅ Snapshots: Visual structure validated
- ✅ E2E: Maestro flow executed
- ✅ Recording: Device screen captured
```

### Attachment Integration

Video files can be uploaded directly to issue tracking systems (e.g., Linear, GitHub, Jira):
- **Format**: MP4 (binary upload, not base64)
- **Size**: Full device recording
- **Storage**: Issue attachments section
- **Access**: Download/view from issue

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
   Results: All unit tests passed
   ```

2. **Run UI tests** (same Jest execution)
   ```
   Results: All component interactions verified
   ```

3. **Verify snapshots** (included in Jest)
   ```
   Results: All snapshots validated
   ```

4. **Check device connection**
   ```
   adb devices → Must show "device" status
   ```

5. **Start ADB screen recording**
   ```
   adb shell screenrecord /sdcard/test-TIMESTAMP.mp4
   Captures complete device output
   ```

6. **Run Maestro flows**
   ```
   maestro test .maestro/sample_test.yaml
   Executes automated user interactions
   ```

7. **Stop recording & pull video**
   ```
   Recording saved to .maestro/recordings/TIMESTAMP-flow-name.mp4
   ```

8. **Create/Update issue** (optional - if issue tracking configured)
   ```
   Document test results and specifications
   Status: Done
   Priority: High
   ```

9. **Upload video to issue** (optional - if issue tracking configured)
   ```
   Method: Direct binary upload (not base64)
   Storage: Issue attachment section
   Metadata: Timestamp, device info, test status
   ```

10. **Update issue description** (optional)
    ```
    Add video info at top of description
    Include clear metadata and timestamps
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

### View Device Recording

```bash
# Locate MP4 file
ls -lh .maestro/recordings/

# Play in default video player
open .maestro/recordings/TIMESTAMP-flow-name.mp4  # macOS
vlc .maestro/recordings/TIMESTAMP-flow-name.mp4   # Linux/VLC
```

### Check Issue Tracking (if configured)

- Visit your issue tracking system dashboard
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
adb shell pm list packages | grep <your-app-package>

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

### Issue: Recording or attachment fails

```bash
# Check file size
ls -lh .maestro/recordings/

# Ensure device is connected
adb devices

# Verify screenrecord is working
adb shell screenrecord --time-limit=10 /sdcard/test.mp4
adb pull /sdcard/test.mp4 ./test.mp4
```

---

## Learn More

- [Jest Testing Framework](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro E2E Framework](https://maestro.mobile.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [ADB Documentation](https://developer.android.com/tools/adb)

---

## Contributing

When adding new features or components:

1. **Write failing tests first** (Red)
2. **Implement minimal code** (Green)
3. **Refactor while tests pass** (Refactor)
4. **Run full test harness** (`npm test`)
5. **Verify test results** with device recording

---

**Last Updated**: 2026-05-16
**Test Harness Version**: 1.0
**Framework**: React Native + Expo + Jest + Maestro + ADB Screen Recording
