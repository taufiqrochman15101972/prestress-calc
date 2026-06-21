import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 950 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Scroll right panel down to find Magnel diagram
const rightPanel = await page.$('[style*="48%"]');
if (rightPanel) {
  // Scroll to ~1200px to get past deflection chart
  await rightPanel.evaluate(el => { el.scrollTop = 1300; });
  await page.waitForTimeout(600);
}

// Get all SVGs visible on page
const svgs = await page.$$('svg');
console.log("Total SVGs:", svgs.length);
for (let i = 0; i < svgs.length; i++) {
  const box = await svgs[i].boundingBox();
  if (box && box.width > 200 && box.height > 100 && box.y >= 60 && box.y < 1000) {
    console.log(`SVG ${i}: y=${box.y.toFixed(0)} w=${box.width.toFixed(0)} h=${box.height.toFixed(0)}`);
  }
}

await page.screenshot({ path: "ss-magnel-scroll.png", clip: { x: 840, y: 60, width: 760, height: 880 } });

// Full page screenshot
await rightPanel?.evaluate(el => { el.scrollTop = 0; });
await page.waitForTimeout(300);
await page.screenshot({ path: "ss-full-new.png" });

await browser.close();
console.log("Done");
