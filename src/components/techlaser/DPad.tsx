'use client';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square } from 'lucide-react';
import { useDeviceStore } from '@/store/device-store';
import { PROTOCOL_COMMANDS, type Direction } from '@/lib/device-types';

const DIRECTIONS: { key: Direction; label: string; gridPos: string; icon: React.ReactNode }[] = [
  { key: 'up', label: 'Вверх', gridPos: 'col-start-2 row-start-1', icon: <ArrowUp className="w-5 h-5" /> },
  { key: 'up-right', label: 'Вверх-вправо', gridPos: 'col-start-3 row-start-1', icon: <ArrowUp className="w-5 h-5 rotate-45" /> },
  { key: 'right', label: 'Вправо', gridPos: 'col-start-3 row-start-2', icon: <ArrowRight className="w-5 h-5" /> },
  { key: 'down-right', label: 'Вниз-вправо', gridPos: 'col-start-3 row-start-3', icon: <ArrowDown className="w-5 h-5 -rotate-45" /> },
  { key: 'down', label: 'Вниз', gridPos: 'col-start-2 row-start-3', icon: <ArrowDown className="w-5 h-5" /> },
  { key: 'down-left', label: 'Вниз-влево', gridPos: 'col-start-1 row-start-3', icon: <ArrowDown className="w-5 h-5 rotate-45" /> },
  { key: 'left', label: 'Влево', gridPos: 'col-start-1 row-start-2', icon: <ArrowLeft className="w-5 h-5" /> },
  { key: 'up-left', label: 'Вверх-влево', gridPos: 'col-start-1 row-start-1', icon: <ArrowUp className="w-5 h-5 -rotate-45" /> },
];

const DIR_TO_COMMAND: Record<string, string> = {
  'up': PROTOCOL_COMMANDS.MOVE_UP, 'down': PROTOCOL_COMMANDS.MOVE_DOWN,
  'left': PROTOCOL_COMMANDS.MOVE_LEFT, 'right': PROTOCOL_COMMANDS.MOVE_RIGHT,
  'up-left': PROTOCOL_COMMANDS.MOVE_UP_LEFT, 'up-right': PROTOCOL_COMMANDS.MOVE_UP_RIGHT,
  'down-left': PROTOCOL_COMMANDS.MOVE_DOWN_LEFT, 'down-right': PROTOCOL_COMMANDS.MOVE_DOWN_RIGHT,
};

async function sendCommand(device: string, command: string, value?: string) {
  try {
    const res = await fetch('/api/command', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, command, value }),
    });
    return res.json();
  } catch { return null; }
}

export default function DPad() {
  const { activeDevice, currentDirection, setCurrentDirection, speed, connectionStatus } = useDeviceStore();
  const isConnected = connectionStatus === 'connected';

  const handleStart = (direction: Direction) => {
    setCurrentDirection(direction);
    if (isConnected) {
      const cmd = DIR_TO_COMMAND[direction];
      if (cmd) sendCommand(activeDevice, cmd, String(speed));
    }
  };

  const handleStop = () => {
    setCurrentDirection(null);
    if (isConnected) sendCommand(activeDevice, PROTOCOL_COMMANDS.STOP);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid grid-cols-3 grid-rows-3 gap-1.5 relative"
        style={{ width: 'clamp(180px, 30vw, 220px)', height: 'clamp(180px, 30vw, 220px)' }}
      >
        {/* Connection ring glow behind the DPad */}
        {isConnected && (
          <div className="absolute inset-[-6px] rounded-2xl border border-emerald-500/20 pointer-events-none animate-fade-in-up" />
        )}

        {DIRECTIONS.map(({ key, label, gridPos, icon }) => {
          const isActive = currentDirection === key;
          return (
            <button
              key={key}
              className={`
                dpad-btn rounded-lg flex items-center justify-center
                bg-secondary text-secondary-foreground border border-border
                transition-all duration-100
                ${!isConnected ? 'opacity-40' : ''}
                ${isActive
                  ? 'glow-green bg-emerald-600/30 border-emerald-500/70 text-emerald-300 scale-95'
                  : 'hover:bg-primary/20 hover:border-primary/40 hover:text-primary-foreground'
                }
                ${gridPos}
              `}
              aria-label={label}
              title={label}
              onMouseDown={() => handleStart(key)}
              onTouchStart={(e) => { e.preventDefault(); handleStart(key); }}
              onMouseUp={handleStop}
              onMouseLeave={handleStop}
              onTouchEnd={handleStop}
              onTouchCancel={handleStop}
            >
              {icon}
            </button>
          );
        })}

        {/* Center STOP button */}
        <button
          className={`
            dpad-btn col-start-2 row-start-2 rounded-full
            flex items-center justify-center
            border-2 font-bold text-xs tracking-wider
            transition-all duration-100
            ${!isConnected
              ? 'bg-destructive/30 text-destructive/50 border-destructive/30'
              : 'bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/80 active:scale-90'
            }
          `}
          aria-label="СТОП"
          onMouseDown={handleStop}
          onTouchStart={(e) => { e.preventDefault(); handleStop(); }}
        >
          <Square className="w-6 h-6" fill="currentColor" />
        </button>
      </div>

      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em]">
        D-Pad
      </span>
    </div>
  );
}