import { loginScreen, homeScreen } from "../screens";
import { launchAppFresh } from "../helpers/app";
import { MESSAGES, STORED, VALID_LOGIN } from "../data/testData";

describe("Home", () => {
  beforeEach(async () => {
    await launchAppFresh();
    await loginScreen.waitUntilLoaded();
    await loginScreen.login(VALID_LOGIN.email, VALID_LOGIN.password);
    await homeScreen.waitUntilLoaded();
  });

  it("displays the welcome message", async () => {
    expect(await homeScreen.welcomeText()).toEqual(MESSAGES.home.welcome);
  });

  it("shows the encrypted values seeded into MMKV", async () => {
    expect(await homeScreen.sectionTitle("encrypted")).toEqual(
      `Encrypted (${STORED.encrypted.count})`
    );
    expect(await homeScreen.storedValue("encrypted", "userId")).toEqual(
      STORED.encrypted.userId
    );
    expect(await homeScreen.storedValue("encrypted", "cardLast4")).toEqual(
      STORED.encrypted.cardLast4
    );
  });

  it("shows the plain preferences seeded into MMKV", async () => {
    expect(await homeScreen.sectionTitle("plain")).toEqual(
      `Plain (${STORED.plain.count})`
    );
    expect(await homeScreen.storedValue("plain", "theme")).toEqual(
      STORED.plain.theme
    );
    expect(await homeScreen.storedValue("plain", "currency")).toEqual(
      STORED.plain.currency
    );
  });

  it("scrolls down to the bottom of the page and back up", async () => {
    const welcomeTop = await homeScreen.topOf("home-welcome");
    // The Log out button starts cut off by the bottom edge of the screen.
    const logoutHeight = await homeScreen.visibleHeightOf("logout-button");

    await homeScreen.scrollDown();

    expect(await homeScreen.topOf("home-welcome")).toBeLessThan(welcomeTop);
    expect(await homeScreen.visibleHeightOf("logout-button")).toBeGreaterThan(
      logoutHeight
    );
    expect(await homeScreen.storedValue("plain", "appVersion")).toEqual(
      STORED.plain.appVersion
    );

    await homeScreen.scrollUp();

    expect(await homeScreen.topOf("home-welcome")).toEqual(welcomeTop);
  });

  it("returns to Login after logging out", async () => {
    await homeScreen.logout();

    await loginScreen.waitUntilLoaded();
    await expect(loginScreen.root).toBeDisplayed();
  });
});
