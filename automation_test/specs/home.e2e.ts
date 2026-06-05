import { loginScreen, homeScreen } from "../screens";
import { launchAppFresh } from "../helpers/app";
import { MESSAGES, VALID_LOGIN } from "../data/testData";

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

  it("returns to Login after logging out", async () => {
    await homeScreen.logout();

    await loginScreen.waitUntilLoaded();
    await expect(loginScreen.root).toBeDisplayed();
  });
});
