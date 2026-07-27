'use client';

import { useEffect, useRef, useState } from 'react';

type Status = 'loading' | 'playing' | 'offline' | 'unconfigured' | 'unauthorized';

export default function CameraFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let hlsInstance: import('hls.js').default | null = null;
    let destroyed = false;

    async function init() {
      // 1. Fetch the stream URL from our auth-gated API route
      let streamUrl: string;
      try {
        const res = await fetch('/api/camera-url');
        if (res.status === 401) { setStatus('unauthorized'); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 503) { setStatus('unconfigured'); return; }
          setErrorMsg(body.error ?? 'Failed to fetch stream URL');
          setStatus('offline');
          return;
        }
        const data = await res.json();
        streamUrl = data.url;
      } catch {
        setStatus('offline');
        setErrorMsg('Could not reach the server.');
        return;
      }

      if (destroyed || !videoRef.current) return;

      // 2. Load HLS.js dynamically (avoids SSR issues)
      const Hls = (await import('hls.js')).default;

      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          lowLatencyMode: true,
          backBufferLength: 10,
        });
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(videoRef.current);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!destroyed) {
            setStatus('playing');
            videoRef.current?.play().catch(() => {});
          }
        });
        hlsInstance.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            setStatus('offline');
            setErrorMsg('Stream connection lost. The office PC may be offline.');
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari / iOS)
        videoRef.current.src = streamUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          if (!destroyed) {
            setStatus('playing');
            videoRef.current?.play().catch(() => {});
          }
        });
        videoRef.current.addEventListener('error', () => {
          if (!destroyed) {
            setStatus('offline');
            setErrorMsg('Stream connection lost. The office PC may be offline.');
          }
        });
      } else {
        setStatus('offline');
        setErrorMsg('Your browser does not support HLS video playback.');
      }
    }

    init();

    return () => {
      destroyed = true;
      hlsInstance?.destroy();
    };
  }, []);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">📷</span>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Live Plant Camera</h2>
          <p className="text-sm text-gray-500">7 MGD STP Sonia Vihar — Real-time CCTV Feed</p>
        </div>
        {/* Live indicator */}
        {status === 'playing' && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Video player */}
      <div className="relative bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-200 aspect-video w-full">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          muted
          playsInline
          controls={status === 'playing'}
        />

        {/* Overlay states */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-4">
            <svg className="animate-spin h-10 w-10 text-[#0062b8]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm font-medium text-gray-300">Connecting to camera stream…</p>
          </div>
        )}

        {status === 'offline' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-3 p-6 text-center">
            <span className="text-5xl">📵</span>
            <p className="text-lg font-bold">Camera Offline</p>
            <p className="text-sm text-gray-400 max-w-sm">
              {errorMsg || 'The office camera PC is currently offline. It will reconnect automatically when the PC starts.'}
            </p>
          </div>
        )}

        {status === 'unconfigured' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-3 p-6 text-center">
            <span className="text-5xl">⚙️</span>
            <p className="text-lg font-bold">Camera Not Configured</p>
            <p className="text-sm text-gray-400 max-w-sm">
              The <code className="bg-gray-700 px-1 rounded">CAMERA_HLS_URL</code> environment variable has not been set on the server. Add it to <code className="bg-gray-700 px-1 rounded">.env.local</code> and restart.
            </p>
          </div>
        )}

        {status === 'unauthorized' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-3 p-6 text-center">
            <span className="text-5xl">🔒</span>
            <p className="text-lg font-bold">Session Expired</p>
            <p className="text-sm text-gray-400">Please log in again to view the camera feed.</p>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span>🔒</span> Stream is private — only visible to authenticated users
        </span>
        <span className="flex items-center gap-1">
          <span>⏱️</span> Low-latency HLS — ~4–6 second delay
        </span>
        <span className="flex items-center gap-1">
          <span>🖥️</span> Office PC must be running for the feed to be active
        </span>
      </div>
    </div>
  );
}
