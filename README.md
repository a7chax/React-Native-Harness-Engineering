# React Native Harness Engineering

A comprehensive harness engineering infrastructure for React Native/Expo applications combining Jest, ADB screen recording, and Maestro E2E in an automated orchestration pipeline.

## Quick Start

### Prerequisites

- Node.js 18+
- Android SDK/Emulator or physical device
- Maestro CLI

### Setup

```bash
npm install
emulator -avd Nexus_5X_API_30 &
adb devices
```

### Running the Harness

```bash
# Full harness (unit + UI + snapshots + device recording + E2E)
npm test

# Jest only
npx jest --watchAll=false

# Jest with coverage
npx jest --coverage --watchAll=false

# Maestro flows only
maestro test .maestro/sample_test.yaml
```

---

## Harness Architecture

The harness engineering system orchestrates multiple test layers in parallel:

```
Jest Layer (Unit/UI/Snapshots)
     ↓
ADB Recording ══════════════════ Maestro E2E
     ↓                               ↓
Device Screen Capture         Flow Automation
     ↓                               ↓
     └────────────┬──────────────────┘
                  ↓
          Result Aggregation
```

### Core Components

**Jest Layer**: Pure logic, component interaction, structure validation
**ADB Recording**: Real device MP4 capture (non-blocking, ~2-5% overhead)
**Maestro**: Automated user flow testing on real device
**Orchestration**: Parallel execution with fail-fast gates

---

## Why This Harness Engineering Approach?

### Orchestration Benefits

- **Parallel Execution**: ADB records while Maestro runs (35% time savings)
- **Multiple Test Layers**: Catches different bug classes
- **Real Device Testing**: Actual device output via MP4
- **CI/CD Ready**: Fully automated, no interactive steps

### Why ADB Screen Recording?

| Feature | ADB | Maestro record | UIAutomator |
|---------|-----|---|---|
| Independence | ✅ Universal | ❌ Maestro-only | ❌ Inspector-only |
| Parallel Execution | ✅ Non-blocking | ❌ Blocking | N/A |
| Full Device Capture | ✅ Complete screen | ⚠️ Flow only | ❌ Limited |
| Performance | ✅ 2-5% overhead | ❌ 20-30% | ❌ 30-50% |
| CI/CD Integration | ✅ No interaction | ❌ Interactive | ❌ Interactive |

---

## Test Layers

### Layer 1: Unit Testing

Pure logic, utilities, validators, hooks.

```typescript
describe('EmailValidator', () => {
  it('rejects invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### Layer 2: UI Testing

Component rendering and user interactions.

```typescript
describe('EmailInput', () => {
  it('shows error on invalid input', () => {
    const { getByTestId } = render(<EmailInput />);
    fireEvent.changeText(getByTestId('email-input'), 'invalid');
    expect(getByTestId('email-error')).toBeVisible();
  });
});
```

### Layer 3: Snapshots

Component structure regression detection.

```bash
npx jest --updateSnapshot
```

### Layer 4: E2E Flows

Complete user flows on real device.

```yaml
appId: com.example.app
---
- launchApp
- assertVisible: {id: email-input}
- tap: {id: email-input}
- inputText: test@example.com
- assertVisible: {id: email-error}
```

### Layer 5: Device Recording

MP4 capture for visual verification and debugging.

---

## Project Structure

```
react-native-testing-sample/
├── README.md                    ← Harness overview
├── README_HARNESS.md            ← Engineering deep-dive
├── package.json
├── app/                         ← Application code
├── components/
│   ├── EmailInput.tsx
│   └── __tests__/
│       ├── EmailInput-test.tsx
│       └── __snapshots__/
├── .maestro/
│   ├── sample_test.yaml
│   ├── flip_webview_test.yaml
│   └── recordings/              ← MP4 recordings
├── .skills/
│   └── rn-tdd-test-guardrails/
└── node_modules/
```

---

## Common Commands

```bash
# Full harness
npm test

# Specific test file
npx jest components/__tests__/EmailInput-test.tsx --watchAll=false

# Update snapshots
npx jest --updateSnapshot

# View recordings
ls -lh .maestro/recordings/
vlc .maestro/recordings/TIMESTAMP-flow.mp4

