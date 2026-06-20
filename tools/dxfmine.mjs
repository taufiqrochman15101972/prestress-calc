// Mine specific converted DXF files for dimension values, key texts, and the
// girder cross-section bbox — to learn real DED geometry.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function ents(text){
  const lines=text.split(/\r\n|\r|\n/); const E=[]; let cur=null;
  for(let i=0;i+1<lines.length;i+=2){const c=parseInt(lines[i].trim(),10);const v=lines[i+1];
    if(isNaN(c)){i-=1;continue;} if(c===0){if(cur)E.push(cur);cur={t:v.trim(),c:{}};continue;}
    if(!cur)continue;(cur.c[c]??=[]).push(v.trim());}
  if(cur)E.push(cur); return E;
}
const num=(e,c,i=0)=>{const a=e.c[c];return a&&a[i]!==undefined?parseFloat(a[i]):NaN;};

for(const fn of ["154.dxf","DET-POND-kaltim.dxf","02.dxf"]){
  const txt=readFileSync(join(ROOT,"dxf_export",fn),"utf-8");
  const E=ents(txt);
  // dimension values
  const dims=E.filter(e=>e.t==="DIMENSION").map(e=>num(e,42)).filter(v=>!isNaN(v)&&v>0).map(v=>Math.round(v));
  const freq={}; for(const d of dims)freq[d]=(freq[d]||0)+1;
  const common=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20);
  // tall closed polylines (girder/pier section candidates)
  const boxes=E.filter(e=>e.t==="LWPOLYLINE"||e.t==="POLYLINE").map(e=>{
    const xs=(e.c[10]||[]).map(Number),ys=(e.c[20]||[]).map(Number);
    if(!xs.length)return null; const w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
    return {w:Math.round(w),h:Math.round(h)};
  }).filter(b=>b&&b.h>500&&b.w>100).sort((a,b)=>b.h-a.h).slice(0,8);
  console.log(`\n===== ${fn} =====`);
  console.log("dim values (mm) freq top:", common.map(([v,n])=>`${v}×${n}`).join("  "));
  console.log("tall section boxes (w×h):", boxes.map(b=>`${b.w}×${b.h}`).join("  "));
}
