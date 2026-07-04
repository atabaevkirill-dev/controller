'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useDeviceStore } from '@/store/device-store';
import { DEFAULT_DEVICE_CONFIGS, type DeviceModel, type DeviceConnectionConfig } from '@/lib/device-types';
import { Settings, Unplug, RotateCcw, Zap, Save } from 'lucide-react';

async function sendCommand(device: string, command: string, value?: string) {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command, value }),
  });
  return res.json();
}

export default function ConnectionSettings() {
  const { activeDevice, connectionStatus, setConnectionStatus } = useDeviceStore();
  const [config, setConfig] = useState<DeviceConnectionConfig>(DEFAULT_DEVICE_CONFIGS[activeDevice].config);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  const isDualAxis = activeDevice === 'TL.0400';

  // Load saved config on mount or device change
  useEffect(() => {
    fetch(`/api/devices/${activeDevice}`)
      .then((res) => res.json())
      .then((data) => {
        const device = data?.data || data;
        if (device && device.tiltIp) {
          setConfig({ tiltIp: device.tiltIp, tiltPort: device.tiltPort, panIp: device.panIp, panPort: device.panPort });
        } else {
          setConfig(DEFAULT_DEVICE_CONFIGS[activeDevice].config);
        }
      })
      .catch(() => {
        setConfig(DEFAULT_DEVICE_CONFIGS[activeDevice].config);
      });
  }, [activeDevice]);

  const updateField = useCallback((field: keyof DeviceConnectionConfig, value: string) => {
    setConfig((prev) => {
      const updated = { ...prev, [field]: field.includes('Port') ? parseInt(value, 10) || 0 : value };
      // For non-dual-axis, sync pan = tilt
      if (!isDualAxis) {
        if (field === 'tiltIp') updated.panIp = value;
        if (field === 'tiltPort') updated.panPort = parseInt(value, 10) || 0;
        if (field === 'panIp') updated.tiltIp = value;
        if (field === 'panPort') updated.tiltPort = parseInt(value, 10) || 0;
      }
      return updated;
    });
  }, [isDualAxis]);

  const handleConnect = async () => {
    setConnectionStatus('connecting');
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: activeDevice, command: 'CONNECT', value: JSON.stringify(config) }),
      });
      const data = await res.json();
      setConnectionStatus(data?.success ? 'connected' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  };

  const handleDisconnect = async () => {
    setConnectionStatus('disconnected');
    await sendCommand(activeDevice, 'DISCONNECT');
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: activeDevice, command: 'PING', value: config.tiltIp }),
      });
      const data = await res.json();
      setTestResult(data?.success ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    }
    setTesting(false);
  };

  const handleReset = () => {
    setConfig(DEFAULT_DEVICE_CONFIGS[activeDevice].config);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/devices/${activeDevice}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch {}
    setSaving(false);
  };

  const statusDot = connectionStatus === 'connected'
    ? 'bg-emerald-500'
    : connectionStatus === 'connecting'
    ? 'bg-amber-500 animate-pulse-dot'
    : connectionStatus === 'error'
    ? 'bg-red-500 animate-pulse-dot'
    : 'bg-red-500';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          Подключение
          <span className={`ml-auto w-2.5 h-2.5 rounded-full ${statusDot}`} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {isDualAxis ? (
            <>
              {/* Tilt axis */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tilt (Наклон)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="IP Tilt"
                    value={config.tiltIp}
                    onChange={(e) => updateField('tiltIp', e.target.value)}
                    className="font-mono text-sm h-8"
                  />
                  <Input
                    placeholder="Порт"
                    value={config.tiltPort}
                    onChange={(e) => updateField('tiltPort', e.target.value)}
                    className="font-mono text-sm h-8 w-24"
                    type="number"
                  />
                </div>
              </div>
              {/* Pan axis */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Pan (Поворот)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="IP Pan"
                    value={config.panIp}
                    onChange={(e) => updateField('panIp', e.target.value)}
                    className="font-mono text-sm h-8"
                  />
                  <Input
                    placeholder="Порт"
                    value={config.panPort}
                    onChange={(e) => updateField('panPort', e.target.value)}
                    className="font-mono text-sm h-8 w-24"
                    type="number"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">IP / Порт</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="IP-адрес"
                  value={config.tiltIp}
                  onChange={(e) => updateField('tiltIp', e.target.value)}
                  className="font-mono text-sm h-8"
                />
                <Input
                  placeholder="Порт"
                  value={config.tiltPort}
                  onChange={(e) => updateField('tiltPort', e.target.value)}
                  className="font-mono text-sm h-8 w-24"
                  type="number"
                />
              </div>
            </div>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`text-xs font-mono px-2 py-1 rounded ${testResult === 'ok' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {testResult === 'ok' ? '✓ Устройство доступно' : '✗ Нет ответа от устройства'}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {connectionStatus === 'connected' ? (
            <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleDisconnect}>
              <Unplug className="w-3.5 h-3.5 mr-1.5" />
              Отключить
            </Button>
          ) : (
            <Button size="sm" className="h-8 text-xs" onClick={handleConnect}>
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Подключить
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleTest} disabled={testing}>
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Тест
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Сброс
          </Button>
          <Button variant="secondary" size="sm" className="h-8 text-xs ml-auto" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}