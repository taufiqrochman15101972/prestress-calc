// Convert project DWG/DXF drawings → DXF text, then summarise their geometry.
// Run: node tools/dwgdump.mjs            (from the project root)
// Requires prestress-calc/node_modules/@mlightcad/libredwg-web.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");                       // Desain-Prategang
const PKG = join(ROOT, "prestress-calc", "node_modules", "@mlightcad", "libredwg-web", "dist", "libredwg-web.js");
const OUT = join(ROOT, "dxf_export");
if (!existsSync(OUT)) mkdirSync(OUT);

const mod = await import("file://" + PKG.replace(/\\/g, "/"));
const LibreDwg = mod.LibreDwg;
const lib = await LibreDwg.create();
console.log("LibreDWG loaded OK");

// ---- minimal DXF analyser (mirrors engine/dxfimport.ts) ----
function analyse(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const ents = []; let cur = null;
  const keep = new Set(["LINE","LWPOLYLINE","POLYLINE","CIRCLE","ARC","TEXT","MTEXT","DIMENSION","INSERT","SOLID","HATCH"]);
  for (let i=0;i+1<lines.length;i+=2){
    const code=parseInt(lines[i].trim(),10); const val=lines[i+1];
    if(isNaN(code)){i-=1;continue;}
    if(code===0){ if(cur)ents.push(cur); cur={type:val.trim(),layer:"0",codes:{}}; continue; }
    if(!cur)continue;
    if(code===8)cur.layer=val.trim();
    (cur.codes[code]??=[]).push(val.trim());
  }
  if(cur)ents.push(cur);
  const E=ents.filter(e=>keep.has(e.type));
  const num=(e,c,i=0)=>{const a=e.codes[c];return a&&a[i]!==undefined?parseFloat(a[i]):NaN;};
  const pts=[];
  for(const e of E){
    if(e.type==="LINE"){pts.push([num(e,10),num(e,20)],[num(e,11),num(e,21)]);}
    else if(e.type==="LWPOLYLINE"||e.type==="POLYLINE"){const xs=e.codes[10]||[],ys=e.codes[20]||[];for(let k=0;k<Math.min(xs.length,ys.length);k++)pts.push([+xs[k],+ys[k]]);}
    else if(e.type==="CIRCLE"||e.type==="ARC"){const cx=num(e,10),cy=num(e,20),r=num(e,40);if(!isNaN(r))pts.push([cx-r,cy-r],[cx+r,cy+r]);}
    else if(["TEXT","MTEXT","INSERT","SOLID"].includes(e.type))pts.push([num(e,10),num(e,20)]);
  }
  const good=pts.filter(p=>!isNaN(p[0])&&!isNaN(p[1]));
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const[x,y]of good){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  const counts={}; for(const e of E)counts[e.type]=(counts[e.type]||0)+1;
  const layers=[...new Set(E.map(e=>e.layer))];
  const texts=E.filter(e=>e.type==="TEXT"||e.type==="MTEXT").map(e=>(e.codes[1]?.join("")||"").replace(/\\[A-Za-z0-9.|]+;?/g,"").trim()).filter(t=>t.length>1);
  const dims=E.filter(e=>e.type==="DIMENSION").map(e=>num(e,42)).filter(v=>!isNaN(v)&&v>0);
  return {n:E.length,counts,layers,extents:{w:maxX-minX,h:maxY-minY},texts,dims};
}

const files = readdirSync(ROOT).filter(f=>/\.dwg$/i.test(f)).sort();
const KW = /(girder|gelagar|jembatan|bridge|abutment|abutmen|pier|pilar|pile|tiang|diaphragm|diafragma|deck|slab|span|bentang|prategang|tendon|strand|wing|frontwall|footing|poer|pilecap|pierhead|kepala|H *= *\d|L *= *\d|fc'|beton|mm|grade|BJ)/i;
let okCount=0;
const report=[];
for(const f of files){
  try{
    const buf=readFileSync(join(ROOT,f));
    const ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
    const out=lib.dwg_write_dxf(ab);
    if(!out){report.push(`✗ ${f}: konversi gagal`);continue;}
    const txt=new TextDecoder("utf-8").decode(out);
    writeFileSync(join(OUT,f.replace(/\.dwg$/i,".dxf")),txt);
    const a=analyse(txt);
    const kwTexts=a.texts.filter(t=>KW.test(t));
    okCount++;
    report.push(`✓ ${f} | ent=${a.n} layers=${a.layers.length} extents=${a.extents.w.toFixed(0)}×${a.extents.h.toFixed(0)} dims=${a.dims.length}`);
    report.push(`   layers: ${a.layers.slice(0,14).join(", ")}`);
    if(kwTexts.length)report.push(`   teks-kunci: ${[...new Set(kwTexts)].slice(0,18).join(" | ")}`);
  }catch(err){report.push(`✗ ${f}: ${err.message}`);}
}
console.log(`\n=== Converted ${okCount}/${files.length} DWG → DXF (saved to dxf_export/) ===\n`);
console.log(report.join("\n"));
