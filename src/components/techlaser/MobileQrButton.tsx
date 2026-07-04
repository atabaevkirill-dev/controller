'use client';

import { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Copy, Check, QrCode } from 'lucide-react';

export default function MobileQrButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const mobileUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/mobile`;
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mobileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

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

      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-primary w-full" />

        <div className="p-6 flex flex-col items-center gap-5">
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-2 text-base">
              <Smartphone className="w-4.5 h-4.5 text-primary" />
              Управление с телефона
            </DialogTitle>
          </DialogHeader>

          {/* QR Code */}
          <div className="relative p-4 bg-white rounded-2xl shadow-lg">
            <QRCodeSVG
              value={mobileUrl}
              size={200}
              level="M"
              bgColor="#ffffff"
              fgColor="#0a0a0a"
              includeMargin={false}
            />
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br-2xl" />
          </div>

          {/* Instructions */}
          <div className="text-center space-y-2">
            <p className="text-sm text-foreground font-medium">
              Наведите камеру телефона на QR-код
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Откроется лёгкая страница с D-Pad и скоростью для управления ОПУ
            </p>
          </div>

          {/* URL + Copy */}
          <div className="w-full flex items-center gap-2 bg-secondary rounded-lg p-2">
            <code className="flex-1 text-xs font-mono text-muted-foreground truncate px-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}