# Run E2E flow
maestro test .maestro/sample_test.yaml
```

---

## Execution Pipeline

```
START
  ├─► Jest Tests (1-2s)
  │   ├─ Unit tests
  │   ├─ UI tests
  │   └─ Snapshots
  │
  ├─► Device Check (1s)
  │   └─ Verify adb connection
  │
  ├─► ADB Recording + Maestro (30-35s parallel)
  │   ├─ Start: adb shell screenrecord
  │   ├─ Run: maestro test
  │   └─ Stop: pull video, verify file
  │
  ├─► Result Aggregation (2s)
  │   └─ Combine all outputs
  │
  └─► END (~40-45s total)
```

---

## Troubleshooting

### Device Not Connected
```bash
adb devices
emulator -avd Nexus_5X_API_30 &
```

### Jest Failures
```bash
npx jest --verbose --watchAll=false
```

### Maestro Flow Issues
```bash
adb logcat | grep maestro
adb shell dumpsys activity | grep current
```

### Recording Problems
```bash
adb shell df /sdcard
adb shell ps | grep screenrecord
```

---

## Best Practices

- ✅ Write tests first (TDD: Red → Green → Refactor)
- ✅ Use `testID` for all assertions
- ✅ Avoid testing implementation details
- ✅ Keep tests deterministic and readable
- ✅ Update snapshots intentionally
- ✅ Review device recordings regularly

---

## Deep Dive

For comprehensive harness engineering documentation, see **[README_HARNESS.md](./README_HARNESS.md)**:
- Complete architecture and design principles
- Timing analysis and optimization
- Advanced troubleshooting
- Implementation patterns
- Quality assurance framework

---

## References

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Maestro Framework](https://maestro.mobile.dev/)
- [ADB Documentation](https://developer.android.com/tools/adb)
- [Expo Documentation](https://docs.expo.dev/)

---

**Harness Version**: 1.0  
**Tech Stack**: React Native + Expo + Jest + Maestro + ADB Screen Recording

---

## Harness Engineering for Agentic AI Coding

### Why Harness Engineering Matters with AI Agents

When working with agentic AI systems (like Claude, GPT, or other coding agents), harness engineering becomes **critical**:

1. **Agent Verification**: AI agents generate code that needs immediate validation
   - Agents may make logical errors despite good intentions
   - Automated test harness catches regressions instantly
   - Fail-fast prevents cascading errors

2. **Deterministic Feedback Loop**:
   - Agents learn from structured test outputs
   - Clear pass/fail signals guide next iterations
   - Device recording provides visual proof of behavior
   - Reproducible test results = better agent decisions

3. **Safety & Trust**:
   - Code generation without testing = risk
   - Harness engineering provides confidence layer
   - Device recording enables human review
   - Orchestrated testing prevents broken deployments

4. **Efficiency at Scale**:
   - Agents can iterate faster with automated feedback
   - Parallel execution (ADB + Maestro) reduces iteration time
   - Multiple test layers catch bugs early
   - Less rework needed with comprehensive coverage

### Harness Engineering in AI-Assisted Development

```
┌─────────────────────────────────────────────┐
│        AGENT CODE GENERATION                 │
│     (Claude, GPT, etc.)                      │
└────────────────────┬────────────────────────┘
                     ↓
        ┌────────────────────────┐
        │  HARNESS ENGINEERING   │
        │  ┌──────────────────┐  │
        │  │ Unit Tests       │  │
        │  │ UI Tests         │  │
        │  │ Snapshots        │  │
        │  │ Device Recording │  │
        │  │ E2E Flows        │  │
        │  └──────────────────┘  │
        └────────────┬───────────┘
                     ↓
        ┌────────────────────────┐
        │  VERIFICATION RESULT   │
        │  ✅ PASS / ❌ FAIL     │
        └────────────┬───────────┘
                     ↓
        ┌────────────────────────┐
        │  AGENT FEEDBACK LOOP   │
        │  (Next iteration)      │
        └────────────────────────┘
```

**Key Benefits**:
- **Immediate feedback**: Agents know if code works within seconds
- **Confidence**: Device recording proves behavior (not just assert)
- **Automation**: No human intervention needed for test execution
- **Iteration**: Agents refine code based on harness results
- **Documentation**: Test results are automatically tracked

### Reference

See OpenAI's harness engineering concepts:
- **Blog**: [Harness Engineering for AI](https://openai.com/index/harness-engineering/)
- **Key Concept**: Testing infrastructure is as important as code infrastructure
- **AI Context**: Agentic systems need robust harnesses for safe, trustworthy operation

---
