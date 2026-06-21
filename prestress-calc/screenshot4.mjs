import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(4000);

// Full page
await page.screenshot({ path: "ss-full-new.png" });

// Closeup: just the stress diagram area (scroll right panel to diagram)
const rightPanel = await page.$('[style*="flex: 0 0 48%"]');
if (rightPanel) await rightPanel.evaluate(el => el.scrollTop = 500);
await page.waitForTimeout(800);

await page.screenshot({
  path: "ss-stress-new.png",
  clip: { x: 870, y: 60, width: 730, height: 560 }
});

// Scroll more to see moment + tendon profile
if (rightPanel) await rightPanel.evaluate(el => el.scrollTop = 920);
await page.waitForTimeout(800);
await page.screenshot({
  path: "ss-moment-tendon.png",
  clip: { x: 870, y: 60, width: 730, height: 560 }
});

await browser.close();
console.log("Done");
