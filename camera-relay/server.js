/**
 * camera-relay/server.js
 *
 * RTSP → HLS relay server for 7 MGD STP Sonia Vihar live camera.
 *
 * How it works:
 *   1. FFmpeg reads your RTSP stream from the IP camera.
 *   2. FFmpeg transcodes it to HLS (.m3u8 playlist + .ts segments).
 *   3. Express serves those files over HTTP with CORS enabled.
 *   4. The Next.js front-end loads the HLS stream via HLS.js.
 *
 * Requirements:
 *   - FFmpeg installed and available in PATH (or set FFMPEG_PATH below).
 *   - Node.js 18+
 *
 * Usage:
 *   1. Copy .env.example to .env and set RTSP_URL.
 *   2. npm install
 *   3. node server.js
 *
 * Keep running with PM2:
 *   npm install -g pm2
 *   pm2 start server.js --name camera-relay
 *   pm2 save && pm2 startup
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Config ────────────────────────────────────────────────────────────────────

// Load .env if present (simple manual parse, no dotenv dependency needed)
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

const RTSP_URL    = process.env.RTSP_URL    || 'rtsp://admin:password@192.168.1.64:554/stream';
const PORT        = parseInt(process.env.PORT || '3001', 10);
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'; // must be in PATH on the server

// HLS output directory — use a temp dir so nothing is written to the repo
const HLS_DIR = path.join(os.tmpdir(), 'stp-camera-hls');

// ── Ensure HLS directory exists ───────────────────────────────────────────────

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

// ── Start FFmpeg ──────────────────────────────────────────────────────────────

/**
 * FFmpeg arguments:
 *   -rtsp_transport tcp   : use TCP for reliability (avoids UDP packet loss)
 *   -i <RTSP_URL>         : input stream
 *   -c:v libx264          : re-encode to H.264 (browser-compatible)
 *   -preset ultrafast     : lowest latency encoding preset
 *   -tune zerolatency     : further reduce latency
 *   -c:a aac              : audio codec (change to -an to drop audio)
 *   -f hls                : output format
 *   -hls_time 2           : 2-second HLS segments
 *   -hls_list_size 3      : keep 3 segments in playlist (≈6 s lag)
 *   -hls_flags delete_segments+append_list : rolling window, delete old .ts files
 *   -hls_segment_filename : segment file naming pattern
 */
const ffmpegArgs = [
  '-rtsp_transport', 'tcp',
  '-i', RTSP_URL,
  '-c:v', 'libx264',
  '-preset', 'ultrafast',
  '-tune', 'zerolatency',
  '-c:a', 'aac',
  '-f', 'hls',
  '-hls_time', '2',
  '-hls_list_size', '3',
  '-hls_flags', 'delete_segments+append_list',
  '-hls_segment_filename', path.join(HLS_DIR, 'segment%03d.ts'),
  path.join(HLS_DIR, 'stream.m3u8'),
];

function startFFmpeg() {
  console.log(`[relay] Starting FFmpeg...`);
  console.log(`[relay] RTSP URL  : ${RTSP_URL}`);
  console.log(`[relay] HLS dir   : ${HLS_DIR}`);

  const ff = spawn(FFMPEG_PATH, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

  ff.stdout.on('data', (d) => process.stdout.write(`[ffmpeg] ${d}`));
  ff.stderr.on('data', (d) => process.stderr.write(`[ffmpeg] ${d}`));

  ff.on('exit', (code, signal) => {
    console.warn(`[relay] FFmpeg exited (code=${code}, signal=${signal}). Restarting in 5 s...`);
    setTimeout(startFFmpeg, 5000); // auto-restart on crash
  });

  return ff;
}

startFFmpeg();

// ── Express server ─────────────────────────────────────────────────────────────

const app = express();

// Allow the Next.js front-end (any origin) to fetch the stream
app.use(cors());

// Disable caching so the browser always gets fresh HLS segments
app.use((_, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// Serve all HLS files from the temp directory
app.use('/stream', express.static(HLS_DIR, { maxAge: 0 }));

// Health check endpoint
app.get('/health', (_, res) => {
  const m3u8 = path.join(HLS_DIR, 'stream.m3u8');
  const ready = fs.existsSync(m3u8);
  res.json({ status: ready ? 'ready' : 'starting', hlsDir: HLS_DIR, rtspUrl: RTSP_URL });
});

// Convenience: root → redirect to stream.m3u8
app.get('/', (_, res) => res.redirect('/stream/stream.m3u8'));

app.listen(PORT, () => {
  console.log(`\n[relay] HLS server running at  http://localhost:${PORT}`);
  console.log(`[relay] Stream URL             http://localhost:${PORT}/stream/stream.m3u8`);
  console.log(`[relay] Health check           http://localhost:${PORT}/health\n`);
  console.log('[relay] Waiting for FFmpeg to produce first segments (~5–10 s)...\n');
});
