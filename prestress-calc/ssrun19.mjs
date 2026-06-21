import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Toggle Kernel
await page.click('button:has-text("Kernel")');
await page.waitForTimeout(300);
// Open report
await page.click('button:has-text("Laporan")');
await page.waitForTimeout(2800);

const allPages = browser.contexts()[0].pages();
const reportPage = allPages[allPages.length - 1];
await reportPage.waitForLoadState("domcontentloaded");
await reportPage.waitForTimeout(1200);

// Measure total height
const height = await reportPage.evaluate(() => document.body.scrollHeight);
console.log("Report height:", height);

// Scroll to SLS section (~35-45% of page height)
await reportPage.evaluate((h) => { window.scrollTo(0, h * 0.38); }, height);
await reportPage.waitForTimeout(300);
await reportPage.screenshot({ path: "ss-report-sls2.png", clip: { x: 0, y: 0, width: 900, height: 900 } });

await browser.close();
console.log("Done");
