import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1050 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

await page.click('button:has-text("ULS")');
await page.waitForTimeout(600);

// Scroll left panel to interface shear section
const leftPane = await page.$('.flex-col.overflow-hidden.min-w-0');
// find the scrollable content area
const contentArea = await page.$('.flex-1.overflow-y-auto.p-4');
if (contentArea) {
  await contentArea.evaluate(el => { el.scrollTop = 900; });
  await page.waitForTimeout(400);
}

await page.screenshot({ path: "ss-interface-detail.png", clip: { x: 235, y: 55, width: 610, height: 980 } });

await browser.close();
console.log("Done");
