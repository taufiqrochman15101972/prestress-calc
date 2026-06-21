import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Scroll the right panel to show stress + moment diagrams
const rightPanel = await page.$('.overflow-y-auto');
if (rightPanel) {
  await rightPanel.evaluate(el => el.scrollTop = 520);
}

await page.waitForTimeout(1000);
await page.screenshot({ path: "screenshot-diagrams.png" });

// Scroll further to see moment and tendon profile diagrams
if (rightPanel) {
  await rightPanel.evaluate(el => el.scrollTop = 1200);
}
await page.waitForTimeout(800);
await page.screenshot({ path: "screenshot-diagrams2.png" });

// Scroll the right panel into view using its selector
const panels = await page.$$('[style*="flex: 0 0 48%"]');
for (const panel of panels) {
  await panel.evaluate(el => el.scrollTop = 600);
}
await page.waitForTimeout(800);
await page.screenshot({ path: "screenshot-stress-chart.png" });

await browser.close();
console.log("Done");
