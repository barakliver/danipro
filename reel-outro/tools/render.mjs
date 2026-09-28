#!/usr/bin/env node
/**
 * Frame-accurate export: headless Chromium → PNG frames → FFmpeg → MP4 (H.264).
 *
 *   node tools/render.mjs                    # out/outro.mp4 + out/outro-final-frame.png
 *   node tools/render.mjs --sfx              # also out/outro-sfx.mp4 with a scratch SFX track
 *   node tools/render.mjs --frames           # also keep every PNG in out/frames/
 *   node tools/render.mjs --palette brief    # render with the brief's palette
 *   node tools/render.mjs --out path.mp4 --crf 14
 *
 * The page is loaded with ?render=1, so nothing animates on its own; for
 * frame i the script calls OUTRO.renderAt(i / fps) and screenshots the
 * 1080×1920 stage. Timing never depends on how fast the machine is.
 *
 * Browser driver: uses `puppeteer` if installed, otherwise `playwright`.
 * Set CHROME_PATH to point either one at a specific Chromium binary.
 */
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const OUT = path.resolve(ROOT, opt('out', 'out/outro.mp4'));
const CRF = opt('crf', '16');
const PALETTE = opt('palette', '');
const WIDTH = 1080, HEIGHT = 1920;

fs.mkdirSync(path.dirname(OUT), { recursive: true });

/* ---------------- browser driver ---------------- */
function load(name) {
  const require = createRequire(import.meta.url);
  const paths = [ROOT, process.cwd()];
  try { paths.push(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()); } catch {}
  try { return require(require.resolve(name, { paths })); } catch { return null; }
}

async function openPage(url) {
  const executablePath = process.env.CHROME_PATH || undefined;
  const puppeteer = load('puppeteer') || load('puppeteer-core');
  if (puppeteer) {
    const browser = await puppeteer.launch({
      headless: true, executablePath,
      args: ['--allow-file-access-from-files', '--force-color-profile=srgb', '--hide-scrollbars'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load' });
    return { browser, page, driver: 'puppeteer' };
  }
  const pw = load('playwright') || load('playwright-core');
  if (!pw) throw new Error('Install puppeteer (npm i) or playwright to render.');
  const browser = await pw.chromium.launch({
    executablePath,
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb', '--hide-scrollbars'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });
  return { browser, page, driver: 'playwright' };
}

/* ---------------- ffmpeg ---------------- */
function ffmpeg(argv) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error(err.slice(-2000))))));
  return { proc: p, done };
}

/* Scratch SFX: short synthetic cues on the brief's sync markers, so the
   edit can be checked with sound. Replace with real foley for delivery. */
function sfxFilter(m, duration) {
  const ev = [];
  // glass crack: bright noise crack + two glassy partials
  ev.push([m.glassImpact, 0.35,
    "0.55*(random(0)*2-1)*exp(-t*38)*(1-exp(-t*900))+0.18*sin(2*PI*4120*t)*exp(-t*14)+0.12*sin(2*PI*6350*t)*exp(-t*20)",
    'highpass=f=1800']);
  // fragments begin to travel: soft rising air
  ev.push([m.fragmentsMove, 0.7, "0.10*(random(0)*2-1)*sin(PI*t/0.7)^2", 'bandpass=f=2600:width_type=o:w=1.2']);
  // word complete: subtle tick
  ev.push([m.wordComplete, 0.08, "0.25*sin(2*PI*1900*t)*exp(-t*90)", 'anull']);
  // sticker whoosh + slap
  ev.push([m.stickerEnter, 0.25, "0.12*(random(0)*2-1)*sin(PI*t/0.25)^2", 'bandpass=f=1400:width_type=o:w=1.5']);
  ev.push([m.stickerImpact, 0.2,
    "0.6*(random(0)*2-1)*exp(-t*55)+0.45*sin(2*PI*95*t)*exp(-t*30)", 'lowpass=f=2400']);
  // names: final click
  ev.push([m.namesReveal, 0.06, "0.22*sin(2*PI*2600*t)*exp(-t*120)", 'anull']);

  const chains = ev.map(([at, len, expr, fx], i) =>
    `aevalsrc='${expr}':s=48000:d=${len},${fx},adelay=${Math.round(at * 1000)}:all=1,apad=whole_dur=${duration}[a${i}]`);
  return chains.join(';') + ';' + ev.map((_, i) => `[a${i}]`).join('') +
    `amix=inputs=${ev.length}:normalize=0,atrim=0:${duration},alimiter=limit=0.9[aout]`;
}

/* ---------------- main ---------------- */
const query = new URLSearchParams({ render: '1' });
if (PALETTE) query.set('palette', PALETTE);
const url = pathToFileURL(path.join(ROOT, 'index.html')).href + '?' + query;

const { browser, page, driver } = await openPage(url);
await page.evaluate(() => window.OUTRO.ready);
const info = await page.evaluate(() => ({
  fps: window.OUTRO.CONFIG.fps,
  duration: window.OUTRO.CONFIG.duration,
  frames: window.OUTRO.totalFrames,
  markers: window.OUTRO.markers(),
}));
console.log(`[render] ${driver}: ${info.frames} frames @ ${info.fps} fps (${info.duration}s) → ${path.relative(ROOT, OUT)}`);

const framesDir = path.join(path.dirname(OUT), 'frames');
if (flag('frames')) fs.mkdirSync(framesDir, { recursive: true });

const enc = ffmpeg([
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-',
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', CRF,
  '-r', String(info.fps), '-g', String(info.fps),
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
  '-movflags', '+faststart', OUT,
]);

const snap = () => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
for (let i = 0; i < info.frames; i++) {
  await page.evaluate((i) => window.OUTRO.renderFrame(i), i);
  const png = await snap();
  if (flag('frames')) fs.writeFileSync(path.join(framesDir, `f${String(i).padStart(4, '0')}.png`), png);
  if (!enc.proc.stdin.write(png)) await new Promise((r) => enc.proc.stdin.once('drain', r));
  if (i % 15 === 0) process.stdout.write(`\r[render] frame ${i + 1}/${info.frames}`);
}
enc.proc.stdin.end();
await enc.done;
process.stdout.write(`\r[render] frame ${info.frames}/${info.frames}\n`);

// Final frame as a standalone poster (the exact last frame of the video).
await page.evaluate((i) => window.OUTRO.renderFrame(i), info.frames - 1);
const posterPath = OUT.replace(/\.mp4$/i, '') + '-final-frame.png';
fs.writeFileSync(posterPath, await snap());
await browser.close();

fs.writeFileSync(OUT.replace(/\.mp4$/i, '') + '-audio-markers.json', JSON.stringify(info.markers, null, 2) + '\n');

if (flag('sfx')) {
  const sfxOut = OUT.replace(/\.mp4$/i, '') + '-sfx.mp4';
  const mux = ffmpeg([
    '-y', '-loglevel', 'error', '-i', OUT,
    '-filter_complex', sfxFilter(info.markers, info.duration),
    '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest', sfxOut,
  ]);
  mux.proc.stdin.end();
  await mux.done;
  console.log(`[render] scratch SFX version → ${path.relative(ROOT, sfxOut)}`);
}
console.log(`[render] done → ${path.relative(ROOT, OUT)}, ${path.relative(ROOT, posterPath)}`);
