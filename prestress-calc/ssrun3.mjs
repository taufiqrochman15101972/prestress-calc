import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

// Capture header area
await page.screenshot({ path: "ss-header.png", clip: { x: 0, y: 0, width: 1600, height: 80 } });

// Capture full page
await page.screenshot({ path: "ss-full.png" });

await browser.close();
console.log("Done");
