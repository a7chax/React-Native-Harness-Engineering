import { BaseScreen } from "./BaseScreen";
import { APP } from "../data/testData";

/** Deep-link parameters for reactnativeuitest://player (raw values pass through unvalidated). */
export type PlayerLink = {
  track?: string;
  at?: number | string;
  paused?: boolean;
  stall?: number;
};

type Bounds = { top: number; bottom: number; centre: number };
type Row = Bounds & { index: number; selected: boolean };

/** One reading of the screen, taken from a single page source. */
export type Snapshot = {
  view: Bounds | null;
  rows: Row[];
  time: string | null;
  button: string | null;
};

const attr = (node: string, name: string): string =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(node)?.[1] ?? "";

const boundsOf = (node: string): Bounds | null => {
  const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attr(node, "bounds"));
  if (!m) return null;
  const top = Number(m[2]);
  const bottom = Number(m[4]);
  return { top, bottom, centre: (top + bottom) / 2 };
};

export function playerLink({ track, at, paused, stall }: PlayerLink = {}): string {
  const query = [
    track !== undefined && `track=${encodeURIComponent(track)}`,
    at !== undefined && `at=${encodeURIComponent(String(at))}`,
    paused && "paused=1",
    stall !== undefined && `stall=${stall}`,
  ].filter(Boolean);
  return `reactnativeuitest://player${query.length ? `?${query.join("&")}` : ""}`;
}

/**
 * The Now Playing screen. While a track plays the screen never goes idle, so
 * specs must turn off UiAutomator2's idle wait (`disableIdleWait()`) and read
 * moving state from `snapshot()`, which takes everything from one page source.
 */
class PlayerScreen extends BaseScreen {
  readonly rootTestId = "player-screen";

  async disableIdleWait(): Promise<void> {
    await driver.updateSettings({ waitForIdleTimeout: 0 });
  }

  async restoreIdleWait(): Promise<void> {
    await driver.updateSettings({ waitForIdleTimeout: 10000 });
  }

  /** Cold start: the link is the launch intent, so every test begins from a known state. */
  async open(link: PlayerLink = {}): Promise<void> {
    await driver.execute("mobile: terminateApp", { appId: APP.packageName });
    await driver.execute("mobile: deepLink", {
      url: playerLink(link),
      package: APP.packageName,
      waitForLaunch: true,
    });
    await this.waitUntilLoaded(30000);
  }

  /** A link that arrives while the screen is already open. */
  async receive(link: PlayerLink): Promise<void> {
    await driver.execute("mobile: deepLink", {
      url: playerLink(link),
      package: APP.packageName,
      waitForLaunch: false,
    });
  }

  async snapshot(): Promise<Snapshot> {
    const source = await driver.getPageSource();
    const nodes = source.match(/<[a-zA-Z.]+ [^>]*>/g) ?? [];
    const rows: Row[] = [];
    let view: Bounds | null = null;
    let time: string | null = null;
    let button: string | null = null;
    for (const node of nodes) {
      const id = attr(node, "resource-id");
      const line = /^lyrics-line-(\d+)$/.exec(id);
      if (line) {
        const bounds = boundsOf(node);
        if (bounds) rows.push({ index: Number(line[1]), selected: attr(node, "selected") === "true", ...bounds });
      } else if (id === "lyrics-view") {
        view = boundsOf(node);
      } else if (id === "player-time") {
        time = attr(node, "text");
      } else if (["Play", "Pause"].includes(attr(node, "text"))) {
        button = attr(node, "text");
      }
    }
    return { view, rows, time, button };
  }

  /** Index of the one row reported as selected, -1 for none; throws if several are. */
  selectedLine(snap: Snapshot): number {
    const selected = snap.rows.filter((row) => row.selected).map((row) => row.index);
    if (selected.length > 1) throw new Error(`Several lines selected: ${selected.join(", ")}`);
    return selected[0] ?? -1;
  }

  /** Index of the row whose centre is closest to the lyrics view's centre. */
  closestRowToCentre(snap: Snapshot): number {
    const { view } = snap;
    if (!view) throw new Error("lyrics-view not found");
    let best = -1;
    let bestDistance = Infinity;
    for (const row of snap.rows) {
      const distance = Math.abs(row.centre - view.centre);
      if (distance < bestDistance) {
        best = row.index;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Where a row's centre sits in the lyrics view: 0 at the top edge, 1 at the bottom. */
  centreRatio(snap: Snapshot, index: number): number {
    const row = snap.rows.find((r) => r.index === index);
    if (!row || !snap.view) throw new Error(`Row ${index} or lyrics-view not on screen`);
    return (row.centre - snap.view.top) / (snap.view.bottom - snap.view.top);
  }

  /** Polls snapshots until `check` passes, returning the passing snapshot. */
  async waitForSnapshot(check: (snap: Snapshot) => boolean, timeout = 10000, message?: string): Promise<Snapshot> {
    let last: Snapshot | null = null;
    await driver.waitUntil(
      async () => {
        last = await this.snapshot();
        return check(last);
      },
      { timeout, interval: 300, timeoutMsg: message ?? "Player snapshot condition not met" },
    );
    return last as unknown as Snapshot;
  }

  async title(): Promise<string> {
    return this.textOf("player-title");
  }

  async artist(): Promise<string> {
    return this.textOf("player-artist");
  }

  /** The `m:ss` time label (one read; use `snapshot()` to compare it with other state). */
  async timeLabel(): Promise<string> {
    return this.textOf("player-time");
  }

  async toggle(): Promise<void> {
    await this.el("player-toggle").click();
  }

  async tapLine(index: number): Promise<void> {
    await this.el(`lyrics-line-${index}`).click();
  }

  /** Drags a finger up inside the lyrics view (reveals later lines), then lets the fling settle. */
  async swipeLyrics(): Promise<void> {
    const snap = await this.snapshot();
    if (!snap.view) throw new Error("lyrics-view not found");
    const { width } = await driver.getWindowSize();
    const x = Math.round(width / 2);
    const height = snap.view.bottom - snap.view.top;
    await driver
      .action("pointer", { parameters: { pointerType: "touch" } })
      .move({ x, y: Math.round(snap.view.top + height * 0.75) })
      .down()
      .pause(100)
      .move({ x, y: Math.round(snap.view.top + height * 0.3), duration: 500 })
      .pause(100)
      .up()
      .perform();
    await driver.pause(1200);
  }

  async creditText(): Promise<string> {
    const text = $(`//*[@resource-id="player-credit"]//android.widget.TextView | //*[@resource-id="player-credit"]/following-sibling::android.widget.TextView[1]`);
    await text.waitForDisplayed({ timeout: 15000 });
    return text.getText();
  }

  async openCredits(): Promise<void> {
    await this.el("player-credit").click();
    await this.el("credits-panel").waitForDisplayed({ timeout: 10000 });
  }

  async creditLinks(): Promise<{ license: string; page: string }> {
    return { license: await this.textOf("credits-license-link"), page: await this.textOf("credits-page-link") };
  }

  async closeCredits(): Promise<void> {
    await this.el("credits-close").click();
    // Look the panel up again on every poll: waitForDisplayed({ reverse }) keeps
    // asking about the element found before the tap, and UiAutomator2 still
    // reports that removed view as displayed.
    await driver.waitUntil(async () => !(await this.isShown("credits-panel")), {
      timeout: 10000,
      timeoutMsg: "credits panel did not close",
    });
  }

  async emptyLyricsText(): Promise<string> {
    return this.textOf("lyrics-empty");
  }
}

export default new PlayerScreen();
