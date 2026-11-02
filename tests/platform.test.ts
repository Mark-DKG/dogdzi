import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMobileOS, installMethod, isIOSSafariUA } from "../src/lib/platform";

const IOS_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IOS_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const DESKTOP_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const DESKTOP_FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";

test("detects iOS (including iPadOS desktop-mode UA) and Android", () => {
  assert.equal(detectMobileOS(IOS_SAFARI), "ios");
  assert.equal(detectMobileOS(IPAD_DESKTOP_UA, 5), "ios");
  assert.equal(detectMobileOS(IPAD_DESKTOP_UA, 0), "other");
  assert.equal(detectMobileOS(ANDROID_CHROME), "android");
  assert.equal(isIOSSafariUA(IOS_SAFARI), true);
  assert.equal(isIOSSafariUA(IOS_CHROME), false);
});

test("install guidance matches the device", () => {
  const base = { standalone: false, native: false, hasPrompt: false };
  assert.equal(installMethod({ ...base, ua: IOS_SAFARI }), "ios-safari");
  assert.equal(installMethod({ ...base, ua: IOS_CHROME }), "ios-other");
  assert.equal(installMethod({ ...base, ua: ANDROID_CHROME }), "android-menu");
  assert.equal(installMethod({ ...base, ua: ANDROID_CHROME, hasPrompt: true }), "prompt");
  assert.equal(installMethod({ ...base, ua: DESKTOP_CHROME }), "desktop-menu");
  assert.equal(installMethod({ ...base, ua: DESKTOP_FIREFOX }), "unsupported");
  assert.equal(installMethod({ ...base, ua: IOS_SAFARI, standalone: true }), "installed");
  assert.equal(installMethod({ ...base, ua: ANDROID_CHROME, native: true, hasPrompt: true }), "installed", "never offer web install inside the native app");
});
