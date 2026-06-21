import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe", headless:true, args:["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1500, height: 1000 });
const click = async (s)=>{ await page.click(s).catch(()=>{}); await page.waitForTimeout(800); };
await page.goto("http://localhost:3000",{waitUntil:"networkidle",timeout:30000});
await page.waitForTimeout(2200);
await click('button:has-text("Kalkulator")');
await page.waitForTimeout(800);
async function modalShot(name){
  const modal = await page.$('.relative.bg-white.rounded-xl');
  if(modal){ const b = await modal.boundingBox(); await page.screenshot({path:name, clip:b}); }
  else await page.screenshot({path:name});
  console.log("✓",name);
}
await click('button:has-text("Batang Tarik")'); await page.waitForTimeout(700); await modalShot("modal_tension.png");
await click('button:has-text("Korbel")'); await page.waitForTimeout(700); await modalShot("modal_corbel.png");
await browser.close(); console.log("done");
