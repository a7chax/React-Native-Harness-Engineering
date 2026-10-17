import { playerScreen } from "../screens";
import type { Snapshot } from "../screens/PlayerScreen";
import { byTestId, byTextContains } from "../helpers/selectors";
import { APP, PLAYER } from "../data/testData";

const { dcye } = PLAYER;

/** Whole seconds shown by an `m:ss` label. */
const secondsOf = (label: string | null): number => {
  const m = /^(\d+):(\d\d)$/.exec(label ?? "");
  if (!m) throw new Error(`Not a time label: ${label}`);
  return Number(m[1]) * 60 + Number(m[2]);
};

/** dcye line start times in ms, for the lines the timed tests pass through. */
const DCYE_TIMES: Record<number, number> = { 5: 34080, 6: 37230, 7: 44590, 8: 48850, 9: 54360 };

const isCentred = (snap: Snapshot, index: number): boolean =>
  playerScreen.closestRowToCentre(snap) === index &&
  playerScreen.centreRatio(snap, index) >= 0.3 &&
  playerScreen.centreRatio(snap, index) <= 0.7;

/** Logs `dumpsys gfxinfo` frame counts. Report-only: no assertion depends on them. */
async function gfxinfo(action: "reset" | "dump"): Promise<void> {
  const out = (await driver.execute("mobile: shell", {
    command: "dumpsys",
    args: ["gfxinfo", APP.packageName, ...(action === "reset" ? ["reset"] : [])],
  })) as string;
  if (action === "dump") {
    const pick = (label: string) => new RegExp(`${label}: ([^\\n]+)`).exec(out)?.[1]?.trim() ?? "n/a";
    console.log(
      `[gfxinfo report-only] total frames: ${pick("Total frames rendered")}, janky: ${pick("Janky frames")}, ` +
        `p95: ${pick("95th percentile")}, slow UI thread: ${pick("Number Slow UI thread")}`,
    );
  }
}

