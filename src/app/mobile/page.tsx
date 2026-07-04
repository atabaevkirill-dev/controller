'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Wifi, WifiOff } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Direction = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right' | 'stop';

const DIR_TO_CMD: Record<string, string> = {
  up: 'MU', down: 'MD', left: 'ML', right: 'MR',
  'up-left': 'MUL', 'up-right': 'MUR', 'down-left': 'MDL', 'down-right': 'MDR',
};

interface Telemetry {
  azimuth: number;
  elevation: number;
  speed: number;
  status: string;
}

interface DeviceConfig {
  tiltIp: string;
  tiltPort: number;
  panIp: string;
  panPort: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function api(path: string, opts?: RequestInit) {
  try {
    const res = await fetch(path, opts);
    return res.json();
  } catch {
    return null;
  }
}

async function sendMoveCmd(device: string, direction: Direction, speed: number) {
  if (direction === 'stop') {
    return api('/api/command', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, command: 'STP' }),
    });
  }
  const cmd = DIR_TO_CMD[direction];
  if (!cmd) return;
  return api('/api/command', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command: cmd, value: String(speed) }),
  });
}

async function sendSpeedCmd(device: string, speed: number) {
  return api('/api/command', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command: 'SPD', value: String(speed) }),
  });
}

// ─── Direction buttons config ─────────────────────────────────────────────────

