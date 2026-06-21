import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 950 });

const go = async (url, wait = 2000) => {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(wait);
};
const shot = async (name) => {
  await page.screenshot({ path: `ss_latest_${name}.png`, fullPage: false });
  console.log(`✓ ${name}`);
};
const click = async (sel) => {
  await page.click(sel).catch(() => {});
  await page.waitForTimeout(700);
};

// ── 1. Main page — SLS tab ───────────────────────────────────
await go("http://localhost:3000", 3000);
await shot("01-main-sls");

// ── 2. ULS tab ───────────────────────────────────────────────
await click('button:has-text("ULS")');
await page.waitForTimeout(500);
await shot("02-uls");

// ── 3. Kehilangan tab ────────────────────────────────────────
await click('button:has-text("Kehilangan")');
await shot("03-losses");

// ── 4. Lendutan tab ─────────────────────────────────────────
await click('button:has-text("Lendutan")');
await shot("04-deflection");

// ── 5. Kalkulator Tambahan modal → Tiang Pancang ────────────
await click('button:has-text("Kalkulator")');
await page.waitForTimeout(1000);
await shot("05-extra-pile");

// ── 6. Kolom tab ─────────────────────────────────────────────
await click('button:has-text("Kolom")');
await page.waitForTimeout(800);
await shot("06-extra-column");

// ── 7. Expand slenderness panel in Kolom ─────────────────────
await click('button:has-text("Kelangsingan")');
await page.waitForTimeout(600);
await shot("07-slenderness");

// ── 8. Pelat tab ─────────────────────────────────────────────
await click('button:has-text("Pelat")');
await page.waitForTimeout(800);
await shot("08-extra-slab");

// ── 9. Tangki tab ────────────────────────────────────────────
await click('button:has-text("Tangki")');
await page.waitForTimeout(800);
await shot("09-extra-tank");

// ── 10. Close modal, back to main ───────────────────────────
await click('button:has-text("Tutup")');
await page.waitForTimeout(500);

// ── 11. Section diagram close-up ─────────────────────────────
const diagram = await page.$("svg").catch(() => null);
if (diagram) {
  const box = await diagram.boundingBox();
  if (box) await page.screenshot({ path: "ss_latest_10-section-svg.png", clip: box });
  console.log("✓ 10-section-svg");
}

await browser.close();
console.log("All screenshots done.");
