import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1050 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Full app screenshot
await page.screenshot({ path: "ss-full.png", fullPage: false });

// Scroll right panel to bottom to see Tendon Zone diagram
const rightPanel = await page.$('.overflow-y-auto');
if (rightPanel) {
  await rightPanel.evaluate(el => { el.scrollTop = 9999; });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: "ss-tendon-zone.png", clip: { x: 850, y: 0, width: 750, height: 1050 } });

await browser.close();
console.log("Done");
