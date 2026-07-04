'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

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

const sizeMap = {
  sm: { track: 'w-14 h-14', text: 'text-xs', label: 'text-[8px]', tick: 22, stroke: 2.5 },
  md: { track: 'w-20 h-20', text: 'text-sm', label: 'text-[9px]', tick: 32, stroke: 3 },
} as const;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastY = useRef(0);
  const animRef = useRef<number>(0);

  const s = sizeMap[size];
  const range = max - min;
  const progress = range !== 0 ? (value - min) / range : 0;
  const isMin = value <= min;
  const isMax = value >= max;

  // Arc: 135° to 405° (270° sweep)
  const arcStart = 135;
  const arcEnd = 405;
  const arcSweep = arcEnd - arcStart;
  const currentAngle = arcStart + progress * arcSweep;

  const polarToXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
  };

  const describeArc = (startAngle: number, endAngle: number, r: number) => {
    if (Math.abs(endAngle - startAngle) < 0.5) return '';
    const s = polarToXY(startAngle, r);
    const e = polarToXY(endAngle, r);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const clamp = (v: number) => {
    const stepped = Math.round(v / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    return parseFloat(clamped.toFixed(Math.max(decimals, 4)));
  };

  const updateValue = useCallback(
    (deltaY: number) => {
      const sensitivity = size === 'sm' ? 0.8 : 0.5;
      const delta = -deltaY * sensitivity * step;
      onChange(clamp(value + delta));
    },
    [value, step, min, max, decimals, onChange, size],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      lastY.current = e.clientY;
    },
    [disabled],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const delta = e.clientY - lastY.current;
      lastY.current = e.clientY;
      // Throttle via rAF
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(() => updateValue(delta));
    },
    [isDragging, updateValue],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      updateValue(e.deltaY);
    },
    [disabled, updateValue],
  );

  const handleDoubleClick = useCallback(() => {
    if (disabled) return;
    const mid = parseFloat(((min + max) / 2).toFixed(Math.max(decimals, 4)));
    onChange(clamp(mid));
  }, [disabled, min, max, decimals, onChange, clamp]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const bgArc = describeArc(arcStart, arcEnd, s.tick);
  const fgArc = describeArc(arcStart, currentAngle, s.tick);
  const dot = polarToXY(currentAngle, s.tick);

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {label && (
        <span className={cn('text-muted-foreground uppercase tracking-[0.15em] font-mono', s.label)}>
          {label}
        </span>
      )}

      {/* Encoder ring */}
      <div
        ref={containerRef}
        className={cn(
          'relative rounded-full cursor-pointer select-none transition-shadow duration-200',
          s.track,
          disabled
            ? 'opacity-40 cursor-not-allowed'
            : isDragging
              ? 'shadow-[0_0_16px_rgba(16,185,129,0.3)]'
              : 'hover:shadow-[0_0_8px_rgba(16,185,129,0.15)]',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-0">
          {/* Background track */}
          {bgArc && (
            <path
              d={bgArc}
              fill="none"
              stroke="currentColor"
              strokeWidth={s.stroke}
              strokeLinecap="round"
              className="text-muted-foreground/15"
            />
          )}

          {/* Active arc */}
          {fgArc && (
            <path
              d={fgArc}
              fill="none"
              stroke="currentColor"
              strokeWidth={s.stroke}
              strokeLinecap="round"
              className={
                isDragging
                  ? 'text-primary'
                  : isMin || isMax
                    ? 'text-amber-500'
                    : 'text-emerald-500'
              }
              style={{ transition: 'd 0.08s ease-out' }}
            />
          )}

          {/* Knob dot */}
          <circle
            cx={dot.x}
            cy={dot.y}
            r={size === 'sm' ? 2.5 : 3}
            className={
              isDragging
                ? 'fill-primary'
                : isMin || isMax
                  ? 'fill-amber-500'
                  : 'fill-emerald-400'
            }
            style={{ transition: 'cx 0.08s ease-out, cy 0.08s ease-out' }}
          />

          {/* Center value */}
          <text
            x="50"
            y={size === 'sm' ? '52' : '50'}
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            className={
              isDragging
                ? 'fill-primary'
                : isMin || isMax
                  ? 'fill-muted-foreground'
                  : 'fill-foreground'
            }
            fontSize={size === 'sm' ? '12' : '15'}
            fontFamily="monospace"
            fontWeight="700"
          >
            {value.toFixed(decimals)}
          </text>

          {/* Unit */}
          {unit && (
            <text
              x="50"
              y={size === 'sm' ? '63' : '63'}
              textAnchor="middle"
              fill="currentColor"
              className="fill-muted-foreground/40"
              fontSize={size === 'sm' ? '6' : '7'}
              fontFamily="monospace"
            >
              {unit}
            </text>
          )}
        </svg>
      </div>

      {/* Min/Max indicators */}
      <div className={cn('flex items-center gap-2 font-mono text-muted-foreground/40', s.label)}>
        <span>{min}{unit}</span>
        <span className="w-3 h-px bg-border" />
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}