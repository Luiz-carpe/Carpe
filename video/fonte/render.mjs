// usage: node render.mjs preview t1,t2,...   |  node render.mjs video <workers>
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
const D = path.dirname(new URL(import.meta.url).pathname);
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const p = path.join(D, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function page() {
  const p = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  p.on('console', m => { if (m.type() === 'error') console.log('PAGE', m.text()); }); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForFunction(() => window.READY, null, { timeout: 120000 }); return p;
}
const mode = process.argv[2];
if (mode === 'preview') {
  const p = await page(); fs.mkdirSync(path.join(D, 'prev'), { recursive: true });
  for (const ts of process.argv[3].split(',')) { const t0 = Date.now(); const u = await p.evaluate(t => window.renderAt(t), +ts); fs.writeFileSync(path.join(D, 'prev', `f_${ts}.jpg`), Buffer.from(u.split(',')[1], 'base64')); console.log(ts, Date.now() - t0, 'ms'); }
} else {
  const nW = +(process.argv[3] || 2); const FPS = 30;
  const p0 = await page(); const total = await p0.evaluate(() => window.TOTAL); const N = Math.ceil(total * FPS);
  const per = Math.ceil(N / nW); fs.mkdirSync(path.join(D, 'seg'), { recursive: true });
  const pages = [p0]; for (let i = 1; i < nW; i++) pages.push(await page());
  const t0 = Date.now();
  await Promise.all(pages.map(async (p, w) => {
    const a = w * per, b = Math.min(N, a + per);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', path.join(D, 'seg', `s${w}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const u = await p.evaluate(t => window.renderAt(t), f / FPS);
      if (!ff.stdin.write(Buffer.from(u.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 60 === 0) console.log(`w${w} frame ${f}/${b} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }));
  fs.writeFileSync(path.join(D, 'seg', 'list.txt'), pages.map((_, w) => `file 's${w}.mp4'`).join('\n'));
  console.log('done', N, 'frames');
}
await browser.close(); srv.close();
