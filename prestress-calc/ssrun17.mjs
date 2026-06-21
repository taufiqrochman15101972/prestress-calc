import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Open print report
await page.click('button:has-text("Laporan")');
await page.waitForTimeout(2500);

// Get new window/tab
const pages = browser.contexts()[0].pages();
console.log("Open pages:", pages.length);
const reportPage = pages[pages.length - 1];
await reportPage.waitForLoadState("domcontentloaded");
await reportPage.waitForTimeout(1500);

// Screenshot top of report
await reportPage.screenshot({ path: "ss-report-top.png", clip: { x: 0, y: 0, width: 900, height: 900 } });

// Scroll to section 13 (load balancing)
await reportPage.evaluate(() => { window.scrollTo(0, 3500); });
await reportPage.waitForTimeout(400);
await reportPage.screenshot({ path: "ss-report-mid.png", clip: { x: 0, y: 0, width: 900, height: 900 } });

// Scroll to bottom (sections 14-16)
await reportPage.evaluate(() => { window.scrollTo(0, 9999); });
await reportPage.waitForTimeout(400);
await reportPage.screenshot({ path: "ss-report-bottom.png", clip: { x: 0, y: 0, width: 900, height: 900 } });

await browser.close();
console.log("Done");
