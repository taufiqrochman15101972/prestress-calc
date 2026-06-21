import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(2000);

// Click ULS tab
await page.click('button:has-text("ULS")').catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: "ss-uls-detail.png", clip: { x: 235, y: 55, width: 610, height: 900 } });

// Scroll right panel for deflection chart
const panels = await page.$$('[style*="48%"]');
for (const p of panels) {
  await p.evaluate(el => { el.scrollTop = 500; }).catch(() => {});
}
await page.waitForTimeout(500);
await page.screenshot({ path: "ss-deflection-chart.png", clip: { x: 840, y: 55, width: 760, height: 900 } });

await browser.close();
console.log("Done");
