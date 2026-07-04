'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Copy, Check, QrCode, Loader2 } from 'lucide-react';

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

  // Fetch URL when dialog opens (use ref to avoid re-fetching)
  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchUrl();
    }
    // Reset when closed so next open re-fetches
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

  const loading = open && !mobileUrl;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5 border-border hover:border-primary/40 hover:bg-primary/5"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Телефон</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[340px] p-0 gap-0 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-primary w-full shrink-0" />

        <div className="px-6 pt-5 pb-6 flex flex-col items-center gap-4">
          <DialogHeader className="text-center space-y-0">
            <DialogTitle className="flex items-center justify-center gap-2 text-sm font-semibold">
              <Smartphone className="w-4 h-4 text-primary" />
              Управление с телефона
            </DialogTitle>
          </DialogHeader>

          {/* QR Code */}
          {loading ? (
            <div className="w-[200px] h-[200px] rounded-2xl bg-secondary flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : mobileUrl ? (
            <div className="relative p-3 bg-white rounded-2xl shadow-lg">
              <QRCodeSVG
                value={mobileUrl}
                size={200}
                level="M"
                bgColor="#ffffff"
                fgColor="#0a0a0a"
                includeMargin={false}
              />
            </div>
          ) : (
            <div className="w-[200px] h-[200px] rounded-2xl bg-secondary flex items-center justify-center text-xs text-muted-foreground">
              Ошибка загрузки
            </div>
          )}

          {/* Instructions */}
          <div className="text-center space-y-1">
            <p className="text-xs text-foreground font-medium">
              Наведите камеру телефона на QR-код
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Откроется страница с D-Pad и скоростью
            </p>
          </div>

          {/* URL + Copy */}
          {mobileUrl && (
            <div className="w-full flex items-center gap-2 bg-secondary/80 rounded-lg p-1.5">
              <code className="flex-1 text-[11px] font-mono text-muted-foreground truncate px-2">
                {mobileUrl}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}