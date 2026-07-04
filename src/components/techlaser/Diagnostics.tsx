'use client';

import { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceStore } from '@/store/device-store';
import type { CommandStatus } from '@/lib/device-types';
import { Terminal, Trash2, Wifi, WifiOff } from 'lucide-react';

const STATUS_STYLES: Record<CommandStatus, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  timeout: 'text-amber-400',
  pending: 'text-muted-foreground',
};

const STATUS_LABELS: Record<CommandStatus, string> = {
  success: 'OK',
  error: 'ERR',
  timeout: 'TMO',
  pending: '...',
};

export default function Diagnostics() {
  const { commandLog, clearCommandLog, connectionStatus } = useDeviceStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (latest entries)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [commandLog.length]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          Диагностика
          <span className="ml-auto text-xs font-mono text-muted-foreground">
            {commandLog.length} записей
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Connection health */}
        <div className="flex items-center gap-2 text-xs">
          {connectionStatus === 'connected' ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-mono">Соединение активно</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400 font-mono">Нет соединения</span>
            </>
          )}
        </div>

        {/* Log entries */}
        <div
          ref={scrollRef}
          className="max-h-96 overflow-y-auto custom-scrollbar rounded-md border border-border bg-background/50 p-2 space-y-0.5"
        >
          {commandLog.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8 font-mono">
              Нет записей в журнале
            </div>
          ) : (
            commandLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 text-[11px] font-mono py-0.5 border-b border-border/30 last:border-0"
              >
                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                  {new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour12: false })}
                </span>
                <span className="text-primary-foreground font-semibold shrink-0">
                  {entry.command}
                </span>
                {entry.direction && (
                  <span className="text-muted-foreground shrink-0">
                    [{entry.direction}]
                  </span>
                )}
                {entry.payload && (
                  <span className="text-muted-foreground truncate">
                    {entry.payload}
                  </span>
                )}
                <span className={`ml-auto shrink-0 ${STATUS_STYLES[entry.status]}`}>
                  {STATUS_LABELS[entry.status]}
                </span>
                {entry.duration !== undefined && (
                  <span className="text-muted-foreground shrink-0">
                    {entry.duration}ms
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Last response */}
        {commandLog.length > 0 && commandLog[0].response && (
          <div className="text-[10px] font-mono text-muted-foreground bg-secondary/30 rounded px-2 py-1.5 break-all">
            <span className="text-muted-foreground/60">Ответ: </span>
            {commandLog[0].response}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs w-full"
          onClick={clearCommandLog}
        >
          <Trash2 className="w-3 h-3 mr-1.5" />
          Очистить журнал
        </Button>
      </CardContent>
    </Card>
  );
}