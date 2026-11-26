// rowheight.mjs <png> <x> <yStart> — scratch readout on site-prep's own frame: walk down column x from yStart (inside the first card) and report where the
// card ends (the first run of >= 8 px of page background, darker than any card surface), i.e. the first row's rendered bottom.
import { readFileSync } from "node:fs"; import { inflateSync } from "node:zlib";
function decode(f){const b=readFileSync(f);let o=8,w,h,ct,d=[];while(o<b.length){const l=b.readUInt32BE(o),t=b.toString("ascii",o+4,o+8),x=b.subarray(o+8,o+8+l);if(t==="IHDR"){w=x.readUInt32BE(0);h=x.readUInt32BE(4);ct=x[9];}if(t==="IDAT")d.push(x);o+=12+l;}
const bpp=ct===6?4:3,r=inflateSync(Buffer.concat(d)),s=w*bpp,p=Buffer.alloc(w*h*bpp);for(let y=0;y<h;y++){const fl=r[y*(s+1)];for(let i=0;i<s;i++){const v=r[y*(s+1)+1+i],a=i>=bpp?p[y*s+i-bpp]:0,u=y?p[(y-1)*s+i]:0,c=y&&i>=bpp?p[(y-1)*s+i-bpp]:0,q=a+u-c,pa=Math.abs(q-a),pb=Math.abs(q-u),pc=Math.abs(q-c);p[y*s+i]=(v+[0,a,u,(a+u)>>1,pa<=pb&&pa<=pc?a:pb<=pc?u:c][fl])&255;}}
return {w,h,at:(x,y)=>[p[(y*w+x)*bpp],p[(y*w+x)*bpp+1],p[(y*w+x)*bpp+2]]};}
const [f, X, Y0] = [process.argv[2], +process.argv[3], +process.argv[4]];
const img = decode(f);
// the page's night backdrop between rows is darker/bluer than the card's dark well (#11161d) and its paper caption
const bg = ([r,g,b]) => r < 16 && g < 22 && b >= r && b < 50 && !(r === 17 && g === 22);
let run = 0, end = null;
for (let y = Y0; y < img.h; y++) { if (bg(img.at(X, y))) { if (++run >= 8) { end = y - 7; break; } } else run = 0; }
console.log(f.split("/").slice(-2).join("/"), `column x=${X}: first card from y=${Y0} ends at y=${end} → ${end - Y0} px`);