describe("Player", () => {
  before(async () => {
    await playerScreen.disableIdleWait();
  });

  after(async () => {
    await playerScreen.restoreIdleWait();
    await driver.execute("mobile: terminateApp", { appId: APP.packageName });
  });

  // Positive cases

  it("opens a track by id with its title, artist, credit and lyrics, and no loading state", async () => {
    await playerScreen.open({ track: dcye.id, paused: true });

    const snap = await playerScreen.snapshot();
    expect(snap.rows.length).toBeGreaterThan(0);
    expect(await $(byTestId("loading")).isExisting()).toBe(false);
    expect(await playerScreen.title()).toEqual(dcye.title);
    expect(await playerScreen.artist()).toEqual(dcye.artist);
    expect(await playerScreen.creditText()).toEqual(dcye.credit);
  });

  it("opens paused at 0:41 with only line 6 selected and centred", async () => {
    await playerScreen.open({ track: dcye.id, at: 41000, paused: true });

    const snap = await playerScreen.waitForSnapshot((s) => isCentred(s, 6), 5000, "line 6 not centred");
    expect(snap.time).toEqual("0:41");
    expect(snap.button).toEqual("Play");
    expect(playerScreen.selectedLine(snap)).toEqual(6);
  });

  it("moves the position and highlight when a new link arrives, back to line 2 and then before the first line", async () => {
    await playerScreen.open({ track: dcye.id, at: 41000, paused: true });
    await playerScreen.waitForSnapshot((s) => playerScreen.selectedLine(s) === 6, 5000);

    await playerScreen.receive({ track: dcye.id, at: 21500, paused: true });
    // The label and the row's selected flag can reach the accessibility tree a
    // moment apart, so wait for both in the same reading.
    await playerScreen.waitForSnapshot(
      (s) => s.time === "0:21" && playerScreen.selectedLine(s) === 2,
      8000,
      "link to 0:21 did not select line 2",
    );

    await playerScreen.receive({ track: dcye.id, at: 5000, paused: true });
    const before = await playerScreen.waitForSnapshot(
      (s) => s.time === "0:05" && playerScreen.closestRowToCentre(s) === 0,
      8000,
      "line 0 not centred before the first line",
    );
    expect(playerScreen.selectedLine(before)).toEqual(-1);
  });

  it("re-applies the same link after Play", async () => {
    const link = { track: dcye.id, at: 41000, paused: true };
    await playerScreen.open(link);
    await playerScreen.toggle();
    await playerScreen.waitForSnapshot((s) => s.button === "Pause" && secondsOf(s.time) >= 42, 6000, "did not start playing");

    await playerScreen.receive(link);
    const snap = await playerScreen.waitForSnapshot((s) => s.button === "Play" && s.time === "0:41", 8000, "same link not re-applied");
    expect(playerScreen.selectedLine(snap)).toEqual(6);
  });

  it("selects nothing after the last line, and centres the first and last lines", async () => {
    await playerScreen.open({ track: dcye.id, at: 200000, paused: true });
    const after = await playerScreen.waitForSnapshot((s) => playerScreen.closestRowToCentre(s) === dcye.lastLine, 5000);
    expect(playerScreen.selectedLine(after)).toEqual(-1);

    await playerScreen.open({ track: dcye.id, at: 11000, paused: true });
    await playerScreen.waitForSnapshot((s) => isCentred(s, 0) && playerScreen.selectedLine(s) === 0, 5000, "line 0 not centred");

    await playerScreen.open({ track: dcye.id, at: 190000, paused: true });
    await playerScreen.waitForSnapshot(
      (s) => isCentred(s, dcye.lastLine) && playerScreen.selectedLine(s) === dcye.lastLine,
      5000,
      "last line not centred",
    );
  });

  it("plays from 0:35 through lines 5, 6 and 7 in order, centred, with the time label following", async () => {
    await playerScreen.open({ track: dcye.id, at: 35000, paused: true });
    const start = await playerScreen.waitForSnapshot((s) => playerScreen.selectedLine(s) === 5, 5000);
    expect(start.time).toEqual("0:35");

    await playerScreen.toggle();
    const tappedAt = Date.now();
    const seen: number[] = [];
    const activeAt: Record<number, number> = {};
    const centredAt: Record<number, number> = {};
    let last: Snapshot = start;
    while (Date.now() - tappedAt < 12000) {
      last = await playerScreen.snapshot();
      const now = Date.now();
      const line = playerScreen.selectedLine(last);
      if (line !== seen[seen.length - 1]) seen.push(line);
      if (activeAt[line] === undefined) activeAt[line] = now;
      const closest = playerScreen.closestRowToCentre(last);
      if (centredAt[closest] === undefined) centredAt[closest] = now;
    }

    expect(seen[0]).toEqual(5);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.indexOf(6)).toBeGreaterThan(seen.indexOf(5));
    expect(seen.indexOf(7)).toBeGreaterThan(seen.indexOf(6));
    for (const line of [6, 7]) {
      expect(centredAt[line]).toBeDefined();
      expect(centredAt[line] - activeAt[line]).toBeLessThanOrEqual(1000);
    }
    // Lower bound only: the emulator's audio clock runs faster than real time
    // (1.1-1.9x measured on Genymotion), so "0:47 give or take a second" holds
    // for the player's own position, which the FakePlayer RNTL tests check
    // exactly, but not against the wall clock here.
    const final = await playerScreen.snapshot();
    expect(secondsOf(final.time)).toBeGreaterThanOrEqual(46);
    expect(last.button).toEqual("Pause");
  });

  it("resumes from the paused position and keeps it when paused again", async () => {
    await playerScreen.open({ track: dcye.id, at: 41000, paused: true });
    await playerScreen.waitForSnapshot((s) => s.time === "0:41", 5000);

    await playerScreen.toggle();
    const resumed = await playerScreen.waitForSnapshot((s) => s.button === "Pause", 3000, "button did not show Pause");
    expect(["0:41", "0:42"]).toContain(resumed.time);
    await playerScreen.waitForSnapshot((s) => secondsOf(s.time) > 41, 2500, "time did not move past 0:41");
    let previous = 41;
    for (let i = 0; i < 3; i++) {
      const s = await playerScreen.snapshot();
      expect(secondsOf(s.time)).toBeGreaterThanOrEqual(previous);
      previous = secondsOf(s.time);
    }

    await playerScreen.toggle();
    const paused = await playerScreen.waitForSnapshot((s) => s.button === "Play", 3000, "button did not show Play");
    const pausedAt = paused.time;
    const until = Date.now() + 2000;
    while (Date.now() < until) {
      expect((await playerScreen.snapshot()).time).toEqual(pausedAt);
    }
  });

  it("does not auto-scroll while the user scrolls, does not seek on a drag, and re-centres at the next line", async () => {
    await playerScreen.open({ track: dcye.id, at: 41000, paused: true });
    await playerScreen.waitForSnapshot((s) => isCentred(s, 6), 5000);

    await playerScreen.swipeLyrics();
    const scrolled = await playerScreen.snapshot();
    const leftAt = playerScreen.closestRowToCentre(scrolled);
    expect(leftAt).not.toEqual(6);
    // A drag must not seek: the time stays put and no other line is selected.
    // The fling can carry line 6 off screen, where UiAutomator2 lists no row.
    expect(scrolled.time).toEqual("0:41");
    expect([6, -1]).toContain(playerScreen.selectedLine(scrolled));
    if (scrolled.rows.some((row) => row.index === 6)) {
      expect(playerScreen.selectedLine(scrolled)).toEqual(6);
    }
    await driver.pause(2000);
    expect(playerScreen.closestRowToCentre(await playerScreen.snapshot())).toEqual(leftAt);

    await playerScreen.toggle();
    const active7 = await playerScreen.waitForSnapshot((s) => playerScreen.selectedLine(s) === 7, 8000, "line 7 never became active");
    const activeAt = Date.now();
    if (playerScreen.closestRowToCentre(active7) !== 7) {
      await playerScreen.waitForSnapshot((s) => playerScreen.closestRowToCentre(s) === 7, 1500, "line 7 not re-centred");
    }
    expect(Date.now() - activeAt).toBeLessThanOrEqual(1500);
  });

  it("jumps to a tapped line while paused", async () => {
    await playerScreen.open({ track: dcye.id, at: 41000, paused: true });
    await playerScreen.waitForSnapshot((s) => playerScreen.selectedLine(s) === 6, 5000);

    await playerScreen.tapLine(9);
    const snap = await playerScreen.waitForSnapshot((s) => playerScreen.selectedLine(s) === 9, 5000, "line 9 not selected");
    expect(snap.time).toEqual("0:54");
    expect(snap.button).toEqual("Play");
    await playerScreen.waitForSnapshot((s) => playerScreen.closestRowToCentre(s) === 9, 2000, "line 9 not centred");
  });

  it("jumps to a tapped earlier line while playing", async () => {
    await playerScreen.open({ track: dcye.id, at: 41000, paused: true });
    await playerScreen.toggle();
    await playerScreen.waitForSnapshot((s) => s.button === "Pause" && secondsOf(s.time) >= 42, 6000, "did not start playing");

    await playerScreen.tapLine(2);
    const snap = await playerScreen.waitForSnapshot((s) => playerScreen.selectedLine(s) === 2, 5000, "line 2 not selected");
    expect(snap.button).toEqual("Pause");
    expect(secondsOf(snap.time)).toBeGreaterThanOrEqual(18);
    expect(secondsOf(snap.time)).toBeLessThanOrEqual(19);
    await playerScreen.waitForSnapshot((s) => playerScreen.closestRowToCentre(s) === 2, 2000, "line 2 not centred");
    await playerScreen.waitForSnapshot((s) => secondsOf(s.time) > 19, 3000, "playback did not continue from 0:18");
  });

  it("keeps the highlight moving while the JavaScript thread is stalled", async () => {
    await playerScreen.open({ track: dcye.id, at: 43000, stall: 6000 });
    await gfxinfo("reset");

    // One reading shows the UI-thread highlight on line 7 while the JS-driven
    // selected state is still line 6: only the UI thread can have moved it.
    await playerScreen.waitForSnapshot(
      (s) => playerScreen.closestRowToCentre(s) === 7 && playerScreen.selectedLine(s) === 6,
      9000,
      "never saw line 7 centred while line 6 was still selected",
    );

    const freed = await playerScreen.waitForSnapshot((s) => playerScreen.selectedLine(s) >= 7, 10000, "selection did not catch up");
    const ms = secondsOf(freed.time) * 1000;
    const expected = ms >= DCYE_TIMES[8] ? 8 : 7;
    expect([7, 8]).toContain(playerScreen.selectedLine(freed));
    expect(Math.abs(playerScreen.selectedLine(freed) - expected)).toBeLessThanOrEqual(1);
    await gfxinfo("dump");
  });

  it("switches tracks with the new lyrics at once", async () => {
    await playerScreen.open({ track: dcye.id, at: 41000, paused: true });
    await playerScreen.waitForSnapshot((s) => playerScreen.selectedLine(s) === 6, 5000);

    await playerScreen.receive({ track: PLAYER.lettingGo.id, paused: true });
    await driver.waitUntil(async () => (await playerScreen.title()) === PLAYER.lettingGo.title, {
      timeout: 8000,
      timeoutMsg: "title did not change to I'm Letting Go",
    });
    expect((await playerScreen.snapshot()).rows.length).toBeGreaterThan(0);
    expect(await $(byTextContains("Breaking into sweats")).isExisting()).toBe(true);
    expect(await $(byTextContains(dcye.lines[6])).isExisting()).toBe(false);
    expect(await $(byTestId("loading")).isExisting()).toBe(false);
  });

  it("shows the credits panel with the licence and song page links", async () => {
    await playerScreen.open({ track: dcye.id, at: 41000, paused: true });

    await playerScreen.openCredits();
    expect(await playerScreen.creditLinks()).toEqual({ license: dcye.licenseUrl, page: dcye.pageUrl });

    await $(byTestId("credits-license-link")).click();
    await driver.waitUntil(async () => (await driver.getCurrentPackage()) !== APP.packageName, {
      timeout: 10000,
      timeoutMsg: "the licence link did not open a browser",
    });
    // Let the browser finish opening, then go back to the app as a user would.
    // Back first walks the browser's own history, which differs between runs,
    // so press it until the app is in front; once the browser has settled,
    // activateApp is the fallback.
    await driver.pause(2000);
    for (let i = 0; i < 3 && (await driver.getCurrentPackage()) !== APP.packageName; i++) {
      await driver.back();
      await driver.pause(1000);
    }
    if ((await driver.getCurrentPackage()) !== APP.packageName) {
      await driver.execute("mobile: activateApp", { appId: APP.packageName });
    }
    await driver.waitUntil(async () => (await driver.getCurrentPackage()) === APP.packageName, {
      timeout: 10000,
      timeoutMsg: "could not return to the app from the browser",
    });
    await playerScreen.waitUntilLoaded();
    expect(await playerScreen.isShown("credits-panel")).toBe(true);

    await playerScreen.closeCredits();
    expect((await playerScreen.snapshot()).rows.length).toBeGreaterThan(0);
  });

  // Negative cases

  it("falls back to the first track for an unknown id", async () => {
    await playerScreen.open({ track: "does-not-exist", paused: true });

    expect(await playerScreen.title()).toEqual(dcye.title);
    expect(await playerScreen.isShown("player-screen")).toBe(true);
  });

  it("ignores invalid start positions and starts from 0:00", async () => {
    for (const at of ["-5", "abc", "999999999"]) {
      await playerScreen.open({ track: dcye.id, at, paused: true });
      const snap = await playerScreen.snapshot();
      expect(snap.time).toEqual("0:00");
      expect(snap.button).toEqual("Play");
      expect(await playerScreen.isShown("player-screen")).toBe(true);
    }
  });

  it("shows no lyrics for a track without them", async () => {
    await playerScreen.open({ track: PLAYER.tone.id, paused: true });

    expect(await playerScreen.emptyLyricsText()).toEqual(PLAYER.tone.noLyrics);
    const snap = await playerScreen.snapshot();
    expect(snap.rows.length).toEqual(0);
    expect(await $(byTestId("loading")).isExisting()).toBe(false);
  });
});
