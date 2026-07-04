'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useDeviceStore } from '@/store/device-store';
import { PROTOCOL_COMMANDS } from '@/lib/device-types';
import { Crosshair, Home } from 'lucide-react';

async function sendCommand(device: string, command: string, value?: string) {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command, value }),
  });
  return res.json();
}

export default function PositionControl() {
  const { activeDevice, telemetry, targetAzimuth, targetElevation, setTargetAzimuth, setTargetElevation } = useDeviceStore();

  const handleGoTo = () => {
    const az = parseFloat(targetAzimuth) || 0;
    const el = parseFloat(targetElevation) || 0;
    sendCommand(activeDevice, PROTOCOL_COMMANDS.GOTO_POSITION, `${az},${el}`);
  };

  const handleHome = () => {
    sendCommand(activeDevice, PROTOCOL_COMMANDS.HOME);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-muted-foreground" />
          Позиционирование
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current position */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Текущий Азимут</Label>
            <div className="text-lg font-mono font-bold tabular-nums text-foreground">
              {telemetry.azimuth.toFixed(1)}°
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Текущий УМ</Label>
            <div className="text-lg font-mono font-bold tabular-nums text-foreground">
              {telemetry.elevation.toFixed(1)}°
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Target position inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Целевой Азимут (°)</Label>
            <Input
              type="number"
              step="0.1"
              value={targetAzimuth}
              onChange={(e) => setTargetAzimuth(e.target.value)}
              className="font-mono text-sm h-8"
              placeholder="0.0"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Целевой УМ (°)</Label>
            <Input
              type="number"
              step="0.1"
              value={targetElevation}
              onChange={(e) => setTargetElevation(e.target.value)}
              className="font-mono text-sm h-8"
              placeholder="0.0"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="h-8 text-xs flex-1" onClick={handleGoTo}>
            <Crosshair className="w-3.5 h-3.5 mr-1.5" />
            Перейти
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleHome}>
            <Home className="w-3.5 h-3.5 mr-1.5" />
            Домой
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}