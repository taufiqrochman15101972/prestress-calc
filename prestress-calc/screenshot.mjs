import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Full HD viewport
await page.setViewportSize({ width: 1600, height: 900 });

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });

// Wait for charts to render
await page.waitForTimeout(3000);

await page.screenshot({
  path: "screenshot-full.png",
  fullPage: false,
});

// Scroll right panel to show diagrams
await page.screenshot({
  path: "screenshot-full-2.png",
  clip: { x: 268, y: 0, width: 1332, height: 900 },
});

// Click SLS tab
await page.click('button:has-text("SLS")');
await page.waitForTimeout(500);
await page.screenshot({ path: "screenshot-sls.png" });

// Click ULS tab
await page.click('button:has-text("ULS")');
await page.waitForTimeout(500);
await page.screenshot({ path: "screenshot-uls.png" });

await browser.close();
console.log("Screenshots saved.");
