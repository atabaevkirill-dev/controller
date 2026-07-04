'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceStore } from '@/store/device-store';
import { PROTOCOL_COMMANDS } from '@/lib/device-types';
import { Crosshair, Home, Navigation } from 'lucide-react';
import RotaryEncoder from './RotaryEncoder';

async function sendCommand(device: string, command: string, value?: string) {
  const res = await fetch('/api/command', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command, value }),
  });
  return res.json();
}

function RadarVisualization({ azimuth, elevation, targetAz, targetEl }: {
  azimuth: number; elevation: number; targetAz: number | null; targetEl: number | null;
}) {
  const azClamped = Math.max(-180, Math.min(180, azimuth));
  const elClamped = Math.max(-90, Math.min(90, elevation));

  // Polar coords: azimuth -> angle, elevation -> radius
  const azRad = (azClamped + 90) * (Math.PI / 180);
  const elNorm = (elClamped + 90) / 180; // 0 to 1
  const pointR = elNorm * 38;
  const pointX = 50 + pointR * Math.cos(azRad);
  const pointY = 50 - pointR * Math.sin(azRad);

  // Target crosshair
  const targetVisible = targetAz !== null && targetEl !== null;
  const tAzRad = ((targetAz || 0) + 90) * (Math.PI / 180);
  const tElNorm = ((targetEl || 0) + 90) / 180;
  const tR = tElNorm * 38;
  const tX = 50 + tR * Math.cos(tAzRad);
  const tY = 50 - tR * Math.sin(tAzRad);

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Grid rings */}
      {[25, 50, 75].map((r) => (
        <circle key={r} cx="50" cy="50" r={r * 0.5} fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.15" />
      ))}

      {/* Cross hairs */}
      <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="0.3" opacity="0.12" />
      <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="0.3" opacity="0.12" />
      <line x1="15" y1="15" x2="85" y2="85" stroke="currentColor" strokeWidth="0.2" opacity="0.06" />
      <line x1="85" y1="15" x2="15" y2="85" stroke="currentColor" strokeWidth="0.2" opacity="0.06" />

      {/* Outer ring with degree markers */}
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = (i * 10 - 90) * (Math.PI / 180);
        const inner = i % 9 === 0 ? 38 : 41;
        const outer = 44;
        return (
          <line
            key={i}
            x1={50 + inner * Math.cos(angle)}
            y1={50 + inner * Math.sin(angle)}
            x2={50 + outer * Math.cos(angle)}
            y2={50 + outer * Math.sin(angle)}
            stroke="currentColor" strokeWidth={i % 9 === 0 ? 0.6 : 0.3}
            opacity={i % 9 === 0 ? 0.5 : 0.2}
          />
        );
      })}

      {/* Cardinal labels */}
      {[{ label: '0°', angle: -90 }, { label: '90°', angle: 0 }, { label: '180°', angle: 90 }, { label: '-90°', angle: 180 }].map(({ label, angle }) => {
        const rad = angle * (Math.PI / 180);
        return (
          <text
            key={label}
            x={50 + 47 * Math.cos(rad)}
            y={50 + 47 * Math.sin(rad) + 2.5}
            textAnchor="middle" fontSize="3.5" fill="currentColor" opacity="0.4" fontFamily="monospace"
          >
            {label}
          </text>
        );
      })}

      {/* Target indicator */}
      {targetVisible && (
        <g opacity="0.5">
          <line x1={tX - 4} y1={tY} x2={tX + 4} y2={tY} stroke="#f59e0b" strokeWidth="0.6" />
          <line x1={tX} y1={tY - 4} x2={tX} y2={tY + 4} stroke="#f59e0b" strokeWidth="0.6" />
          <circle cx={tX} cy={tY} r="2.5" fill="none" stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="1 1" />
        </g>
      )}

      {/* Trail line from center to current position */}
      <line x1="50" y1="50" x2={pointX} y2={pointY} stroke="#10b981" strokeWidth="0.4" opacity="0.4" strokeDasharray="1.5 1" />

      {/* Current position glow */}
      <circle cx={pointX} cy={pointY} r="3" fill="#10b981" opacity="0.2">
        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={pointX} cy={pointY} r="1.8" fill="#10b981" />
    </svg>
  );
}

export default function PositionControl() {
  const { activeDevice, telemetry, targetAzimuth, targetElevation, setTargetAzimuth, setTargetElevation, connectionStatus } = useDeviceStore();
  const isConnected = connectionStatus === 'connected';
  const [mounted, setMounted] = useState(false);
  const targetAzNum = useMemo(() => parseFloat(targetAzimuth) || 0, [targetAzimuth]);
  const targetElNum = useMemo(() => parseFloat(targetElevation) || 0, [targetElevation]);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const handleGoTo = () => {
    sendCommand(activeDevice, PROTOCOL_COMMANDS.GOTO_POSITION, `${targetAzNum},${targetElNum}`);
  };

  const handleHome = () => {
    sendCommand(activeDevice, PROTOCOL_COMMANDS.HOME);
  };

  const hasTarget = targetAzNum !== 0 || targetElNum !== 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Navigation className="w-4 h-4 text-primary" />
          Позиционирование
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Radar visualization — only render on client to avoid hydration mismatch from trig */}
        <div className="relative w-full aspect-square max-w-[220px] mx-auto">
          {mounted && (
            <RadarVisualization
              azimuth={telemetry.azimuth}
              elevation={telemetry.elevation}
              targetAz={hasTarget ? targetAzNum : null}
              targetEl={hasTarget ? targetElNum : null}
            />
          )}
          {/* Overlay: current values */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
            <div className="text-[9px] text-muted-foreground font-mono">
              AZ {telemetry.azimuth.toFixed(1)}° · EL {telemetry.elevation.toFixed(1)}°
            </div>
          </div>
        </div>

        {/* Target inputs — rotary encoders */}
        <div className="flex items-center justify-center gap-6">
          <RotaryEncoder
            value={targetAzNum}
            onChange={(v) => setTargetAzimuth(String(v))}
            min={-180} max={180} step={0.1} decimals={1}
            label="Целевой АЗ" unit="°" size="md"
          />
          <RotaryEncoder
            value={targetElNum}
            onChange={(v) => setTargetElevation(String(v))}
            min={-90} max={90} step={0.1} decimals={1}
            label="Целевой УМ" unit="°" size="md"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="h-8 text-xs flex-1" onClick={handleGoTo} disabled={!isConnected}>
            <Crosshair className="w-3.5 h-3.5 mr-1.5" />
            Перейти
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleHome} disabled={!isConnected}>
            <Home className="w-3.5 h-3.5 mr-1.5" />
            Домой
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}