import fs from "node:fs";
import path from "node:path";
import { labelRecording, type RecordedTap } from "./helpers/recording";

// Resolve paths relative to this config file's directory.
// import.meta.dirname is available on modern Node; fall back to __dirname defensively.
const configDir: string =
  (typeof import.meta !== "undefined" && import.meta.dirname) || __dirname;

// Build the Android capability so environment variables override the defaults.
const androidCapability: WebdriverIO.Capabilities = {
  platformName: "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": process.env.DEVICE_NAME || "Pixel_9a",
  "appium:appPackage": process.env.APP_PACKAGE || "com.anonymous.reactnativeuitest",
  "appium:appActivity": process.env.APP_ACTIVITY || ".MainActivity",
  "appium:appWaitActivity": "*",
  "appium:autoGrantPermissions": true,
  "appium:newCommandTimeout": 300,
  "appium:noReset": false,
};

// If an explicit app artifact is provided, install/launch it.
if (process.env.APP_PATH) {
  androidCapability["appium:app"] = path.resolve(process.env.APP_PATH);
}

// Per-test screenshots are written here after every test (pass or fail). The
// Jest visual-regression layer (Layer 6) diffs them against committed
// baselines — see __tests__/visual/appium-screenshots-test.ts.
const SCREENSHOT_DIR =
  process.env.APPIUM_SHOT_DIR || path.resolve(configDir, "screenshots");

// Opt-in per-test screen recordings (RECORD_VIDEO=1). Each test becomes its own
// video, grouped by feature (the describe block):
//   recordings/<feature>/<NN>-<test-title>.<passed|failed>.mp4
const RECORD_VIDEO = process.env.RECORD_VIDEO === "1";
const RECORDING_DIR =
  process.env.APPIUM_VIDEO_DIR || path.resolve(configDir, "recordings");

/** Turn a test's title into a stable, filesystem-safe baseline key. */
function screenshotName(parent: string, title: string): string {
  return [parent, title]
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

// Per-feature counter so videos sort in execution order within each folder.
const testIndexByFeature = new Map<string, number>();

// Taps in the current test's recording, drawn onto the video afterwards.
let recordingStartedAt = 0;
let recordedTaps: RecordedTap[] = [];

export const config: WebdriverIO.Config = {
  runner: "local",

  specs: [path.resolve(configDir, "specs/**/*.e2e.ts")],

  maxInstances: 1,

  logLevel: "info",

  waitforTimeout: 20000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,

  hostname: "127.0.0.1",
  port: 4723,
  path: "/",

  capabilities: [androidCapability],

  services: [
    [
      "appium",
      {
        // Use the globally-installed `appium` on PATH (the uiautomator2 driver
        // lives in the global APPIUM_HOME). Without this, @wdio/appium-service
        // only looks for a locally-installed appium in node_modules.
        command: "appium",
        args: {
          address: "127.0.0.1",
          port: 4723,
          relaxedSecurity: true,
        },
      },
    ],
  ],

  framework: "mocha",

  reporters: ["spec"],

  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },

  beforeTest: async function () {
    if (!RECORD_VIDEO) return;
    try {
      await driver.startRecordingScreen({
        forceRestart: true,
        timeLimit: "600",
        bitRate: "4000000",
      });
      recordingStartedAt = Date.now();
      recordedTaps = [];
    } catch (err) {
      console.warn(
        `[beforeTest] screen recording failed to start: ${(err as Error).message}`,
      );
    }
  },

  /** While recording, note where and when each element tap lands. */
  beforeCommand: async function (commandName, args) {
    if (!recordingStartedAt || commandName !== "elementClick") return;
    try {
      const rect = await driver.getElementRect(args[0] as string);
      recordedTaps.push({
        atMs: Date.now() - recordingStartedAt,
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      });
    } catch {
      // A missing marker must never fail the test.
    }
  },

  /**
   * Capture one screenshot per test (pass or fail) into SCREENSHOT_DIR, named
   * by the test's full title so the filename is a stable visual-regression
   * baseline key. A failure here never fails the run.
   */
  afterTest: async function (test, _context, { passed }) {
    if (RECORD_VIDEO) {
      try {
        // Let the final transition finish rendering before the clip ends.
        await driver.pause(1500);
        const video = await driver.stopRecordingScreen();
        recordingStartedAt = 0;
        const feature = screenshotName("", test.parent) || "misc";
        const index = (testIndexByFeature.get(feature) ?? 0) + 1;
        testIndexByFeature.set(feature, index);
        const dir = path.join(RECORDING_DIR, feature);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(
          dir,
          `${String(index).padStart(2, "0")}-${screenshotName("", test.title)}.${passed ? "passed" : "failed"}.mp4`,
        );
        const rawFile = `${file}.raw.mp4`;
        fs.writeFileSync(rawFile, Buffer.from(video, "base64"));
        const label = { feature: test.parent, index, title: test.title, passed };
        if (labelRecording(rawFile, file, label, recordedTaps)) {
          fs.rmSync(rawFile);
        } else {
          fs.renameSync(rawFile, file);
        }
      } catch (err) {
        console.warn(
          `[afterTest] screen recording failed to save: ${(err as Error).message}`,
        );
      }
    }

    try {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      const file = path.join(
        SCREENSHOT_DIR,
        `${screenshotName(test.parent, test.title)}.png`,
      );
      await driver.saveScreenshot(file);
    } catch (err) {
      console.warn(
        `[afterTest] screenshot capture failed: ${(err as Error).message}`,
      );
    }
  },
};
