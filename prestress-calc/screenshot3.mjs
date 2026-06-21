import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3500);

// Find and scroll the right visual panel
const rightPanel = await page.$('[style*="flex: 0 0 48%"]');
if (rightPanel) {
  // Scroll to stress distribution section
  await rightPanel.evaluate(el => el.scrollTop = 510);
}
await page.waitForTimeout(800);

// Crop just the stress distribution area
await page.screenshot({
  path: "screenshot-stress-closeup.png",
  clip: { x: 880, y: 350, width: 720, height: 420 }
});

// Also capture the full right panel by scrolling to top
if (rightPanel) {
  await rightPanel.evaluate(el => el.scrollTop = 0);
}
await page.waitForTimeout(500);
await page.screenshot({
  path: "screenshot-section-closeup.png",
  clip: { x: 880, y: 80, width: 720, height: 500 }
});

await browser.close();
console.log("Done");
