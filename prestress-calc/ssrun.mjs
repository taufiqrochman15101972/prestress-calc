import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 20000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: "ss-run1.png" });

// Click Kehilangan tab
await page.click('button:has-text("Kehilangan")').catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: "ss-run2-losses.png" });

// Click ULS tab
await page.click('button:has-text("ULS")').catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: "ss-run3-uls.png" });

await browser.close();
console.log("Done");
