'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useDeviceStore } from '@/store/device-store';
import { useIsMobile } from '@/hooks/use-mobile';
import DPad from '@/components/techlaser/DPad';
import DeviceSelector from '@/components/techlaser/DeviceSelector';
import ConnectionSettings from '@/components/techlaser/ConnectionSettings';
import SpeedSlider from '@/components/techlaser/SpeedSlider';
import Telemetry from '@/components/techlaser/Telemetry';
import PositionControl from '@/components/techlaser/PositionControl';
import SwingControl from '@/components/techlaser/SwingControl';
import Presets from '@/components/techlaser/Presets';
import Diagnostics from '@/components/techlaser/Diagnostics';
import JoystickStatus from '@/components/techlaser/JoystickStatus';
import ExtendedSettings from '@/components/techlaser/ExtendedSettings';
import MobileQrButton from '@/components/techlaser/MobileQrButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Crosshair, Settings, Bookmark, Terminal, Gamepad2, Zap, SlidersHorizontal, Smartphone, Wifi, Navigation, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';

async function sendCommand(device: string, command: string, value?: string) {
  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, command, value }),
    });
    return res.json();
  } catch {
    return null;
  }
}

export default function TechLaserController() {
  const {
    activeDevice,
    connectionStatus,
    setConnectionStatus,
    setConnectionError,
    addCommandLog,
    joystickConnected,
    commandLog,
    setIsMobileView,
    bridgeConnected,
    setBridgeConnected,
  } = useDeviceStore();

  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('presets');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const [connectAnim, setConnectAnim] = useState(false);

  // Connect to device bridge via WebSocket
  useEffect(() => {
    let mounted = true;
    const connectBridge = () => {
      try {
        const ws = new WebSocket(`ws://${window.location.host}/?XTransformPort=3002`);
        ws.onopen = () => {
          if (!mounted) return;
          setBridgeConnected(true);
        };
        ws.onmessage = (event) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'telemetry' && data.model === activeDevice) {
              useDeviceStore.getState().setTelemetry({
                azimuth: data.azimuth, elevation: data.elevation,
                speed: data.speed, status: data.status,
              });
            }
            if (data.type === 'device-status' && data.model === activeDevice) {
              setConnectionStatus(data.status === 'connected' ? 'connected' : 'disconnected');
              if (data.status === 'error') setConnectionError(data.message);
            }
            if (data.type === 'log' && data.model === activeDevice) {
              addCommandLog({
                id: `${Date.now()}-${Math.random()}`, deviceId: data.model,
                command: data.command, status: data.status === 'success' ? 'success' : 'error',
                createdAt: data.timestamp || new Date().toISOString(),
              });
            }
          } catch {}
        };
        ws.onclose = () => {
          if (!mounted) return;
          setBridgeConnected(false);
          wsRef.current = null;
          reconnectTimer.current = setTimeout(connectBridge, 3000);
        };
        ws.onerror = () => {};
        wsRef.current = ws;
      } catch {}
    };
    connectBridge();
    return () => {
      mounted = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, []);

  const handleConnect = useCallback(async () => {
    setConnectionStatus('connecting');
    setConnectionError(null);
    setConnectAnim(true);
    const result = await sendCommand(activeDevice, 'CONNECT');
    if (result?.success) {
      setConnectionStatus('connected');
      setTimeout(() => setConnectAnim(false), 1500);
    } else {
      setConnectionStatus('error');
      setConnectionError(result?.error || 'Не удалось подключиться');
      setConnectAnim(false);
    }
    fetch('/api/devices').catch(() => {});
  }, [activeDevice, setConnectionStatus, setConnectionError]);

  const handleDisconnect = useCallback(async () => {
    await sendCommand(activeDevice, 'DISCONNECT');
    setConnectionStatus('disconnected');
    setConnectionError(null);
  }, [activeDevice, setConnectionStatus, setConnectionError]);

  const connColor = connectionStatus === 'connected' ? 'text-emerald-400' : connectionStatus === 'connecting' ? 'text-amber-400' : 'text-red-400/60';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-500 ${
              connectionStatus === 'connected' ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-secondary border-border'
            }`}>
              <Crosshair className={`w-4.5 h-4.5 transition-colors duration-500 ${
                connectionStatus === 'connected' ? 'text-emerald-400' : 'text-muted-foreground'
              }`} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
                SaaS <span className="text-primary">Controller</span>
              </h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block tracking-wide">
                Система управления ОПУ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <DeviceSelector />
            <MobileQrButton />
            {!isMobile && (
              <Button
                size="sm"
                variant={connectionStatus === 'connected' ? 'outline' : 'default'}
                className={`h-8 text-xs gap-1.5 transition-all duration-300 ${
                  connectionStatus === 'connected' ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10' : ''
                }`}
                onClick={() => connectionStatus === 'connected' ? handleDisconnect() : handleConnect()}
              >
                <Wifi className={`w-3.5 h-3.5 transition-colors ${connColor}`} />
                {connectionStatus === 'connected' ? 'Откл.' : 'Подкл.'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Connection animation overlay */}
      {connectAnim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
          <div className="relative">
            <div className={`w-16 h-16 rounded-full border-2 ${connectionStatus === 'connected' ? 'border-emerald-500' : 'border-amber-500'}`} />
            <div className={`absolute inset-0 rounded-full border-2 animate-ping ${
              connectionStatus === 'connected' ? 'border-emerald-500' : 'border-amber-500'
            }`} style={{ animationDuration: '1s' }} />
            <Crosshair className="absolute inset-0 m-auto w-6 h-6 text-emerald-400" />
          </div>
        </div>
      )}

      {/* Connection Error Banner */}
      {connectionStatus === 'error' && useDeviceStore.getState().connectionError && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2 text-xs text-destructive font-mono animate-fade-in-up">
          ⚠ {useDeviceStore.getState().connectionError}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-4 py-3 sm:py-4">
        {isMobile ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full transition-colors ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-xs text-muted-foreground font-mono">{activeDevice}</span>
                {bridgeConnected && (
                  <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                    <Smartphone className="w-2.5 h-2.5" /> Bridge
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant={connectionStatus === 'connected' ? 'destructive' : 'default'}
                className="h-7 text-[10px]"
                onClick={() => connectionStatus === 'connected' ? handleDisconnect() : handleConnect()}
              >
                {connectionStatus === 'connected' ? 'Откл.' : 'Подкл.'}
              </Button>
            </div>

            <div className="flex items-start justify-center gap-4">
              <DPad />
              <div className="pt-2 w-28"><SpeedSlider /></div>
            </div>

            <Card className="bg-card border-border">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-around text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Азимут</div>
                    <div className="text-xl font-mono font-bold tabular-nums text-primary">0.0°</div>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">УМ</div>
                    <div className="text-xl font-mono font-bold tabular-nums text-primary">0.0°</div>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Скорость</div>
                    <div className="text-xl font-mono font-bold tabular-nums">5</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Presets />

            <MobileExpandableSection title="Управление" icon={<Crosshair className="w-4 h-4" />}>
              <div className="space-y-3">
                <PositionControl />
                <SwingControl />
              </div>
            </MobileExpandableSection>

            <MobileExpandableSection title="Расширенные настройки" icon={<SlidersHorizontal className="w-4 h-4" />}>
              <ExtendedSettings />
            </MobileExpandableSection>

            <MobileExpandableSection title="Настройки подключения" icon={<Settings className="w-4 h-4" />}>
              <ConnectionSettings />
            </MobileExpandableSection>

            <MobileExpandableSection title="Журнал команд" icon={<Terminal className="w-4 h-4" />} badge={commandLog.length}>
              <Diagnostics />
            </MobileExpandableSection>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Left Column — Controls */}
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardContent className="py-5 flex flex-col items-center gap-4">
                  <DPad />
                  <Separator className="w-full" />
                  <SpeedSlider />
                </CardContent>
              </Card>
              <JoystickStatus />
            </div>

            {/* Right Column — Telemetry + Tabs */}
            <div className="space-y-4">
              <Telemetry />
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-6 h-9">
                  <TabsTrigger value="presets" className="text-xs gap-1">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Пресеты</span>
                  </TabsTrigger>
                  <TabsTrigger value="position" className="text-xs gap-1">
                    <Navigation className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Позиция</span>
                  </TabsTrigger>
                  <TabsTrigger value="swing" className="text-xs gap-1">
                    <Waves className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Качание</span>
                  </TabsTrigger>
                  <TabsTrigger value="extended" className="text-xs gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Протокол</span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="text-xs gap-1">
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Сеть</span>
                  </TabsTrigger>
                  <TabsTrigger value="diagnostics" className="text-xs gap-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Лог</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="presets" className="mt-3"><Presets /></TabsContent>
                <TabsContent value="position" className="mt-3"><PositionControl /></TabsContent>
                <TabsContent value="swing" className="mt-3"><SwingControl /></TabsContent>
                <TabsContent value="extended" className="mt-3"><ExtendedSettings /></TabsContent>
                <TabsContent value="settings" className="mt-3"><ConnectionSettings /></TabsContent>
                <TabsContent value="diagnostics" className="mt-3"><Diagnostics /></TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/60 backdrop-blur-sm mt-auto">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Crosshair className="w-3 h-3" />
              SaaS Controller v2.0
            </span>
            <span className="hidden sm:inline">|</span>
            <span className={`hidden sm:flex items-center gap-1.5 transition-colors duration-300 ${connColor}`}>
              <Zap className="w-3 h-3" />
              {connectionStatus === 'connected' ? 'Подключено' : connectionStatus === 'connecting' ? 'Подключение...' : 'Отключено'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {bridgeConnected && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Smartphone className="w-3 h-3" /> Bridge
              </span>
            )}
            {joystickConnected && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Gamepad2 className="w-3 h-3" /> Gamepad
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {activeDevice}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MobileExpandableSection({
  title, icon, badge, children,
}: {
  title: string; icon: React.ReactNode; badge?: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
          {badge !== undefined && badge > 0 && (
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full font-mono">{badge}</span>
          )}
        </span>
        <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && <div className="mt-1 animate-fade-in-up">{children}</div>}
    </div>
  );
}