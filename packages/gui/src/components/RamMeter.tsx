/**
 * RamMeter — live process-memory widget for the dashboard.
 *
 * Polls GET /api/system/stats every 2 s and renders a compact RSS + heap
 * readout with a hand-rolled SVG sparkline (capped at 60 points). The
 * component is fully self-contained: its own state, its own fetch, no store
 * subscription — so a tick never re-renders the rest of the app.
 *
 * Performance budget: one fetch / 2 s, one SVG path update. No chart lib,
 * no external deps.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface Stats {
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  uptimeSec: number;
}

const POINTS = 60; // 60 samples × 2 s = 2 min window
const W = 96;
const H = 24;

function fmtMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtUptime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? m + 'm ' + s + 's' : s + 's';
}

export function RamMeter() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const valuesRef = useRef<number[]>([]);
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const res = await api.getSystemStats();
      if (!alive) return;
      if (res.ok && res.data) {
        setError(false);
        setStats(res.data);
        valuesRef.current.push(res.data.rssBytes);
        if (valuesRef.current.length > POINTS) valuesRef.current.shift();
        setPath(buildPath(valuesRef.current));
      } else {
        setError(true);
      }
    };
    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const title = stats
    ? 'RSS ' + fmtMB(stats.rssBytes) + ' · heap ' + fmtMB(stats.heapUsedBytes) + '/' + fmtMB(stats.heapTotalBytes) + ' · up ' + fmtUptime(stats.uptimeSec)
    : 'loading…';

  return (
    <div className='ram-meter' title={title}>
      <svg width={W} height={H} className='ram-meter-spark' aria-hidden='true'>
        {path ? (
          <path d={path} className='ram-meter-path' fill='none' strokeWidth='1.5' />
        ) : (
          <line x1='0' y1={H / 2} x2={W} y2={H / 2} className='ram-meter-empty' />
        )}
      </svg>
      <span className='ram-meter-value'>{stats ? fmtMB(stats.rssBytes) : error ? '—' : '…'}</span>
    </div>
  );
}

function buildPath(values: number[]): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = W / (POINTS - 1);
  const offset = POINTS - values.length; // right-align the window
  const pts = values.map((v, i) => {
    const x = (offset + i) * step;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return x.toFixed(1) + ',' + y.toFixed(1);
  });
  return 'M' + pts.join(' L');
}
