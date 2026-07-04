'use client';

import { Slider } from '@/components/ui/slider';
import { useDeviceStore } from '@/store/device-store';
import { PROTOCOL_COMMANDS } from '@/lib/device-types';

async function sendCommand(device: string, command: string, value?: string) {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command, value }),
  });
  return res.json();
}

function getSpeedColor(speed: number): string {
  if (speed <= 3) return 'text-emerald-400';
  if (speed <= 6) return 'text-amber-400';
  return 'text-red-400';
}

function getSpeedTrackColor(speed: number): string {
  if (speed <= 3) return 'bg-emerald-500';
  if (speed <= 6) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function SpeedSlider() {
  const { activeDevice, speed, setSpeed } = useDeviceStore();

  const handleChange = (value: number[]) => {
    const newSpeed = value[0];
    setSpeed(newSpeed);
    sendCommand(activeDevice, PROTOCOL_COMMANDS.SET_SPEED, String(newSpeed));
  };

  return (
    <div className="flex flex-col items-center gap-2 px-2">
      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-semibold">
        Скорость
      </span>
      <span className={`text-5xl font-mono font-bold tabular-nums ${getSpeedColor(speed)}`}>
        {speed}
      </span>
      <div className="w-full px-1">
        <Slider
          value={[speed]}
          onValueChange={handleChange}
          min={1}
          max={10}
          step={1}
          className="w-full"
        />
      </div>
      <div className="flex justify-between w-full text-[10px] text-muted-foreground font-mono px-1">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
      <div className={`h-1 w-16 rounded-full ${getSpeedTrackColor(speed)} transition-colors duration-200`} />
    </div>
  );
}