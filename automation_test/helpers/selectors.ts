/**
 * Selector builders that translate React Native testID / visible text into the
 * appropriate WebdriverIO selector string for the current platform.
 *
 * Android (UiAutomator2): a React Native testID maps to the native resource-id
 * (exact string, no package prefix). We therefore match by resource-id so the
 * same helper works for container Views, Text nodes AND interactive elements.
 * Relying on accessibility-id (~) would miss the container/Text/error nodes that
 * only set testID.
 *
 * iOS: testID maps to the accessibility id, so the `~id` strategy is correct.
 */

/**
 * Match an element by its React Native testID.
 * - Android: resource-id via UiSelector (works for containers and inputs alike).
 * - iOS: accessibility id.
 */
export function byTestId(id: string): string {
  if (driver.isIOS) {
    return `~${id}`;
  }
  return `android=new UiSelector().resourceId("${id}")`;
}

/**
 * Match an element by its exact visible text.
 * - Android: XPath on @text (JSON.stringify yields a double-quoted literal;
 *   none of the app strings contain a double-quote).
 * - iOS: predicate string matching label/name/value exactly.
 */
export function byText(text: string): string {
  if (driver.isIOS) {
    const json = JSON.stringify(text);
    return `-ios predicate string:label == ${json} OR name == ${json} OR value == ${json}`;
  }
  return `//*[@text=${JSON.stringify(text)}]`;
}

/**
 * Match an element whose visible text contains the given substring.
 * - Android: UiSelector().textContains.
 * - iOS: predicate string CONTAINS on label/name/value.
 */
export function byTextContains(text: string): string {
  if (driver.isIOS) {
    const json = JSON.stringify(text);
    return `-ios predicate string:label CONTAINS ${json} OR name CONTAINS ${json} OR value CONTAINS ${json}`;
  }
  return `android=new UiSelector().textContains("${text}")`;
}

/**
 * Selector that scrolls an element (by testID) into view when resolved.
 * - Android: UiScrollable scrollIntoView targeting the resource-id.
 * - iOS: there is no equivalent scroll-on-resolve selector, so return a plain
 *   accessibility-id fallback (callers treat scrolling as a no-op on iOS).
 */
export function scrollToTestId(id: string): string {
  if (driver.isIOS) {
    return `~${id}`;
  }
  return `android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().resourceId("${id}"))`;
}
