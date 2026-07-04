'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceStore } from '@/store/device-store';
import { Activity } from 'lucide-react';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Telemetry() {
  const { activeDevice, telemetry, connectionStatus, setTelemetry } = useDeviceStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/telemetry?device=${activeDevice}`);
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data);
        }
      } catch {}
    };
    poll();
    intervalRef.current = setInterval(poll, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeDevice, setTelemetry]);

  const statusColor = connectionStatus === 'connected'
    ? 'text-emerald-400'
    : connectionStatus === 'error'
    ? 'text-red-400'
    : 'text-muted-foreground';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          Телеметрия
          {connectionStatus === 'connected' && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              LIVE
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Azimuth */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider w-28">Азимут</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono font-bold tabular-nums text-foreground">
              {telemetry.azimuth.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">°</span>
          </div>
        </div>

        {/* Elevation */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider w-28">Угол места</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono font-bold tabular-nums text-foreground">
              {telemetry.elevation.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">°</span>
          </div>
        </div>

        <div className="border-t border-border pt-2" />

        {/* Speed */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Скорость</span>
          <span className="text-sm font-mono tabular-nums">
            {telemetry.speed}
            <span className="text-xs text-muted-foreground ml-1">/ 10</span>
          </span>
        </div>

        {/* Status */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Статус</span>
          <span className={`text-sm font-mono ${statusColor}`}>
            {telemetry.status || '—'}
          </span>
        </div>

        {/* Uptime */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Uptime</span>
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {telemetry.uptime ? formatUptime(telemetry.uptime) : '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}