'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeviceStore } from '@/store/device-store';
import { DEVICE_MODELS, DEFAULT_DEVICE_CONFIGS, type DeviceModel } from '@/lib/device-types';

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-emerald-500',
  disconnected: 'bg-red-500',
  connecting: 'bg-amber-500 animate-pulse-dot',
  error: 'bg-red-500 animate-pulse-dot',
};

export default function DeviceSelector() {
  const { activeDevice, connectionStatus, setActiveDevice, setPresets } = useDeviceStore();

  const handleChange = (model: DeviceModel) => {
    setActiveDevice(model);
    // Fetch presets for the new device
    fetch(`/api/presets?deviceId=${model}`)
      .then((res) => res.json())
      .then((data) => {
        const presets = data?.data || data;
        if (Array.isArray(presets)) setPresets(presets);
      })
      .catch(() => {});
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[connectionStatus] || 'bg-red-500'}`} />
      <Select value={activeDevice} onValueChange={handleChange}>
        <SelectTrigger className="w-[200px] font-mono text-sm bg-secondary border-border">
          <SelectValue placeholder="Выберите устройство" />
        </SelectTrigger>
        <SelectContent>
          {DEVICE_MODELS.map((model) => (
            <SelectItem key={model} value={model} className="font-mono text-sm">
              {DEFAULT_DEVICE_CONFIGS[model].name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {connectionStatus === 'connected' ? 'Подключено' : connectionStatus === 'connecting' ? 'Подключение...' : connectionStatus === 'error' ? 'Ошибка' : 'Отключено'}
      </span>
    </div>
  );
}