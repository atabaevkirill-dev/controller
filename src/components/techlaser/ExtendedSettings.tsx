'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDeviceStore } from '@/store/device-store';
import type { DeviceModel, ExtendedSettings, DualAxisExtendedSettings } from '@/lib/device-types';
import { DEFAULT_EXTENDED_SETTINGS } from '@/lib/device-types';
import { getSettingsFields, getModelInfo, buildExtendedCommand, buildLimitsCommand, getAllSettingsCommands } from '@/lib/device-protocols';
import type { SettingField, SelectSettingField } from '@/lib/device-protocols';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { Settings, Send, RotateCcw, Info, Zap, Thermometer, Shield } from 'lucide-react';

type FieldFeedback = { key: string; ok: boolean };

export default function ExtendedSettings() {
  const { activeDevice, connectionStatus } = useDeviceStore();

  const [settings, setSettings] = useState<ExtendedSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FieldFeedback | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [diagLoading, setDiagLoading] = useState<string | null>(null);
  const [diagResults, setDiagResults] = useState<Record<string, boolean>>({});
  const [diagResult, setDiagResult] = useState<{ ok: boolean; text: string } | null>(null);

  const modelInfo = getModelInfo(activeDevice);
  const fields = getSettingsFields(activeDevice);
  const isConnected = connectionStatus === 'connected';

  // Fetch settings from DB on mount / device change
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/extended-settings/${activeDevice}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSettings(json.data);
        } else {
          // No saved settings — use defaults
          setSettings(DEFAULT_EXTENDED_SETTINGS[activeDevice]);
        }
      } else {
        setSettings(DEFAULT_EXTENDED_SETTINGS[activeDevice]);
      }
    } catch {
      setSettings(DEFAULT_EXTENDED_SETTINGS[activeDevice]);
    } finally {
      setLoading(false);
    }
  }, [activeDevice]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings to DB
  const saveToDb = async (updated: ExtendedSettings) => {
    try {
      await fetch(`/api/extended-settings/${activeDevice}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {
      // silent fail — optimistic
    }
  };

  // Send a single command to device (TCP)
  const sendToDevice = async (command: string, value: string) => {
    if (!isConnected) return;
    try {
      await fetch(`/api/extended-settings/${activeDevice}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, value }),
      });
    } catch {
      // silent
    }
  };

  // Flash feedback for a field
  const flashFeedback = (key: string, ok: boolean) => {
    setFeedback({ key, ok });
    setTimeout(() => setFeedback(null), 1500);
  };

  // Handle numeric field change
  const handleNumericChange = (field: SettingField, raw: string) => {
    if (!settings) return;
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    const clamped = Math.min(field.max, Math.max(field.min, val));
    const updated = { ...settings, [field.key]: clamped };
    setSettings(updated);
    saveToDb(updated);
  };

  // Handle numeric field send button
  const handleNumericSend = (field: SettingField) => {
    if (!settings) return;
    const val = (settings as any)[field.key];
    const cmd = buildExtendedCommand(activeDevice, field.key, val);
    if (cmd) {
      const valueStr = field.formatValue ? field.formatValue(val) : String(val);
      sendToDevice(cmd, valueStr);
      flashFeedback(field.key, true);
    }
  };

  // Handle numeric field blur — also send to device
  const handleNumericBlur = (field: SettingField) => {
    handleNumericSend(field);
  };

  // Handle limits change — all 4 values sent together
  const handleLimitChange = (key: 'azMin' | 'azMax' | 'elMin' | 'elMax', raw: string) => {
    if (!settings) return;
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    saveToDb(updated);
  };

  // Send limits command on blur of any limit field
  const handleLimitBlur = () => {
    if (!settings || !isConnected) return;
    const limitsCmd = buildLimitsCommand(settings);
    const match = limitsCmd.match(/^(.+)\r\n$/);
    if (match) {
      const parts = match[1].split(' ');
      sendToDevice(parts[0], parts.slice(1).join(' '));
    }
    flashFeedback('limits', true);
  };

  // Handle select field change
  const handleSelectChange = (field: SelectSettingField, value: string) => {
    if (!settings) return;
    const updated = { ...settings, [field.key]: value };
    setSettings(updated);
    saveToDb(updated);

    // Send to device
    if (isConnected) {
      const cmd = buildExtendedCommand(activeDevice, field.key, value);
      if (cmd) {
        sendToDevice(cmd, value);
        flashFeedback(field.key, true);
      }
    }
  };

  // Handle velocity feedback toggle
  const handleVelocityFeedback = (checked: boolean) => {
    if (!settings) return;
    const updated = { ...settings, velocityFeedback: checked } as ExtendedSettings;
    setSettings(updated);
    saveToDb(updated);
    if (isConnected) {
      const cmd = buildExtendedCommand(activeDevice, 'velocityFeedback', checked);
      if (cmd) {
        sendToDevice(cmd, checked ? '1' : '0');
        flashFeedback('velocityFeedback', checked);
      }
    }
  };

  // Handle dual-axis numeric change
  const handleDualNumericChange = (field: SettingField, raw: string) => {
    if (!settings) return;
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    const clamped = Math.min(field.max, Math.max(field.min, val));
    const updated = { ...settings, [field.key]: clamped };
    setSettings(updated);
    saveToDb(updated);
  };

  const handleDualNumericBlur = (field: SettingField) => {
    if (!settings || !isConnected) return;
    const val = (settings as any)[field.key];
    const cmd = buildExtendedCommand(activeDevice, field.key, val);
    if (cmd) {
      sendToDevice(cmd, String(val));
      flashFeedback(field.key, true);
    }
  };

  // Handle dual-axis select change
  const handleDualSelectChange = (field: SelectSettingField, value: string) => {
    if (!settings) return;
    const updated = { ...settings, [field.key]: value };
    setSettings(updated);
    saveToDb(updated);
    if (isConnected) {
      const cmd = buildExtendedCommand(activeDevice, field.key, value);
      if (cmd) {
        sendToDevice(cmd, value);
        flashFeedback(field.key, true);
      }
    }
  };

  // Send All
  const handleDiag = async (cmd: string) => {
    setDiagLoading(cmd);
    setDiagResult(null);
    try {
      const res = await fetch(`/api/extended-settings/${activeDevice}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      const ok = !!data.success;
      const text = data.data || data.error || 'Нет ответа';
      setDiagResult({ ok, text });
      setDiagResults((prev) => ({ ...prev, [cmd]: ok }));
    } catch {
      setDiagResult({ ok: false, text: 'Ошибка запроса' });
    }
    setDiagLoading(null);
  };

  const handleSendAll = async () => {
    if (!settings || !isConnected) return;
    setSendingAll(true);
    try {
      const commands = getAllSettingsCommands(activeDevice, settings);
      for (const cmd of commands) {
        const trimmed = cmd.replace(/\r\n$/, '');
        const parts = trimmed.split(' ');
        const command = parts[0];
        const value = parts.slice(1).join(' ');
        await sendToDevice(command, value);
      }
      flashFeedback('all', true);
    } finally {
      setSendingAll(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    const defaults = DEFAULT_EXTENDED_SETTINGS[activeDevice];
    setSettings(defaults);
    saveToDb(defaults);
    flashFeedback('reset', true);
  };

  // Loading skeleton
  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 px-4 pt-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  const s = settings as any;
  const hasVelocityFeedback = activeDevice === 'TL.0320' || activeDevice === 'TL.0400';
  const isDualAxis = activeDevice === 'TL.0400';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Расширенные настройки</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono h-5">
            {activeDevice}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {/* Model Info */}
        <div className="rounded-lg bg-muted/50 border border-border p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Info className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground">{modelInfo.name}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">{modelInfo.description}</p>
          <div className="flex flex-wrap gap-1">
            {modelInfo.features.map((f, i) => (
              <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                {f}
              </Badge>
            ))}
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-amber-400 border-amber-400/30 font-mono">
              <Zap className="w-2.5 h-2.5 mr-0.5" />
              {modelInfo.maxSpeed}°/s max
            </Badge>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Tabs: Основные + Dual Axis (TL.0400 only) */}
        <Tabs defaultValue="main" className="w-full">
          <TabsList className="w-full h-8 mb-3">
            <TabsTrigger value="main" className="text-[11px] gap-1 h-7">
              <Shield className="w-3 h-3" />
              Основные
            </TabsTrigger>
            {isDualAxis && fields.dualAxis && (
              <TabsTrigger value="dual" className="text-[11px] gap-1 h-7">
                <Thermometer className="w-3 h-3" />
                Двойная ось
              </TabsTrigger>
            )}
          </TabsList>

          {/* Main Settings Tab */}
          <TabsContent value="main" className="mt-0">
            <div className="max-h-[420px] overflow-y-auto pr-1 space-y-3 custom-scrollbar-thin">
              {/* Select fields */}
              {fields.select.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
                  <Select
                    value={(s[field.key] as string) || ''}
                    onValueChange={(v) => handleSelectChange(field, v)}
                  >
                    <SelectTrigger size="sm" className="w-full h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* Velocity Feedback Toggle (TL.0320, TL.0400) */}
              {hasVelocityFeedback && (
                <div className="flex items-center justify-between py-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Обратная связь по скорости
                  </Label>
                  <Switch
                    checked={!!s.velocityFeedback}
                    onCheckedChange={handleVelocityFeedback}
                    className="scale-90"
                  />
                </div>
              )}

              <Separator className="my-2" />

              {/* Position Limits — 2x2 grid */}
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-primary" />
                  Ограничения позиций
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'azMin' as const, label: 'Аз. мин', unit: '°' },
                    { key: 'azMax' as const, label: 'Аз. макс', unit: '°' },
                    { key: 'elMin' as const, label: 'УМ мин', unit: '°' },
                    { key: 'elMax' as const, label: 'УМ макс', unit: '°' },
                  ]).map((lim) => {
                    const fbKey = `limit-${lim.key}`;
                    return (
                      <div key={lim.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{lim.label}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">{lim.unit}</span>
                        </div>
                        <div className="relative">
                          <Input
                            type="number"
                            value={s[lim.key] as number}
                            onChange={(e) => handleLimitChange(lim.key, e.target.value)}
                            onBlur={handleLimitBlur}
                            className="font-mono text-xs h-7 pr-7"
                            step="0.1"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground pointer-events-none">
                            {lim.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {isConnected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-6 text-[10px] text-muted-foreground hover:text-primary mt-1"
                    onClick={handleLimitBlur}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Отправить лимиты
                  </Button>
                )}
              </div>

              <Separator className="my-2" />

              {/* Numeric fields (excluding limits, velocityFeedback) */}
              {fields.numeric
                .filter((f) => !['azMin', 'azMax', 'elMin', 'elMax'].includes(f.key))
                .map((field) => {
                  const val = s[field.key];
                  const isFlashing = feedback?.key === field.key;
                  return (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
                        {field.unit && (
                          <span className="text-[9px] text-muted-foreground font-mono">{field.unit}</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            value={val as number}
                            onChange={(e) => handleNumericChange(field, e.target.value)}
                            onBlur={() => handleNumericBlur(field)}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            className={`font-mono text-sm h-8 pr-12 transition-colors ${
                              isFlashing
                                ? feedback.ok
                                  ? 'border-emerald-500/60 bg-emerald-500/5'
                                  : 'border-red-500/60 bg-red-500/5'
                                : ''
                            }`}
                          />
                          {field.unit && (
                            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none font-mono">
                              {field.unit}
                            </span>
                          )}
                        </div>
                        {isConnected && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                            onClick={() => handleNumericSend(field)}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </TabsContent>

          {/* Dual Axis Tab (TL.0400 only) */}
          {isDualAxis && fields.dualAxis && (
            <TabsContent value="dual" className="mt-0">
              <div className="max-h-[420px] overflow-y-auto pr-1 space-y-3 custom-scrollbar-thin">
                {/* Dual Axis Selects */}
                {fields.dualAxis.select.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
                    <Select
                      value={(s[field.key] as string) || ''}
                      onValueChange={(v) => handleDualSelectChange(field, v)}
                    >
                      <SelectTrigger size="sm" className="w-full h-8 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                <Separator className="my-2" />

                {/* Tilt / Pan grouped fields */}
                <div className="space-y-3">
                  {/* Tilt section */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-foreground font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      Ось Tilt (Наклон)
                    </Label>
                    {fields.dualAxis.numeric
                      .filter((f) => f.key.startsWith('tilt'))
                      .map((field) => {
                        const val = s[field.key];
                        const isFlashing = feedback?.key === field.key;
                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                              {field.unit && (
                                <span className="text-[9px] text-muted-foreground font-mono">{field.unit}</span>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <div className="relative flex-1">
                                <Input
                                  type="number"
                                  value={val as number}
                                  onChange={(e) => handleDualNumericChange(field, e.target.value)}
                                  onBlur={() => handleDualNumericBlur(field)}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  className={`font-mono text-sm h-8 pr-12 transition-colors ${
                                    isFlashing
                                      ? feedback.ok
                                        ? 'border-emerald-500/60 bg-emerald-500/5'
                                        : 'border-red-500/60 bg-red-500/5'
                                      : ''
                                  }`}
                                />
                                {field.unit && (
                                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none font-mono">
                                    {field.unit}
                                  </span>
                                )}
                              </div>
                              {isConnected && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0 hover:bg-amber-400/10 hover:text-amber-400 hover:border-amber-400/30"
                                  onClick={() => {
                                    if (!settings) return;
                                    const v = (settings as any)[field.key];
                                    const cmd = buildExtendedCommand(activeDevice, field.key, v);
                                    if (cmd) {
                                      sendToDevice(cmd, String(v));
                                      flashFeedback(field.key, true);
                                    }
                                  }}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <Separator className="my-2" />

                  {/* Pan section */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-foreground font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      Ось Pan (Поворот)
                    </Label>
                    {fields.dualAxis.numeric
                      .filter((f) => f.key.startsWith('pan') || f.key === 'syncRatio')
                      .map((field) => {
                        const val = s[field.key];
                        const isFlashing = feedback?.key === field.key;
                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                              {field.unit && (
                                <span className="text-[9px] text-muted-foreground font-mono">{field.unit}</span>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <div className="relative flex-1">
                                <Input
                                  type="number"
                                  value={val as number}
                                  onChange={(e) => handleDualNumericChange(field, e.target.value)}
                                  onBlur={() => handleDualNumericBlur(field)}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  className={`font-mono text-sm h-8 pr-12 transition-colors ${
                                    isFlashing
                                      ? feedback.ok
                                        ? 'border-emerald-500/60 bg-emerald-500/5'
                                        : 'border-red-500/60 bg-red-500/5'
                                      : ''
                                  }`}
                                />
                                {field.unit && (
                                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none font-mono">
                                    {field.unit}
                                  </span>
                                )}
                              </div>
                              {isConnected && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 shrink-0 hover:bg-emerald-400/10 hover:text-emerald-400 hover:border-emerald-400/30"
                                  onClick={() => {
                                    if (!settings) return;
                                    const v = (settings as any)[field.key];
                                    const cmd = buildExtendedCommand(activeDevice, field.key, v);
                                    if (cmd) {
                                      sendToDevice(cmd, String(v));
                                      flashFeedback(field.key, true);
                                    }
                                  }}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <Separator className="my-3" />

        {/* Self-Diagnostics Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            Самодиагностика устройства
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { cmd: 'DIAG', label: 'Тест моторов', icon: '⚙' },
              { cmd: 'VER', label: 'Версия прошивки', icon: '🔧' },
              { cmd: 'SN', label: 'Серийный номер', icon: '#️⃣' },
              { cmd: 'HWINFO', label: 'Аппаратный статус', icon: '🖥' },
              { cmd: 'ERRLOG', label: 'Журнал ошибок', icon: '⚠' },
              { cmd: 'CLRERR', label: 'Сброс ошибок', icon: '🗑' },
            ].map((item) => (
              <button
                key={item.cmd}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border text-[10px] font-mono
                  transition-colors hover:bg-secondary/80 disabled:opacity-40
                  ${diagLoading === item.cmd ? 'border-amber-500/50 text-amber-400' : diagResults[item.cmd] ? 'border-emerald-500/30 text-emerald-400' : ''}`}
                disabled={!isConnected || diagLoading === item.cmd}
                onClick={() => handleDiag(item.cmd)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
          {diagResult && (
            <div className={`text-[10px] font-mono p-2 rounded-md border max-h-24 overflow-y-auto ${
              diagResult.ok ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'
            }`}>
              {diagResult.text}
            </div>
          )}
        </div>

        <Separator className="my-3" />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            disabled={!isConnected || sendingAll}
            onClick={handleSendAll}
          >
            <Send className="w-3.5 h-3.5" />
            {sendingAll ? 'Отправка...' : 'Отправить все'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            onClick={handleResetDefaults}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сброс
          </Button>
        </div>

        {/* Connection status hint */}
        {!isConnected && (
          <p className="text-[10px] text-muted-foreground text-center mt-2 font-mono">
            Подключитесь к устройству для отправки команд
          </p>
        )}
      </CardContent>
    </Card>
  );
}