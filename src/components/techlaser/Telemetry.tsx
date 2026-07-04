'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceStore } from '@/store/device-store';
import { Activity, WifiOff, Wifi, Zap, ThermometerSun } from 'lucide-react';

export default function Telemetry() {
  const { activeDevice, telemetry, connectionStatus, setTelemetry } = useDeviceStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [flash, setFlash] = useState<'az' | 'el' | null>(null);
  const prevAz = useRef(0);
  const prevEl = useRef(0);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      setTelemetry({ status: connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected', azimuth: 0, elevation: 0, speed: 0 });
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/telemetry?device=${activeDevice}`);
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data);
          // Flash on value change
          if (Math.abs(data.azimuth - prevAz.current) > 0.05) {
            setFlash('az');
            setTimeout(() => setFlash(null), 200);
            prevAz.current = data.azimuth;
          }
          if (Math.abs(data.elevation - prevEl.current) > 0.05) {
            setFlash('el');
            setTimeout(() => setFlash(null), 200);
            prevEl.current = data.elevation;
          }
        }
      } catch {}
    };
    poll();
    intervalRef.current = setInterval(poll, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeDevice, connectionStatus, setTelemetry]);

  const isConnected = connectionStatus === 'connected';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          Телеметрия
          {isConnected && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              LIVE
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="relative mb-3">
              <WifiOff className="w-10 h-10 text-muted-foreground/20" />
              {connectionStatus === 'connecting' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wifi className="w-10 h-10 text-amber-400/50 animate-pulse" />
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {connectionStatus === 'connecting' ? 'Подключение...' : 'Устройство не подключено'}
            </span>
            <span className="text-[10px] text-muted-foreground/60 mt-1">
              Подключитесь к ОПУ для получения телеметрии
            </span>
          </div>
        ) : (
          <>
            {/* Azimuth - large with flash effect */}
            <div className={`flex items-baseline justify-between transition-colors duration-150 rounded px-2 py-1 -mx-2 ${flash === 'az' ? 'bg-emerald-500/10' : ''}`}>
              <span className="text-xs text-muted-foreground uppercase tracking-wider w-28">Азимут</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-mono font-bold tabular-nums text-foreground">
                  {telemetry.azimuth.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">°</span>
              </div>
            </div>

            {/* Elevation - large with flash effect */}
            <div className={`flex items-baseline justify-between transition-colors duration-150 rounded px-2 py-1 -mx-2 ${flash === 'el' ? 'bg-emerald-500/10' : ''}`}>
              <span className="text-xs text-muted-foreground uppercase tracking-wider w-28">Угол места</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-mono font-bold tabular-nums text-foreground">
                  {telemetry.elevation.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">°</span>
              </div>
            </div>

            <div className="border-t border-border pt-2" />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400/60" />
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase">Скорость</div>
                  <span className="text-sm font-mono tabular-nums">{telemetry.speed}<span className="text-muted-foreground text-[10px]">/10</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400/60" />
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase">Статус</div>
                  <span className="text-sm font-mono text-emerald-400">{telemetry.status || '—'}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}