/**
 * camera-relay/server.js
 *
 * RTSP → HLS relay server for 7 MGD STP Sonia Vihar live camera.
 * Supports up to 4 cameras simultaneously.
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Config ────────────────────────────────────────────────────────────────────

// Load .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const PORT = parseInt(process.env.PORT || '3001', 10);
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

// Read up to 4 RTSP URLs from env
const cameras = [];
for (let i = 1; i <= 4; i++) {
  const url = process.env[`RTSP_URL_${i}`];
  if (url) {
    cameras.push({ id: `cam${i}`, url: url.trim() });
  }
}

// Fallback to RTSP_URL for backwards compatibility if no RTSP_URL_1 is defined
if (cameras.length === 0 && process.env.RTSP_URL) {
  cameras.push({ id: 'cam1', url: process.env.RTSP_URL.trim() });
}

// HLS output directory
const HLS_BASE_DIR = path.join(os.tmpdir(), 'stp-camera-hls');

// ── Start FFmpeg for each camera ──────────────────────────────────────────────

function startFFmpeg(camera) {
  const hlsDir = path.join(HLS_BASE_DIR, camera.id);
  if (!fs.existsSync(hlsDir)) fs.mkdirSync(hlsDir, { recursive: true });

  console.log(`[relay] Starting FFmpeg for ${camera.id}...`);
  console.log(`[relay] RTSP URL  : ${camera.url}`);
  console.log(`[relay] HLS dir   : ${hlsDir}`);

  const ffmpegArgs = [
    '-rtsp_transport', 'tcp',
    '-i', camera.url,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-c:a', 'aac',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', path.join(hlsDir, 'segment%03d.ts'),
    path.join(hlsDir, 'stream.m3u8'),
  ];

  const ff = spawn(FFMPEG_PATH, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

  ff.stdout.on('data', (d) => process.stdout.write(`[ffmpeg-${camera.id}] ${d}`));
  ff.stderr.on('data', (d) => process.stderr.write(`[ffmpeg-${camera.id}] ${d}`));

  ff.on('exit', (code, signal) => {
    console.warn(`[relay] FFmpeg for ${camera.id} exited (code=${code}, signal=${signal}). Restarting in 5 s...`);
    setTimeout(() => startFFmpeg(camera), 5000);
  });
}

// Start processing all configured cameras
if (cameras.length > 0) {
  cameras.forEach(cam => startFFmpeg(cam));
} else {
  console.warn('[relay] No RTSP_URL_* variables defined in .env! Camera relay will not stream anything.');
}

// ── Express server ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());

// Disable caching so the browser always gets fresh HLS segments
app.use((_, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// Serve all HLS files from the temp directory under /stream
// e.g. /stream/cam1/stream.m3u8
app.use('/stream', express.static(HLS_BASE_DIR, { maxAge: 0 }));

app.get('/health', (_, res) => {
  const status = cameras.map(cam => {
    const m3u8 = path.join(HLS_BASE_DIR, cam.id, 'stream.m3u8');
    return { id: cam.id, ready: fs.existsSync(m3u8), url: cam.url };
  });
  res.json({ cameras: status });
});

app.listen(PORT, () => {
  console.log(`\n[relay] HLS server running at  http://localhost:${PORT}`);
  console.log(`[relay] Available streams:`);
  cameras.forEach(cam => {
    console.log(`        - http://localhost:${PORT}/stream/${cam.id}/stream.m3u8`);
  });
  console.log(`[relay] Health check           http://localhost:${PORT}/health\n`);
});
