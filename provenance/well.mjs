// well.mjs <png> <x> <y0> <y1> — scratch readout: within one card's column, how many rows are the empty dark well (#11161d ±3) vs picture/caption.
import { readFileSync } from "node:fs"; import { inflateSync } from "node:zlib";
function decode(f){const b=readFileSync(f);let o=8,w,h,ct,d=[];while(o<b.length){const l=b.readUInt32BE(o),t=b.toString("ascii",o+4,o+8),x=b.subarray(o+8,o+8+l);if(t==="IHDR"){w=x.readUInt32BE(0);h=x.readUInt32BE(4);ct=x[9];}if(t==="IDAT")d.push(x);o+=12+l;}
const bpp=ct===6?4:3,r=inflateSync(Buffer.concat(d)),s=w*bpp,p=Buffer.alloc(w*h*bpp);for(let y=0;y<h;y++){const fl=r[y*(s+1)];for(let i=0;i<s;i++){const v=r[y*(s+1)+1+i],a=i>=bpp?p[y*s+i-bpp]:0,u=y?p[(y-1)*s+i]:0,c=y&&i>=bpp?p[(y-1)*s+i-bpp]:0,q=a+u-c,pa=Math.abs(q-a),pb=Math.abs(q-u),pc=Math.abs(q-c);p[y*s+i]=(v+[0,a,u,(a+u)>>1,pa<=pb&&pa<=pc?a:pb<=pc?u:c][fl])&255;}}
return {w,h,at:(x,y)=>[p[(y*w+x)*bpp],p[(y*w+x)*bpp+1],p[(y*w+x)*bpp+2]]};}
const [f, X0, Y0, Y1] = [process.argv[2], +process.argv[3], +process.argv[4], +process.argv[5]];
const img = decode(f);
const well = ([r,g,b]) => Math.abs(r-17) <= 3 && Math.abs(g-22) <= 3 && Math.abs(b-29) <= 3;
// a row is "well" when every sampled pixel across the card's inner width is the well colour
let wellRows = 0; for (let y = Y0; y < Y1; y++) { let all = true; for (let x = X0; x < X0 + 300; x += 10) if (!well(img.at(x, y))) { all = false; break; } if (all) wellRows++; }
console.log(f.split("/").slice(-2).join("/"), `card x=${X0}..${X0+300}, y=${Y0}..${Y1} (${Y1-Y0} px): ${wellRows} px of empty dark well`);
