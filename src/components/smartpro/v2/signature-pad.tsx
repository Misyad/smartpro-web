import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paths, setPaths] = useState<{ x: number; y: number }[][]>([]);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--foreground")
      .trim();
    paths.forEach((path) => {
      if (!path.length) return;
      ctx.beginPath();
      ctx.moveTo(path[0]?.x ?? 0, path[0]?.y ?? 0);
      path.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
    const hasInk = paths.some((p) => p.length > 1);
    onChange(hasInk ? canvas.toDataURL("image/png") : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths]);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  return (
    <div>
      <div className="overflow-hidden rounded-sm border border-border bg-surface-soft">
        <canvas
          ref={canvasRef}
          width={600}
          height={140}
          className="signature-pad h-28 w-full cursor-crosshair"
          aria-label="Bidang tanda tangan digital"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setPaths((c) => [...c, [pointFrom(e)]]);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const pt = pointFrom(e);
            setPaths((c) => {
              const updated = [...c];
              const last = updated[updated.length - 1];
              if (last) updated[updated.length - 1] = [...last, pt];
              return updated;
            });
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
        />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPaths((c) => c.slice(0, -1))}
        >
          Urungkan
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setPaths([])}>
          Bersihkan
        </Button>
      </div>
    </div>
  );
}
