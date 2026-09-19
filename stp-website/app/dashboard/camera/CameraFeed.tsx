'use client';

import { useEffect, useRef, useState } from 'react';

type Status = 'loading' | 'playing' | 'offline' | 'unconfigured' | 'unauthorized';

function SingleCamera({ 
  streamUrl, 
  title, 
  onExpand 
}: { 
  streamUrl: string; 
  title: string; 
  onExpand?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let hlsInstance: import('hls.js').default | null = null;
    let destroyed = false;

    async function init() {
      if (destroyed || !videoRef.current) return;

      const Hls = (await import('hls.js')).default;

      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          lowLatencyMode: true,
          backBufferLength: 10,
          xhrSetup: (xhr, url) => {
            if (url.includes('.m3u8')) {
              const char = url.includes('?') ? '&' : '?';
              xhr.open('GET', url + char + 't=' + Date.now(), true);
            }
          }
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
            setErrorMsg('Stream connection lost.');
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = `${streamUrl}?t=${Date.now()}`;
        videoRef.current.addEventListener('loadedmetadata', () => {
          if (!destroyed) {
            setStatus('playing');
            videoRef.current?.play().catch(() => {});
          }
        });
        videoRef.current.addEventListener('error', () => {
          if (!destroyed) {
            setStatus('offline');
            setErrorMsg('Stream connection lost.');
          }
        });
      } else {
        setStatus('offline');
        setErrorMsg('Browser does not support HLS playback.');
      }
    }

    init();

    return () => {
      destroyed = true;
      hlsInstance?.destroy();
    };
  }, [streamUrl]);

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden shadow border border-gray-200 aspect-video w-full group">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted
        playsInline
        controls={status === 'playing'}
      />

      {/* Overlay states */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-2">
          <svg className="animate-spin h-6 w-6 text-[#0062b8]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-xs font-medium text-gray-300">Connecting...</p>
        </div>
      )}

      {status === 'offline' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-2 p-4 text-center">
          <span className="text-2xl">📵</span>
          <p className="text-sm font-bold">Offline</p>
          <p className="text-xs text-gray-400">{errorMsg || 'Camera PC is offline.'}</p>
        </div>
      )}

      {/* Title & Controls Overlay */}
      <div className="absolute top-0 left-0 w-full p-3 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-white text-sm font-semibold shadow-sm">{title}</span>
        <div className="flex gap-2">
          {status === 'playing' && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50/90 px-2 py-0.5 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
          {onExpand && (
            <button 
              onClick={onExpand}
              className="bg-black/50 hover:bg-black/80 text-white text-xs px-2 py-1 rounded transition"
            >
              ⤢
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


export default function CameraFeed() {
  const [baseUrl, setBaseUrl] = useState('');
  const [globalStatus, setGlobalStatus] = useState<Status>('loading');
  const [expandedCam, setExpandedCam] = useState<number | null>(null);

  useEffect(() => {
    async function fetchUrl() {
      try {
        const res = await fetch('/api/camera-url');
        if (res.status === 401) { setGlobalStatus('unauthorized'); return; }
        if (!res.ok) {
          if (res.status === 503) { setGlobalStatus('unconfigured'); return; }
          setGlobalStatus('offline');
          return;
        }
        const data = await res.json();
        
        // Parse the URL: The user might set "https://domain.com", "https://domain.com/stream", or "https://domain.com/stream/stream.m3u8"
        // We want to ensure the base always ends with "/stream" because the Express server serves files under /stream
        let base = data.url;
        if (base.endsWith('/stream.m3u8')) {
          base = base.replace(/\/stream\.m3u8$/, '');
        } else if (base.endsWith('/')) {
          base = base.slice(0, -1);
        }
        
        if (!base.endsWith('/stream')) {
          base = `${base}/stream`;
        }
        
        setBaseUrl(base);
        setGlobalStatus('playing'); // We have the base URL, now players will load individually
      } catch {
        setGlobalStatus('offline');
      }
    }
    fetchUrl();
  }, []);

  if (globalStatus === 'unconfigured') {
    return (
      <div className="bg-black rounded-2xl aspect-video w-full flex flex-col items-center justify-center text-white gap-3 p-6 text-center max-w-5xl border border-gray-200 shadow-xl">
        <span className="text-5xl">⚙️</span>
        <p className="text-lg font-bold">Camera Not Configured</p>
        <p className="text-sm text-gray-400 max-w-sm">
          The <code className="bg-gray-700 px-1 rounded">CAMERA_HLS_URL</code> environment variable is missing in <code className="bg-gray-700 px-1 rounded">.env.local</code>.
        </p>
      </div>
    );
  }

  if (globalStatus === 'unauthorized') {
    return (
      <div className="bg-black rounded-2xl aspect-video w-full flex flex-col items-center justify-center text-white gap-3 p-6 text-center max-w-5xl border border-gray-200 shadow-xl">
        <span className="text-5xl">🔒</span>
        <p className="text-lg font-bold">Session Expired</p>
        <p className="text-sm text-gray-400">Please log in again to view the camera feed.</p>
      </div>
    );
  }

  if (globalStatus === 'offline' && !baseUrl) {
    return (
      <div className="bg-black rounded-2xl aspect-video w-full flex flex-col items-center justify-center text-white gap-3 p-6 text-center max-w-5xl border border-gray-200 shadow-xl">
        <span className="text-5xl">📵</span>
        <p className="text-lg font-bold">Server Offline</p>
        <p className="text-sm text-gray-400">Could not reach the web server to fetch the stream URL.</p>
      </div>
    );
  }

  // Expanded View
  if (expandedCam !== null) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📷</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Camera {expandedCam}</h2>
              <p className="text-sm text-gray-500">7 MGD STP Sonia Vihar — Expanded View</p>
            </div>
          </div>
          <button 
            onClick={() => setExpandedCam(null)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold text-sm transition"
          >
            ← Back to Grid
          </button>
        </div>
        <SingleCamera 
          streamUrl={`${baseUrl}/cam${expandedCam}/stream.m3u8`} 
          title={`Camera ${expandedCam}`} 
        />
      </div>
    );
  }

  // The exact camera IDs from the user's custom server script
  const cameraIds = ['12', '14', '26', '2'];

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <span className="text-3xl">📷</span>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Live Plant Cameras</h2>
          <p className="text-sm text-gray-500">7 MGD STP Sonia Vihar — 2x2 Grid View</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cameraIds.map(id => (
          <SingleCamera 
            key={id}
            streamUrl={`${baseUrl}/cam${id}/stream.m3u8`}
            title={`Camera ${id}`}
            onExpand={() => setExpandedCam(id as any)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span>🔒</span> Private stream
        </span>
        <span className="flex items-center gap-1">
          <span>⏱️</span> Low-latency HLS
        </span>
        <span className="flex items-center gap-1">
          <span>⚙️</span> Quality: Use NVR Sub-Streams for optimal grid performance
        </span>
      </div>
    </div>
  );
}
