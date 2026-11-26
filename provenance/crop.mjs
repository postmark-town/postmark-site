// crop.mjs <in.png> <out.png> <y0> <y1> — scratch: a horizontal band of site-prep's own frame, re-encoded losslessly (no scaling, no edits).
import { readFileSync, writeFileSync } from "node:fs"; import { inflateSync, deflateSync } from "node:zlib";
function decode(f){const b=readFileSync(f);let o=8,w,h,ct,d=[];while(o<b.length){const l=b.readUInt32BE(o),t=b.toString("ascii",o+4,o+8),x=b.subarray(o+8,o+8+l);if(t==="IHDR"){w=x.readUInt32BE(0);h=x.readUInt32BE(4);ct=x[9];}if(t==="IDAT")d.push(x);o+=12+l;}
const bpp=ct===6?4:3,r=inflateSync(Buffer.concat(d)),s=w*bpp,p=Buffer.alloc(w*h*bpp);for(let y=0;y<h;y++){const fl=r[y*(s+1)];for(let i=0;i<s;i++){const v=r[y*(s+1)+1+i],a=i>=bpp?p[y*s+i-bpp]:0,u=y?p[(y-1)*s+i]:0,c=y&&i>=bpp?p[(y-1)*s+i-bpp]:0,q=a+u-c,pa=Math.abs(q-a),pb=Math.abs(q-u),pc=Math.abs(q-c);p[y*s+i]=(v+[0,a,u,(a+u)>>1,pa<=pb&&pa<=pc?a:pb<=pc?u:c][fl])&255;}}
return {w,h,bpp,ct,p};}
const [inp, out, y0, y1] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5]];
const im = decode(inp), H = Math.min(y1, im.h) - y0, s = im.w * im.bpp;
const raw = Buffer.alloc((s + 1) * H); for (let y = 0; y < H; y++) { raw[y * (s + 1)] = 0; im.p.copy(raw, y * (s + 1) + 1, (y0 + y) * s, (y0 + y + 1) * s); }
const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(im.w, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = im.ct;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(`${out.split("/").pop()}: ${im.w}x${H} from y=${y0}`);
