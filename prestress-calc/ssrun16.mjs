import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Full app screenshot (header + layout)
await page.screenshot({ path: "ss-v2-full.png" });

// Click ULS tab and screenshot
await page.click('button:has-text("ULS")');
await page.waitForTimeout(600);

// Scroll left panel to bottom (ULS sections)
const leftPane = await page.$('.overflow-y-auto.p-4');
if (leftPane) {
  await leftPane.evaluate(el => { el.scrollTop = 2000; });
  await page.waitForTimeout(400);
}
await page.screenshot({ path: "ss-v2-uls.png", clip: { x: 0, y: 60, width: 860, height: 920 } });

await browser.close();
console.log("Done");