const DIRECTIONS: { key: Direction; gridPos: string; icon: React.ReactNode }[] = [
  { key: 'up',        gridPos: 'col-start-2 row-start-1', icon: <ArrowUp className="w-7 h-7" /> },
  { key: 'up-right',  gridPos: 'col-start-3 row-start-1', icon: <ArrowUp className="w-7 h-7 rotate-45" /> },
  { key: 'right',     gridPos: 'col-start-3 row-start-2', icon: <ArrowRight className="w-7 h-7" /> },
  { key: 'down-right', gridPos: 'col-start-3 row-start-3', icon: <ArrowDown className="w-7 h-7 -rotate-45" /> },
  { key: 'down',      gridPos: 'col-start-2 row-start-3', icon: <ArrowDown className="w-7 h-7" /> },
  { key: 'down-left', gridPos: 'col-start-1 row-start-3', icon: <ArrowDown className="w-7 h-7 rotate-45" /> },
  { key: 'left',      gridPos: 'col-start-1 row-start-2', icon: <ArrowLeft className="w-7 h-7" /> },
  { key: 'up-left',   gridPos: 'col-start-1 row-start-1', icon: <ArrowUp className="w-7 h-7 -rotate-45" /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MobileRemote() {
  const [device, setDevice] = useState('TL.0009');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [activeDir, setActiveDir] = useState<Direction | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({ azimuth: 0, elevation: 0, speed: 0, status: '—' });
  const [config, setConfig] = useState<DeviceConfig>({ tiltIp: '', tiltPort: 23, panIp: '', panPort: 23 });
  const vibrateSupported = typeof window !== 'undefined' && 'vibrate' in navigator;
  const telemInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveDirRef = useRef<Direction | null>(null);

  // Load device config on mount / device change
  useEffect(() => {
    api(`/api/devices/${device}`).then((data: any) => {
      if (data) {
        setConfig({
          tiltIp: data.tiltIp || '',
          tiltPort: data.tiltPort || 23,
          panIp: data.panIp || '',
          panPort: data.panPort || 23,
        });
      }
    });
  }, [device]);

  // Telemetry polling
  useEffect(() => {
    if (!connected) {
      if (telemInterval.current) { clearInterval(telemInterval.current); telemInterval.current = null; }
      return;
    }
    const poll = async () => {
      const data = await api('/api/telemetry?device=' + device);
      if (data) {
        setTelemetry({
          azimuth: data.azimuth ?? 0,
          elevation: data.elevation ?? 0,
          speed: data.speed ?? 0,
          status: data.status ?? '—',
        });
      }
    };
    poll();
    telemInterval.current = setInterval(poll, 500);
    return () => { if (telemInterval.current) clearInterval(telemInterval.current); };
  }, [connected, device]);

  // Connect / Disconnect
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    const result = await api('/api/command', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, command: 'CONNECT' }),
    });
    setConnecting(false);
    if (result?.success) setConnected(true);
  }, [device]);

  const handleDisconnect = useCallback(async () => {
    await api('/api/command', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, command: 'DISCONNECT' }),
    });
    setConnected(false);
    setTelemetry({ azimuth: 0, elevation: 0, speed: 0, status: '—' });
  }, [device]);

  // D-Pad handlers with repeat
  const startMove = useCallback((dir: Direction) => {
    if (!connected) return;
    if (vibrateSupported) navigator.vibrate(10);
    setActiveDir(dir);
    moveDirRef.current = dir;
    sendMoveCmd(device, dir, speed);
    // Repeat every 300ms while held
    if (moveRepeatRef.current) clearInterval(moveRepeatRef.current);
    moveRepeatRef.current = setInterval(() => {
      if (moveDirRef.current) sendMoveCmd(device, moveDirRef.current, speed);
    }, 300);
  }, [connected, device, speed, vibrateSupported]);

  const stopMove = useCallback(() => {
    setActiveDir(null);
    moveDirRef.current = null;
    if (moveRepeatRef.current) { clearInterval(moveRepeatRef.current); moveRepeatRef.current = null; }
    if (connected) sendMoveCmd(device, 'stop', speed);
  }, [connected, device, speed]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (moveRepeatRef.current) clearInterval(moveRepeatRef.current);
      if (telemInterval.current) clearInterval(telemInterval.current);
    };
  }, []);

  // Speed change
  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    if (connected) sendSpeedCmd(device, newSpeed);
  }, [connected, device]);

  const speedColor = speed <= 3 ? 'text-emerald-400' : speed <= 6 ? 'text-amber-400' : 'text-red-400';
  const speedTrackColor = speed <= 3 ? 'bg-emerald-500' : speed <= 6 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background select-none" style={{ touchAction: 'manipulation' }}>
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500/60'}`} />
          <span className="text-sm font-mono font-bold text-foreground">{device}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Device selector */}
          <select
            value={device}
            onChange={(e) => { setDevice(e.target.value); setConnected(false); }}
            className="h-7 text-xs font-mono bg-secondary border border-border rounded-md px-2 text-foreground"
          >
            <option value="TL.0009">TL.0009</option>
            <option value="TL.0250">TL.0250</option>
            <option value="TL.0320">TL.0320</option>
            <option value="TL.0400">TL.0400</option>
          </select>
          {/* Connect button */}
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            disabled={connecting}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold transition-all ${
              connected
                ? 'bg-red-500/15 text-red-400 border border-red-500/30 active:bg-red-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 active:bg-emerald-500/30'
            }`}
          >
            {connected ? <><WifiOff className="w-3.5 h-3.5" /> Откл</> : connecting ? '...' : <><Wifi className="w-3.5 h-3.5" /> Подкл</>}
          </button>
        </div>
      </div>

      {/* Telemetry */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <TelemCard label="Азимут" value={telemetry.azimuth.toFixed(1)} unit="°" />
        <TelemCard label="Угол места" value={telemetry.elevation.toFixed(1)} unit="°" />
        <TelemCard label="Скорость" value={telemetry.speed.toFixed(0)} unit="" />
      </div>

      {/* D-Pad — large touch targets */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-5">
        <div
          className="grid grid-cols-3 grid-rows-3 gap-2 relative"
          style={{ width: 'min(75vw, 300px)', height: 'min(75vw, 300px)' }}
        >
          {/* Glow ring when connected */}
          {connected && (
            <div className="absolute inset-[-8px] rounded-3xl border-2 border-emerald-500/20 pointer-events-none">
              <div className="absolute inset-0 rounded-3xl border-2 border-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
            </div>
          )}

          {DIRECTIONS.map(({ key, gridPos, icon }) => {
            const isActive = activeDir === key;
            return (
              <button
                key={key}
                className={`
                  rounded-2xl flex items-center justify-center border-2 transition-all duration-100
                  ${!connected ? 'opacity-30' : ''}
                  ${isActive
                    ? 'bg-emerald-600/30 border-emerald-500/70 text-emerald-300 scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                    : 'bg-secondary border-border text-secondary-foreground active:bg-primary/20 active:border-primary/40'
                  }
                  ${gridPos}
                `}
                style={{ minHeight: 64, minWidth: 64 }}
                onTouchStart={(e) => { e.preventDefault(); startMove(key); }}
                onTouchEnd={(e) => { e.preventDefault(); stopMove(); }}
                onTouchCancel={stopMove}
              >
                {icon}
              </button>
            );
          })}

          {/* Center STOP */}
          <button
            className={`
              col-start-2 row-start-2 rounded-full flex items-center justify-center border-2
              transition-all duration-100
              ${!connected
                ? 'bg-destructive/20 text-destructive/40 border-destructive/20'
                : 'bg-destructive text-destructive-foreground border-destructive active:scale-90 active:bg-destructive/80 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
              }
            `}
            style={{ minHeight: 72, minWidth: 72 }}
            onTouchStart={(e) => { e.preventDefault(); if (connected && vibrateSupported) navigator.vibrate(20); stopMove(); }}
          >
            <Square className="w-8 h-8" fill="currentColor" />
          </button>
        </div>

        {/* Speed */}
        <div className="w-full max-w-xs px-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Скорость</span>
            <span className={`text-3xl font-mono font-bold tabular-nums ${speedColor} transition-colors duration-200`}>
              {speed}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={speed}
            onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${((speed - 1) / 9) * 100}%, var(--color-border) ${((speed - 1) / 9) * 100}%, var(--color-border) 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
            <span>1</span><span>5</span><span>10</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card/60 px-4 py-2.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>SaaS Controller — Remote</span>
        <span className={connected ? 'text-emerald-400' : 'text-red-400/60'}>
          {connected ? '● ONLINE' : '○ OFFLINE'}
        </span>
      </div>
    </div>
  );
}

// ─── Telemetry card ───────────────────────────────────────────────────────────

function TelemCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-mono font-bold tabular-nums text-foreground">
        {value}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}