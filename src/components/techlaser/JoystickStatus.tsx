'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceStore } from '@/store/device-store';
import { PROTOCOL_COMMANDS, type Direction } from '@/lib/device-types';
import { Gamepad2 } from 'lucide-react';

async function sendCommand(device: string, command: string, value?: string) {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command, value }),
  });
  return res.json();
}

const DEADZONE = 0.2;

function getDirectionFromAxes(x: number, y: number): Direction | null {
  if (Math.abs(x) < DEADZONE && Math.abs(y) < DEADZONE) return null;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const angle = Math.atan2(y, x) * (180 / Math.PI);

  // 8-direction mapping
  if (angle >= -22.5 && angle < 22.5) return 'right';
  if (angle >= 22.5 && angle < 67.5) return 'down-right';
  if (angle >= 67.5 && angle < 112.5) return 'down';
  if (angle >= 112.5 && angle < 157.5) return 'down-left';
  if (angle >= 157.5 || angle < -157.5) return 'left';
  if (angle >= -157.5 && angle < -112.5) return 'up-left';
  if (angle >= -112.5 && angle < -67.5) return 'up';
  if (angle >= -67.5 && angle < -22.5) return 'up-right';
  return null;
}

const DIR_TO_COMMAND: Record<string, string> = {
  'up': PROTOCOL_COMMANDS.MOVE_UP,
  'down': PROTOCOL_COMMANDS.MOVE_DOWN,
  'left': PROTOCOL_COMMANDS.MOVE_LEFT,
  'right': PROTOCOL_COMMANDS.MOVE_RIGHT,
  'up-left': PROTOCOL_COMMANDS.MOVE_UP_LEFT,
  'up-right': PROTOCOL_COMMANDS.MOVE_UP_RIGHT,
  'down-left': PROTOCOL_COMMANDS.MOVE_DOWN_LEFT,
  'down-right': PROTOCOL_COMMANDS.MOVE_DOWN_RIGHT,
};

