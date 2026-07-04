'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceStore } from '@/store/device-store';
import { PROTOCOL_COMMANDS } from '@/lib/device-types';
import { Play, Square, Waves } from 'lucide-react';
import RotaryEncoder from './RotaryEncoder';

async function sendCommand(device: string, command: string, value?: string) {
  const res = await fetch('/api/command', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command, value }),
  });
  return res.json();
}

function SwingVisualization({ config, isRunning }: {
  config: { startAz: number; endAz: number; startEl: number; endEl: number };
  isRunning: boolean;
}) {
  const [angle, setAngle] = useState(config.startAz);
  const animRef = useRef(0);

  useEffect(() => {
    if (!isRunning) {
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = 0; }
      return;
    }
    let direction = 1;
    let current = config.startAz;

    const animate = () => {
      current += direction * 0.5;
      if (current >= config.endAz) { direction = -1; current = config.endAz; }
      if (current <= config.startAz) { direction = 1; current = config.startAz; }
      setAngle(current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isRunning, config.startAz, config.endAz, config.speed]);

  const displayAngle = isRunning ? angle : config.startAz;

  const progress = config.endAz !== config.startAz
    ? ((displayAngle - config.startAz) / (config.endAz - config.startAz)) * 100
    : 50;

  const elRange = config.endEl - config.startEl;
  const elProgress = elRange !== 0
    ? (progress / 100) * elRange + config.startEl
    : config.startEl;

  // Map to visual coordinates
  const vizX = (displayAngle - config.startAz) / Math.max(1, config.endAz - config.startAz);
  const vizY = 1 - ((elProgress - config.startEl) / Math.max(1, elRange));

  return (
    <div className="relative w-full h-24 rounded-lg bg-secondary/30 overflow-hidden">
      {/* Grid */}
      <div className="absolute inset-0 flex flex-col justify-between px-2 py-1 pointer-events-none">
        <div className="flex justify-between text-[8px] font-mono text-muted-foreground/40">
          <span>{config.endAz.toFixed(0)}°</span>
          <span>{config.startEl.toFixed(0)}°</span>
        </div>
        <div className="flex justify-between text-[8px] font-mono text-muted-foreground/40">
          <span>{config.startAz.toFixed(0)}°</span>
          <span>{config.endEl.toFixed(0)}°</span>
        </div>
      </div>

      {/* Swing zone background */}
      <div className="absolute bottom-2 left-2 right-2 top-8">
        <svg viewBox="0 0 100 60" className="w-full h-full" preserveAspectRatio="none">
          {/* Sweep zone */}
          <path
            d={`M 5,55 L ${5 + vizX * 90},${55 - vizY * 50} L 95,55 Z`}
            fill="currentColor"
            className="text-primary/8"
          />
          {/* Trail path */}
          <path
            d={`M 5,55 Q 50,5 95,55`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.3"
            className="text-muted-foreground/20"
            strokeDasharray="2 2"
          />
          {/* End markers */}
          <circle cx="5" cy="55" r="2" fill="currentColor" className="text-amber-500/60" />
          <circle cx="95" cy="55" r="2" fill="currentColor" className="text-amber-500/60" />
          {/* Progress line */}
          <line
            x1={5 + vizX * 90} y1={55 - vizY * 50} x2={5 + vizX * 90} y2="55"
            stroke="currentColor" strokeWidth="0.5"
            className={isRunning ? 'text-emerald-500' : 'text-muted-foreground/30'}
          />
          {/* Current position dot */}
          <circle
            cx={5 + vizX * 90} cy={55 - vizY * 50}
            r={isRunning ? 2.5 : 1.8}
            className={isRunning ? 'fill-emerald-400' : 'fill-muted-foreground'}
          >
            {isRunning && (
              <animate attributeName="r" values="2.5;4;2.5" dur="1s" repeatCount="indefinite" />
            )}
          </circle>
        </svg>
      </div>

      {/* Running indicator */}
      {isRunning && (
        <div className="absolute top-1.5 right-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-dot" />
          <span className="text-[8px] text-amber-400 font-mono">SWEEP</span>
        </div>
      )}
    </div>
  );
}

export default function SwingControl() {
  const { activeDevice, swing, setSwing, connectionStatus } = useDeviceStore();
  const isConnected = connectionStatus === 'connected';

  const handleStart = () => {
    const value = `${swing.startAz},${swing.endAz},${swing.startEl},${swing.endEl},${swing.speed},${swing.cycleCount}`;
    sendCommand(activeDevice, PROTOCOL_COMMANDS.START_SWING, value);
    setSwing({ enabled: true });
  };

  const handleStop = () => {
    sendCommand(activeDevice, PROTOCOL_COMMANDS.STOP_SWING);
    setSwing({ enabled: false });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Waves className="w-4 h-4 text-primary" />
          Качание
          {swing.enabled && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-dot" />
              АКТИВНО
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Visualization */}
        <SwingVisualization
          config={{
            startAz: swing.startAz, endAz: swing.endAz,
            startEl: swing.startEl, endEl: swing.endEl,
          }}
          isRunning={swing.enabled}
        />

        <div className="grid grid-cols-3 gap-2 items-end justify-items-center">
          <RotaryEncoder value={swing.startAz} onChange={(v) => setSwing({ startAz: v })} min={-180} max={180} step={1} decimals={1} label="Нач. АЗ" unit="°" size="sm" />
          <RotaryEncoder value={swing.endAz} onChange={(v) => setSwing({ endAz: v })} min={-180} max={180} step={1} decimals={1} label="Кон. АЗ" unit="°" size="sm" />
          <RotaryEncoder value={swing.startEl} onChange={(v) => setSwing({ startEl: v })} min={-90} max={90} step={1} decimals={1} label="Нач. УМ" unit="°" size="sm" />
          <RotaryEncoder value={swing.endEl} onChange={(v) => setSwing({ endEl: v })} min={-90} max={90} step={1} decimals={1} label="Кон. УМ" unit="°" size="sm" />
          <RotaryEncoder value={swing.speed} onChange={(v) => setSwing({ speed: v })} min={1} max={10} step={1} decimals={0} label="Скорость" unit="" size="sm" />
          <RotaryEncoder value={swing.cycleCount} onChange={(v) => setSwing({ cycleCount: v })} min={0} max={999} step={1} decimals={0} label="Циклы" unit="" size="sm" />
        </div>

        <div className="flex gap-2 pt-1">
          {!swing.enabled ? (
            <Button size="sm" className="h-8 text-xs flex-1" onClick={handleStart} disabled={!isConnected}>
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Старт
            </Button>
          ) : (
            <Button variant="destructive" size="sm" className="h-8 text-xs flex-1" onClick={handleStop}>
              <Square className="w-3.5 h-3.5 mr-1.5" />
              Стоп
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}