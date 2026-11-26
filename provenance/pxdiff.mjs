import { readFileSync } from "node:fs"; import { inflateSync } from "node:zlib";
function raw(f){const b=readFileSync(f);let o=8,w,h,ct,d=[];while(o<b.length){const l=b.readUInt32BE(o),t=b.toString("ascii",o+4,o+8),x=b.subarray(o+8,o+8+l);if(t==="IHDR"){w=x.readUInt32BE(0);h=x.readUInt32BE(4);ct=x[9];}if(t==="IDAT")d.push(x);o+=12+l;}
const bpp=ct===6?4:3,r=inflateSync(Buffer.concat(d)),s=w*bpp,p=Buffer.alloc(w*h*bpp);for(let y=0;y<h;y++){const f=r[y*(s+1)];for(let i=0;i<s;i++){const v=r[y*(s+1)+1+i],a=i>=bpp?p[y*s+i-bpp]:0,u=y?p[(y-1)*s+i]:0,c=y&&i>=bpp?p[(y-1)*s+i-bpp]:0,q=a+u-c,pa=Math.abs(q-a),pb=Math.abs(q-u),pc=Math.abs(q-c);p[y*s+i]=(v+[0,a,u,(a+u)>>1,pa<=pb&&pa<=pc?a:pb<=pc?u:c][f])&255;}}return{w,h,p};}
for (const n of process.argv.slice(3)) { const a=raw(`${process.argv[2]}/before/${n}`), b=raw(`${process.argv[2]}/after2/${n}`);
  let diff=0; if(a.w===b.w&&a.h===b.h) for(let i=0;i<a.p.length;i++) if(a.p[i]!==b.p[i]) diff++;
  console.log(n, `${a.w}x${a.h} vs ${b.w}x${b.h}`, a.w===b.w&&a.h===b.h ? `${diff} differing channel values` : "different size"); }