export default function JoystickStatus() {
  const { activeDevice, joystickConnected, setJoystickConnected, joystickName, setJoystickName, setCurrentDirection, speed, setSpeed, connectionStatus } = useDeviceStore();
  const [axes, setAxes] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [buttons, setButtons] = useState<boolean[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastDir = useRef<Direction | null>(null);

  const handleGamepad = useCallback((gp: Gamepad) => {
    setAxes(gp.axes as [number, number, number, number]);
    setButtons(Array.from(gp.buttons).map((b) => b.pressed));

    // Map left stick (axes 0, 1) to direction
    const x = gp.axes[0] || 0;
    const y = gp.axes[1] || 0;
    const dir = getDirectionFromAxes(x, y);

    if (dir !== lastDir.current) {
      lastDir.current = dir;
      if (dir) {
        setCurrentDirection(dir);
        const cmd = DIR_TO_COMMAND[dir];
        if (cmd && connectionStatus === 'connected') {
          sendCommand(activeDevice, cmd, String(speed));
        }
      } else {
        setCurrentDirection(null);
        if (connectionStatus === 'connected') {
          sendCommand(activeDevice, PROTOCOL_COMMANDS.STOP);
        }
      }
    }

    // Map buttons: 0 (A) = speed up, 1 (B) = stop, 2 (X) = speed down
    if (gp.buttons[0]?.pressed) {
      // Not triggering on every poll — handled via event
    }
    if (gp.buttons[2]?.pressed) {
      // Not triggering on every poll
    }
  }, [activeDevice, connectionStatus, setCurrentDirection, speed]);

  const handleButtonDown = useCallback((e: GamepadEvent) => {
    const gp = e.gamepad;
    // Button 0 (A): Speed up
    if (gp.buttons[0]?.pressed) {
      setSpeed(Math.min(10, useDeviceStore.getState().speed + 1));
    }
    // Button 2 (X): Speed down
    if (gp.buttons[2]?.pressed) {
      setSpeed(Math.max(1, useDeviceStore.getState().speed - 1));
    }
    // Button 1 (B): Stop
    if (gp.buttons[1]?.pressed) {
      setCurrentDirection(null);
      if (connectionStatus === 'connected') {
        sendCommand(activeDevice, PROTOCOL_COMMANDS.STOP);
      }
    }
  }, [activeDevice, connectionStatus, setCurrentDirection, setSpeed]);

  useEffect(() => {
    // Listen for connect/disconnect
    const onConnect = (e: GamepadEvent) => {
      setJoystickConnected(true);
      setJoystickName(e.gamepad.id);
    };
    const onDisconnect = () => {
      setJoystickConnected(false);
      setJoystickName('');
      setAxes([0, 0, 0, 0]);
      setButtons([]);
      lastDir.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    window.addEventListener('gamepadbuttondown', handleButtonDown as EventListener);

    // Check for already connected gamepads
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp) {
        setJoystickConnected(true);
        setJoystickName(gp.id);
        break;
      }
    }

    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      window.removeEventListener('gamepadbuttondown', handleButtonDown as EventListener);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [handleButtonDown, setJoystickConnected, setJoystickName]);

  // Poll gamepad state every 50ms when connected
  useEffect(() => {
    if (joystickConnected) {
      pollRef.current = setInterval(() => {
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
          if (gp) {
            handleGamepad(gp);
            break;
          }
        }
      }, 50);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [joystickConnected, handleGamepad]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-muted-foreground" />
          Геймпад
          {joystickConnected && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              ПОДКЛЮЧЁН
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {joystickConnected ? (
          <div className="space-y-3">
            {/* Gamepad name */}
            <div className="text-xs text-muted-foreground font-mono truncate" title={joystickName}>
              {joystickName}
            </div>

            {/* Visual gamepad indicator */}
            <div className="flex items-center justify-center">
              <svg width="120" height="100" viewBox="0 0 120 100" className="text-muted-foreground">
                {/* Controller body */}
                <rect x="15" y="20" width="90" height="60" rx="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
                {/* Left stick */}
                <circle cx="42" cy="50" r="14" fill="none" stroke="currentColor" strokeWidth="1" />
                {/* Left stick position indicator */}
                <circle
                  cx={42 + (axes[0] || 0) * 10}
                  cy={50 + (axes[1] || 0) * 10}
                  r="4"
                  className="fill-primary"
                />
                {/* Right stick */}
                <circle cx="78" cy="50" r="14" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle
                  cx={78 + (axes[2] || 0) * 10}
                  cy={50 + (axes[3] || 0) * 10}
                  r="4"
                  className="fill-primary"
                />
                {/* Buttons */}
                <circle cx="42" cy="35" r="3" className={buttons[2] ? 'fill-primary' : 'fill-none'} stroke="currentColor" strokeWidth="1" />
                <circle cx="35" cy="42" r="3" className={buttons[3] ? 'fill-primary' : 'fill-none'} stroke="currentColor" strokeWidth="1" />
                <circle cx="49" cy="42" r="3" className={buttons[1] ? 'fill-primary' : 'fill-none'} stroke="currentColor" strokeWidth="1" />
                <circle cx="42" cy="49" r="3" className={buttons[0] ? 'fill-primary' : 'fill-none'} stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>

            {/* Axis values */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="bg-secondary/30 rounded px-2 py-1">
                <span className="text-muted-foreground">LX:</span>{' '}
                <span className="text-foreground">{(axes[0] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-secondary/30 rounded px-2 py-1">
                <span className="text-muted-foreground">LY:</span>{' '}
                <span className="text-foreground">{(axes[1] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-secondary/30 rounded px-2 py-1">
                <span className="text-muted-foreground">RX:</span>{' '}
                <span className="text-foreground">{(axes[2] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-secondary/30 rounded px-2 py-1">
                <span className="text-muted-foreground">RY:</span>{' '}
                <span className="text-foreground">{(axes[3] || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Button mapping help */}
            <div className="text-[9px] text-muted-foreground space-y-0.5">
              <div><span className="text-foreground font-medium">A</span> — скорость +1</div>
              <div><span className="text-foreground font-medium">X</span> — скорость −1</div>
              <div><span className="text-foreground font-medium">B</span> — стоп</div>
              <div><span className="text-foreground font-medium">Левый стик</span> — направление</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Gamepad2 className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <span className="text-xs text-muted-foreground">
              Подключите геймпад
            </span>
            <span className="text-[10px] text-muted-foreground/60 mt-1">
              Поддерживаются стандартные USB/Bluetooth геймпады
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}