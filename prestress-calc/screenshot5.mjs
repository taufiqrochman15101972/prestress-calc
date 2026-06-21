import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(4000);

const rightPanel = await page.$('[style*="flex: 0 0 48%"]');

// Screenshot the stress diagram fully
if (rightPanel) await rightPanel.evaluate(el => el.scrollTop = 490);
await page.waitForTimeout(600);
await page.screenshot({ path: "ss-stress-full.png",
  clip: { x: 870, y: 55, width: 730, height: 840 } });

// Just the stress chart (no section diagram above)
if (rightPanel) await rightPanel.evaluate(el => el.scrollTop = 490);
await page.waitForTimeout(600);
// Get bounding box of stress svg element
const stressSvg = await page.$('svg[viewBox="0 0 560 420"]');
if (stressSvg) {
  const box = await stressSvg.boundingBox();
  if (box) {
    await page.screenshot({ path: "ss-stress-only.png",
      clip: { x: box.x - 5, y: box.y - 5, width: box.width + 10, height: box.height + 10 }
    });
  }
}

await browser.close();
console.log("Done");
