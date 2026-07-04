'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import EncoderSVG from './EncoderSVG';

interface RotaryEncoderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  unit?: string;
  size?: 'sm' | 'md';
  decimals?: number;
  className?: string;
  disabled?: boolean;
}

export default function RotaryEncoder({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  unit = '',
  size = 'md',
  decimals = 0,
  className,
  disabled = false,
}: RotaryEncoderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const isMin = value <= min;
  const isMax = value >= max;

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      {label && (
        <span className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-mono">
          {label}
        </span>
      )}

      {/* Encoder ring */}
      <div
        ref={trackRef}
        className={cn(
          'relative rounded-full cursor-pointer select-none transition-shadow duration-200',
          sizeMap[size],
          disabled
            ? 'opacity-40 cursor-not-allowed'
            : isDragging
              ? 'shadow-[0_0_16px_rgba(16,185,129,0.3)]'
              : 'hover:shadow-[0_0_8px_rgba(16,185,129,0.1)]',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <EncoderSVG
          azimuth={azimuth}
          elevation={elevation}
          targetAz={null}
          targetEl={null}
        />
        {/* Center display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={cn('font-mono font-bold tabular-nums transition-colors duration-150', size === 'sm' ? 'text-sm' : 'text-lg', isDragging ? 'text-primary' : isMin || isMax ? 'text-muted-foreground' : 'text-foreground')}
          >
            {value.toFixed(decimals)}
          </span>
          {unit && (
            <span className="text-[8px] text-muted-foreground/50 font-mono -mt-0.5">{unit}</span>
          )}
        </div>

      {/* Min/Max indicators */}
      <div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground/40">
        <span>{min}{unit}</span>
        <span className="w-4 h-px bg-border" />
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}