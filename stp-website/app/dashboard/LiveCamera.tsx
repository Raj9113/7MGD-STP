'use client';

/**
 * LiveCamera.tsx
 *
 * Reusable live camera viewer component for all department pages.
 *
 * Reads the HLS stream URL from the NEXT_PUBLIC_CAMERA_HLS_URL env variable.
 * If the variable is not set, shows a polished "Camera Unavailable" placeholder.
 *
 * Supports:
 *   - HLS (.m3u8) via hls.js (Chrome, Firefox, Edge)
 *   - Native HLS (Safari) via the <video> element directly
 *   - Fullscreen toggle
 */

import { useEffect, useRef, useState } from 'react';

const CAMERA_URL = process.env.NEXT_PUBLIC_CAMERA_HLS_URL ?? '';

export default function LiveCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error' | 'no-url'>('loading');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Fullscreen handling ──────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // ── HLS.js player ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!CAMERA_URL) {
      setStatus('no-url');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: import('hls.js').default | null = null;

    const initHls = async () => {
      const Hls = (await import('hls.js')).default;

      if (Hls.isSupported()) {
        // Chrome / Firefox / Edge — use HLS.js
        hlsInstance = new Hls({
          lowLatencyMode: true,
          backBufferLength: 0,
          maxBufferLength: 10,
        });
        hlsInstance.loadSource(CAMERA_URL);
        hlsInstance.attachMedia(video);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().then(() => setStatus('playing')).catch(() => setStatus('error'));
        });

        hlsInstance.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error('[LiveCamera] HLS fatal error:', data);
            setStatus('error');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari — native HLS support
        video.src = CAMERA_URL;
        video.addEventListener('loadedmetadata', () => {
          video.play().then(() => setStatus('playing')).catch(() => setStatus('error'));
        });
        video.addEventListener('error', () => setStatus('error'));
      } else {
        setStatus('error');
      }
    };

    initHls();

    return () => {
      hlsInstance?.destroy();
    };
  }, []);

  // ── No URL configured ────────────────────────────────────────────────────
  if (status === 'no-url') {
    return (
      <div>
        <SectionTitle />
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-sm">
          <div className="aspect-video flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="text-5xl opacity-30">📷</div>
            <p className="text-sm font-semibold text-gray-400">Camera Not Configured</p>
            <p className="text-xs text-gray-600 text-center max-w-xs">
              Set <code className="bg-gray-800 px-1 rounded text-gray-300">NEXT_PUBLIC_CAMERA_HLS_URL</code> in{' '}
              <code className="bg-gray-800 px-1 rounded text-gray-300">.env.local</code> and restart the server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Player ────────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionTitle />
      <div
        ref={containerRef}
        className="relative bg-black rounded-xl overflow-hidden border border-gray-800 shadow-lg group"
        style={{ aspectRatio: '16/9' }}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {/* Loading overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm font-medium">Connecting to camera…</p>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
            <div className="text-4xl">📷</div>
            <p className="text-white text-sm font-semibold">Camera Unavailable</p>
            <p className="text-gray-400 text-xs text-center max-w-xs">
              The live stream could not be loaded. Ensure the relay server is running.
            </p>
            <button
              onClick={() => { setStatus('loading'); window.location.reload(); }}
              className="mt-1 text-xs border border-white/30 text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top-left: LIVE badge */}
        {status === 'playing' && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>
        )}

        {/* Top-right: Camera label */}
        <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
            Site Camera
          </span>
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="bg-black/60 backdrop-blur-sm text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/80 transition-all"
          >
            {isFullscreen ? (
              // Compress icon
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              // Expand icon
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>

        {/* Bottom bar */}
        {status === 'playing' && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <p className="text-white text-xs">
              🎥 7 MGD STP Sonia Vihar — Site Feed
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared section title ────────────────────────────────────────────────────

function SectionTitle() {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
        🎥 Live Site Camera
      </h3>
      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Live
      </span>
    </div>
  );
}
