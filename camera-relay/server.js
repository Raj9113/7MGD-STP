const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

const HLS_DIR = path.join(os.tmpdir(), 'stp-camera-hls');

if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

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
    setTimeout(startFFmpeg, 5000);
  });

  return ff;
}

startFFmpeg();

const app = express();

app.use(cors());

app.use((_, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

app.use('/stream', express.static(HLS_DIR, { maxAge: 0 }));

app.get('/health', (_, res) => {
  const m3u8 = path.join(HLS_DIR, 'stream.m3u8');
  const ready = fs.existsSync(m3u8);
  res.json({ status: ready ? 'ready' : 'starting', hlsDir: HLS_DIR, rtspUrl: RTSP_URL });
});

app.get('/', (_, res) => res.redirect('/stream/stream.m3u8'));

app.listen(PORT, () => {
  console.log(`\n[relay] HLS server running at  http://localhost:${PORT}`);
  console.log(`[relay] Stream URL             http://localhost:${PORT}/stream/stream.m3u8`);
  console.log(`[relay] Health check           http://localhost:${PORT}/health\n`);
  console.log('[relay] Waiting for FFmpeg to produce first segments (~5–10 s)...\n');
});
