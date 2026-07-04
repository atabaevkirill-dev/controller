'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useDeviceStore } from '@/store/device-store';
import { PROTOCOL_COMMANDS } from '@/lib/device-types';
import { Play, Square } from 'lucide-react';

async function sendCommand(device: string, command: string, value?: string) {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command, value }),
  });
  return res.json();
}

export default function SwingControl() {
  const { activeDevice, swing, setSwing } = useDeviceStore();

  const handleStart = () => {
    const value = `${swing.startAz},${swing.endAz},${swing.startEl},${swing.endEl},${swing.speed},${swing.cycleCount}`;
    sendCommand(activeDevice, PROTOCOL_COMMANDS.START_SWING, value);
    setSwing({ enabled: true });
  };

  const handleStop = () => {
    sendCommand(activeDevice, PROTOCOL_COMMANDS.STOP_SWING);
    setSwing({ enabled: false });
  };

  const updateField = (field: string, val: string) => {
    const num = parseFloat(val) || 0;
    setSwing({ [field]: num });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Play className="w-4 h-4 text-muted-foreground" />
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
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Нач. Азимут (°)</Label>
            <Input
              type="number"
              step="0.1"
              value={swing.startAz}
              onChange={(e) => updateField('startAz', e.target.value)}
              className="font-mono text-sm h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Кон. Азимут (°)</Label>
            <Input
              type="number"
              step="0.1"
              value={swing.endAz}
              onChange={(e) => updateField('endAz', e.target.value)}
              className="font-mono text-sm h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Нач. УМ (°)</Label>
            <Input
              type="number"
              step="0.1"
              value={swing.startEl}
              onChange={(e) => updateField('startEl', e.target.value)}
              className="font-mono text-sm h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Кон. УМ (°)</Label>
            <Input
              type="number"
              step="0.1"
              value={swing.endEl}
              onChange={(e) => updateField('endEl', e.target.value)}
              className="font-mono text-sm h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Скорость</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={swing.speed}
              onChange={(e) => updateField('speed', e.target.value)}
              className="font-mono text-sm h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Циклы (0=∞)</Label>
            <Input
              type="number"
              min={0}
              value={swing.cycleCount}
              onChange={(e) => updateField('cycleCount', e.target.value)}
              className="font-mono text-sm h-8"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {!swing.enabled ? (
            <Button size="sm" className="h-8 text-xs flex-1" onClick={handleStart}>
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