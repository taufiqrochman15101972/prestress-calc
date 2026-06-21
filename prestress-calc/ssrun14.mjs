import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 2000 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

const panels = await page.$$('.overflow-y-auto, .overflow-y-scroll');
for (const p of panels) {
  await p.evaluate(el => { el.scrollTop = 9999; });
}
await page.waitForTimeout(600);

// Capture just the Tendon Zone section (around y=1150-1500 in the tall viewport)
await page.screenshot({ path: "ss-tendon-zone-close.png", clip: { x: 820, y: 1150, width: 780, height: 400 } });

// Also capture Magnel (around y=850-1150)
await page.screenshot({ path: "ss-magnel-close.png", clip: { x: 820, y: 820, width: 780, height: 350 } });

await browser.close();
console.log("Done");
