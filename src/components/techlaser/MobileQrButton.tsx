'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Copy, Check, QrCode, Loader2, Smartphone } from 'lucide-react';

export default function MobileQrButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileUrl, setMobileUrl] = useState('');
  const fetchedRef = useRef(false);

  const fetchUrl = useCallback(() => {
    fetch('/api/server-url')
      .then((r) => r.json())
      .then((data) => {
        setMobileUrl(data.mobileUrl || '');
      })
      .catch(() => {
        setMobileUrl(`${window.location.origin}/mobile`);
      });
  }, []);

  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchUrl();
    }
    if (!open) {
      fetchedRef.current = false;
    }
  }, [open, fetchUrl]);

  const handleCopy = async () => {
    if (!mobileUrl) return;
    try {
      await navigator.clipboard.writeText(mobileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 border-border hover:border-primary/40 hover:bg-primary/5"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Телефон</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-3 space-y-2 overflow-visible"
        side="bottom"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold">Управление с телефона</span>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          {!mobileUrl ? (
            <div className="w-[160px] h-[160px] rounded-lg bg-secondary flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : (
            <div className="p-2 bg-white rounded-lg">
              <QRCodeSVG
                value={mobileUrl}
                size={160}
                level="M"
                bgColor="#ffffff"
                fgColor="#0a0a0a"
                includeMargin={false}
              />
            </div>
          )}
        </div>

        {/* Instructions */}
        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          Наведите камеру на QR-код — откроется страница с D-Pad
        </p>

        {/* URL + Copy */}
        {mobileUrl && (
          <div className="flex items-center gap-1 bg-secondary/80 rounded-md px-2 py-1">
            <code className="flex-1 text-[9px] font-mono text-muted-foreground truncate">
              {mobileUrl}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5" />
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}