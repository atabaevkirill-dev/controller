'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeviceStore } from '@/store/device-store';
import { PROTOCOL_COMMANDS, type PresetData } from '@/lib/device-types';
import { Bookmark, Trash2, Save, Play } from 'lucide-react';

async function sendCommand(device: string, command: string, value?: string) {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command, value }),
  });
  return res.json();
}

export default function Presets() {
  const { activeDevice, telemetry, presets, setPresets } = useDeviceStore();
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch presets on mount
  useEffect(() => {
    fetch(`/api/presets?deviceId=${activeDevice}`)
      .then((res) => res.json())
      .then((data) => {
        const presets = data?.data || data;
        if (Array.isArray(presets)) setPresets(presets);
      })
      .catch(() => {});
  }, [activeDevice, setPresets]);

  // Build 16-slot array
  const slots: (PresetData | null)[] = Array.from({ length: 16 }, (_, i) => {
    return presets.find((p) => p.slot === i + 1) || null;
  });

  const recallPreset = useCallback((slot: number) => {
    const preset = slots[slot];
    if (preset) {
      sendCommand(activeDevice, PROTOCOL_COMMANDS.RECALL_PRESET, String(slot + 1));
    }
  }, [activeDevice, slots]);

  const savePreset = useCallback(async (slot: number) => {
    const existing = slots[slot];
    const body = {
      deviceId: activeDevice,
      slot: slot + 1,
      name: existing?.name || `Пресет ${slot + 1}`,
      azimuth: telemetry.azimuth,
      elevation: telemetry.elevation,
      speed: useDeviceStore.getState().speed,
    };

    try {
      const res = await fetch('/api/presets', {
        method: existing?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, id: existing?.id }),
      });
      const data = await res.json();
      if (data) {
        const newPresets = presets.filter((p) => p.slot !== slot + 1);
        newPresets.push({ ...body, id: data.id || existing?.id });
        setPresets(newPresets);
      }
    } catch {}
  }, [activeDevice, telemetry, presets, slots, setPresets]);

  const clearPreset = useCallback(async (slot: number) => {
    const preset = slots[slot];
    if (!preset?.id) return;
    try {
      await fetch('/api/presets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: preset.id }),
      });
      setPresets(presets.filter((p) => p.slot !== slot + 1));
    } catch {}
  }, [slots, presets, setPresets]);

  const startEdit = (slot: number) => {
    const preset = slots[slot];
    setEditingSlot(slot);
    setEditName(preset?.name || '');
  };

  const saveName = async () => {
    if (editingSlot === null) return;
    const preset = slots[editingSlot];
    try {
      await fetch('/api/presets', {
        method: preset?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: preset?.id,
          deviceId: activeDevice,
          slot: editingSlot + 1,
          name: editName || `Пресет ${editingSlot + 1}`,
          azimuth: preset?.azimuth || telemetry.azimuth,
          elevation: preset?.elevation || telemetry.elevation,
          speed: preset?.speed || useDeviceStore.getState().speed,
        }),
      });
      const newPresets = presets.filter((p) => p.slot !== editingSlot + 1);
      newPresets.push({
        id: preset?.id,
        name: editName || `Пресет ${editingSlot + 1}`,
        slot: editingSlot + 1,
        azimuth: preset?.azimuth || telemetry.azimuth,
        elevation: preset?.elevation || telemetry.elevation,
        speed: preset?.speed || useDeviceStore.getState().speed,
      });
      setPresets(newPresets);
    } catch {}
    setEditingSlot(null);
  };

  const handlePointerDown = (slot: number) => {
    longPressTimer.current = setTimeout(() => {
      savePreset(slot);
    }, 600);
  };

  const handlePointerUp = (slot: number) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-muted-foreground" />
          Пресеты
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-8 gap-1">
          {slots.map((preset, idx) => (
            <div
              key={idx}
              className="group relative"
              onPointerDown={() => handlePointerDown(idx)}
              onPointerUp={() => handlePointerUp(idx)}
              onPointerLeave={() => handlePointerUp(idx)}
              onContextMenu={(e) => { e.preventDefault(); clearPreset(idx); }}
            >
              <button
                className={`
                  w-full rounded border border-border py-1.5 px-0.5
                  flex flex-col items-center justify-center gap-0
                  transition-colors hover:border-primary/50 hover:bg-secondary/50
                  ${preset ? 'bg-secondary/30' : 'bg-secondary/10'}
                `}
                onClick={() => recallPreset(idx)}
                title={preset ? `${preset.name} (${preset.azimuth.toFixed(0)}°/${preset.elevation.toFixed(0)}°)\nДолгое нажатие — сохранить\nПКМ — очистить` : `Слот ${idx + 1} — пустой`}
              >
                <span className="text-[9px] text-muted-foreground font-mono leading-none">{idx + 1}</span>
                {editingSlot === idx ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingSlot(null); }}
                    className="h-4 text-[8px] p-0 px-0.5 font-mono text-center bg-input border-primary mt-0.5"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="text-[9px] font-medium leading-tight text-center truncate w-full cursor-text mt-0.5"
                    onClick={(e) => { e.stopPropagation(); startEdit(idx); }}
                    title="Редактировать имя"
                  >
                    {preset?.name || '—'}
                  </span>
                )}
              </button>

              {/* Action buttons overlay */}
              <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 z-10">
                <button
                  className="w-4 h-4 rounded-sm bg-primary text-primary-foreground flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); savePreset(idx); }}
                  title="Сохранить текущую позицию"
                >
                  <Save className="w-2.5 h-2.5" />
                </button>
                {preset && (
                  <button
                    className="w-4 h-4 rounded-sm bg-destructive text-destructive-foreground flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); clearPreset(idx); }}
                    title="Очистить слот"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
          Клик — вызвать · Удержание — сохранить · ПКМ — очистить
        </p>
      </CardContent>
    </Card>
  );
}