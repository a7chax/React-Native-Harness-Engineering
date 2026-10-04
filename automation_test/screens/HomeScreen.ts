import { BaseScreen } from "./BaseScreen";
import { swipe } from "../helpers/gestures";

type StorageKind = "encrypted" | "plain";

/**
 * The nth text belonging to the element with this testID (1-based, Android).
 * Appium's UiAutomator2 source flattens these React Native views: the texts
 * appear as siblings right after their container rather than nested inside it.
 */
const nthText = (testId: string, n: number) =>
  `//*[@resource-id="${testId}"]/following-sibling::android.widget.TextView[${n}]`;

class HomeScreen extends BaseScreen {
  readonly rootTestId = "home-screen";

  async welcomeText(): Promise<string> {
    return this.textOf("home-welcome");
  }

  /** Section heading, e.g. "Encrypted (10)". */
  async sectionTitle(kind: StorageKind): Promise<string> {
    const heading = $(nthText(`mmkv-${kind}-section`, 1));
    await heading.waitForDisplayed({ timeout: 15000 });
    return heading.getText();
  }

  /** The value shown next to `key` in the given MMKV section. */
  async storedValue(kind: StorageKind, key: string): Promise<string> {
    const value = $(nthText(`mmkv-${kind}-${key}`, 2));
    await value.waitForDisplayed({ timeout: 15000 });
    return value.getText();
  }

  /** Top edge of an element in screen pixels — moves when the page scrolls. */
  async topOf(testId: string): Promise<number> {
    return (await this.el(testId).getLocation()).y;
  }

  /**
   * On-screen height of an element. Android clips reported bounds to the
   * screen, so this grows as a partly hidden element scrolls into view.
   */
  async visibleHeightOf(testId: string): Promise<number> {
    return (await this.el(testId).getSize()).height;
  }

  async scrollDown(): Promise<void> {
    await swipe("up");
  }

  async scrollUp(): Promise<void> {
    await swipe("down");
  }

  async logout(): Promise<void> {
    // The button sits at the very bottom of the page; scroll it fully into view
    // first, as a user would.
    await this.scrollDown();
    const button = this.el("logout-button");
    await button.waitForDisplayed({ timeout: 15000 });
    await button.click();
  }
}

export default new HomeScreen();
