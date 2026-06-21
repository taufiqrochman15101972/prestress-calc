import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1050 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Click ULS tab
await page.click('button:has-text("ULS")');
await page.waitForTimeout(800);

// Screenshot full ULS tab (scroll to see interface shear section)
const leftPane = await page.$('[style*="52%"]');
if (leftPane) {
  await leftPane.evaluate(el => { el.scrollTop = 500; });
  await page.waitForTimeout(400);
}
await page.screenshot({ path: "ss-uls-interface.png", clip: { x: 235, y: 55, width: 610, height: 980 } });

await browser.close();
console.log("Done");
