import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1050 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// ULS tab
await page.click('button:has-text("ULS")');
await page.waitForTimeout(800);
await page.screenshot({ path: "ss-uls-new.png", clip: { x: 235, y: 55, width: 610, height: 980 } });

// Magnel diagram
const rightPanel = await page.$('[style*="48%"]');
if (rightPanel) {
  await rightPanel.evaluate(el => { el.scrollTop = 1700; });
  await page.waitForTimeout(500);
}
await page.screenshot({ path: "ss-magnel-new.png", clip: { x: 840, y: 55, width: 760, height: 500 } });

await browser.close();
console.log("Done");
