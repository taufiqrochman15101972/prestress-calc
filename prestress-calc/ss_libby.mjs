import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1600, height: 1000 });
const shot = async (n, clip) => { await page.screenshot({ path: `libby_${n}.png`, ...(clip?{clip}:{}) }); console.log("✓", n); };
const click = async (s) => { await page.click(s).catch(()=>{}); await page.waitForTimeout(600); };
const MID = { x: 278, y: 75, width: 690, height: 900 };

await page.goto("http://localhost:3001", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2500);

// ULS tab → scroll to the new Libby sections
await click('button:has-text("ULS")');
await page.waitForTimeout(400);
const scrollTo = async (txt) => {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('p')].find(p=>p.textContent && p.textContent.includes(t));
    if (el) el.scrollIntoView({block:'start'});
  }, txt);
  await page.waitForTimeout(500);
};
await scrollTo("Desain Pendahuluan");
await shot("01-preliminary-cline", MID);
await scrollTo("Gradien Suhu");
await shot("02-thermal-elongation", MID);

// Extra calculators modal — dapped end & bearing
await click('button:has-text("Kalkulator")');
await page.waitForTimeout(700);
await click('button:has-text("Dapped-End")');
await page.waitForTimeout(600);
await shot("03-dapped-end", { x: 380, y: 150, width: 880, height: 560 });
await click('button:has-text("Bantalan")');
await page.waitForTimeout(600);
await shot("04-bearing", { x: 380, y: 150, width: 880, height: 560 });
await page.keyboard.press("Escape").catch(()=>{});

// Report — capture new sections 26-29
await page.waitForTimeout(400);
const [popup] = await Promise.all([
  page.context().waitForEvent("page").catch(()=>null),
  page.click('button:has-text("Laporan")').catch(()=>{}),
]);
if (popup) {
  await popup.waitForLoadState("networkidle").catch(()=>{});
  await popup.setViewportSize({ width: 1000, height: 1180 });
  await popup.waitForTimeout(900);
  const goto = async (txt, name) => {
    await popup.evaluate((t) => { const h = [...document.querySelectorAll('*')].find(e=>e.children.length===0 && e.textContent && e.textContent.trim().startsWith(t)); if (h) h.scrollIntoView({block:'start'}); }, txt);
    await popup.waitForTimeout(450);
    await popup.screenshot({ path: `libby_${name}.png` });
    console.log("✓", name);
  };
  await goto("26. Desain Pendahuluan", "05-report-prelim-cline");
  await goto("28. Tegangan Gradien Suhu", "06-report-thermal-elong");
  await popup.close();
}
await browser.close();
console.log("done");
