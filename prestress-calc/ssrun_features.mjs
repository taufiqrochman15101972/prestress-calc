import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const shot = async (n, clip) => { await page.screenshot({ path: `feat_${n}.png`, ...(clip?{clip}:{}) }); console.log("✓", n); };
const click = async (s) => { await page.click(s).catch(()=>{}); await page.waitForTimeout(800); };
// middle results column clip
const MID = { x: 278, y: 75, width: 670, height: 880 };

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

// 1. Full app with trapezoidal girder
await shot("01-app-trapezoidal");

// 2. Section diagram close-up (right column)
await shot("02-girder-diagram", { x: 950, y: 90, width: 640, height: 860 });

// 3. Penampang tab — efficiency & kern
await click('button:has-text("Penampang")');
await shot("03-efficiency-kern", MID);

// 4. ULS tab — flexural stages (scroll to it)
await click('button:has-text("ULS")');
await page.waitForTimeout(500);
await shot("04-uls-flexure-stages", MID);

// 5. ULS — scroll down to MCFT shear
await page.evaluate(() => { const el = [...document.querySelectorAll('p')].find(p=>p.textContent.includes('Compression Field')); if (el) el.scrollIntoView({block:'start'}); });
await page.waitForTimeout(500);
await shot("05-mcft-shear", MID);

// 6. Extra calculators — Tension
await click('button:has-text("Kalkulator")');
await page.waitForTimeout(1000);
await click('button:has-text("Batang Tarik")');
await page.waitForTimeout(700);
await shot("06-tension-member");

// 7. Corbel
await click('button:has-text("Korbel")');
await page.waitForTimeout(700);
await shot("07-corbel");

// 8. Slab moment transfer — scroll modal content to bottom
await click('button:has-text("Pelat")');
await page.waitForTimeout(700);
await page.evaluate(() => { const m = document.querySelector('.overflow-y-auto'); if (m) m.scrollTop = m.scrollHeight; });
await page.waitForTimeout(500);
await shot("08-slab-moment-transfer");
await click('button:has-text("Tutup")');

// 9. Print report — open and capture new sections §21-24
await page.evaluate(() => window.scrollTo(0,0));
const [popup] = await Promise.all([
  page.context().waitForEvent("page").catch(()=>null),
  page.click('button:has-text("Laporan")').catch(()=>{}),
]);
if (popup) {
  await popup.waitForLoadState("networkidle").catch(()=>{});
  await popup.setViewportSize({ width: 1000, height: 1100 });
  await popup.waitForTimeout(800);
  // find §21 section heading and scroll to it
  await popup.evaluate(() => { const h = [...document.querySelectorAll('*')].find(e=>e.textContent && e.textContent.trim().startsWith('21. Tahapan Lentur')); if (h) h.scrollIntoView({block:'start'}); });
  await popup.waitForTimeout(500);
  await popup.screenshot({ path: "feat_09-report-s21-22.png" });
  console.log("✓ 09-report-s21-22");
  await popup.evaluate(() => { const h = [...document.querySelectorAll('*')].find(e=>e.textContent && e.textContent.trim().startsWith('24. Estimasi')); if (h) h.scrollIntoView({block:'start'}); });
  await popup.waitForTimeout(500);
  await popup.screenshot({ path: "feat_10-report-s23-24.png" });
  console.log("✓ 10-report-s23-24");
  await popup.close();
} else {
  console.log("⚠ report popup not captured");
}

await browser.close();
console.log("done");
