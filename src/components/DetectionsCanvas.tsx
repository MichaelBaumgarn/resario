"use client";

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Detection } from "@/lib/types";
import { scaleDetections } from "@/lib/boxes";

type Props = {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
  detections: Detection[];
  scoreThreshold?: number;
  lineWidth?: number;
  padding?: number;
};

export type DetectionsCanvasHandle = {
  downloadPNG: (filename?: string) => void;
  redraw: () => void;
  clear: () => void;
};

const DetectionsCanvas = forwardRef<DetectionsCanvasHandle, Props>(
  function DetectionsCanvas(
    {
      imageUrl,
      naturalWidth,
      naturalHeight,
      displayWidth,
      displayHeight,
      detections,
      scoreThreshold = 0.5,
      lineWidth = 2,
      padding = 4,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const setupCanvasSize = (
      canvas: HTMLCanvasElement,
      cssW: number,
      cssH: number
    ) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = setupCanvasSize(canvas, displayWidth, displayHeight);

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const img = imgRef.current;
      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      } else {
        console.log("Image not ready:", {
          img: !!img,
          complete: img?.complete,
        });
      }

      const scaled = scaleDetections(
        detections,
        naturalWidth,
        naturalHeight,
        displayWidth,
        displayHeight
      ).filter((d) => d.score >= scoreThreshold);

      console.log("Drawing detections:", {
        original: detections.length,
        scaled: scaled.length,
        natural: { width: naturalWidth, height: naturalHeight },
        display: { width: displayWidth, height: displayHeight },
      });

      ctx.lineWidth = lineWidth;
      ctx.font =
        "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textBaseline = "top";

      scaled.forEach((d) => {
        const { xmin, ymin, xmax, ymax } = d.box;
        const w = Math.max(0, xmax - xmin);
        const h = Math.max(0, ymax - ymin);

        const color = colorForLabel(d.label);

        ctx.strokeStyle = color;
        ctx.strokeRect(xmin, ymin, w, h);
        ctx.fillStyle = withAlpha(color, 0.08);
        ctx.fillRect(xmin, ymin, w, h);

        const text = `${d.label} (${Math.round(d.score * 100)}%)`;
        const metrics = ctx.measureText(text);
        const pillW = metrics.width + padding * 2;
        const pillH = 16 + padding * 2;
        const pillX = xmin;
        const pillY = Math.max(0, ymin - pillH);

        ctx.fillStyle = withAlpha(color, 0.9);
        roundRect(ctx, pillX, pillY, pillW, pillH, 6);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.fillText(text, pillX + padding, pillY + padding);
      });
    };

    useEffect(() => {
      draw();
    }, [
      imageUrl,
      naturalWidth,
      naturalHeight,
      displayWidth,
      displayHeight,
      detections,
      scoreThreshold,
      lineWidth,
    ]);

    useImperativeHandle(ref, () => ({
      downloadPNG: (filename = "detections.png") => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = filename;
        link.click();
      },
      redraw: draw,
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;
      const ro = new ResizeObserver(() => draw());
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }, []);

    return (
      <div
        ref={containerRef}
        className="relative"
        style={{ width: displayWidth, height: displayHeight }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Detected"
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
            width: displayWidth,
            height: displayHeight,
          }}
          onLoad={draw}
        />
        <canvas ref={canvasRef} />
      </div>
    );
  }
);

export default DetectionsCanvas;

function colorForLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++)
    hash = (hash << 5) - hash + label.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 90% 45%)`;
}

function withAlpha(hsl: string, alpha: number) {
  const m = /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/.exec(hsl);
  if (!m) return hsl;
  const [_, h, s, l] = m;
  return `hsla(${h} ${s}% ${l}% / ${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
