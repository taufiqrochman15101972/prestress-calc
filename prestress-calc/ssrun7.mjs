import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1050 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Find right panel and scroll to Magnel diagram
const rightPanel = await page.$('[style*="48%"]');
if (rightPanel) {
  await rightPanel.evaluate(el => { el.scrollTop = 1700; });
  await page.waitForTimeout(600);
}

// Screenshot just the Magnel area
await page.screenshot({ path: "ss-magnel-full.png", clip: { x: 840, y: 60, width: 760, height: 980 } });

// Also grab with full right panel scrolled to show from lendutan to magnel to tendon
if (rightPanel) {
  await rightPanel.evaluate(el => { el.scrollTop = 900; });
  await page.waitForTimeout(400);
}
await page.screenshot({ path: "ss-panel-mid.png", clip: { x: 840, y: 60, width: 760, height: 980 } });

await browser.close();
console.log("Done");
