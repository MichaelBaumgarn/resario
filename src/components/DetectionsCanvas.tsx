"use client";

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
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
  onDetectionUpdate?: (detections: Detection[]) => void;
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
      onDetectionUpdate,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const [draggedBox, setDraggedBox] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [localDetections, setLocalDetections] =
      useState<Detection[]>(detections);

    useEffect(() => {
      setLocalDetections(detections);
    }, [detections]);

    const getMousePos = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          console.log("Canvas not found!");
          return { x: 0, y: 0 };
        }

        const rect = canvas.getBoundingClientRect();

        // Use CSS coordinates (not scaled by devicePixelRatio)
        // since our bounding boxes are also in CSS coordinates
        const pos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };

        console.log("Mouse position:", pos);

        return pos;
      },
      []
    );

    const findBoxAtPosition = useCallback(
      (x: number, y: number) => {
        const scaled = scaleDetections(
          localDetections,
          naturalWidth,
          naturalHeight,
          displayWidth,
          displayHeight
        ).filter((d) => d.score >= scoreThreshold);

        for (let i = scaled.length - 1; i >= 0; i--) {
          const d = scaled[i];
          const { xmin, ymin, xmax, ymax } = d.box;
          if (x >= xmin && x <= xmax && y >= ymin && y <= ymax) {
            console.log(`Found box ${i} at position (${x}, ${y})!`);
            return i;
          }
        }
        return -1;
      },
      [
        localDetections,
        naturalWidth,
        naturalHeight,
        displayWidth,
        displayHeight,
        scoreThreshold,
      ]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const mousePos = getMousePos(e);
        const boxIndex = findBoxAtPosition(mousePos.x, mousePos.y);

        if (boxIndex !== -1) {
          const scaled = scaleDetections(
            localDetections,
            naturalWidth,
            naturalHeight,
            displayWidth,
            displayHeight
          ).filter((d) => d.score >= scoreThreshold);

          const box = scaled[boxIndex].box;
          setDraggedBox(boxIndex);
          setDragOffset({
            x: mousePos.x - box.xmin,
            y: mousePos.y - box.ymin,
          });
          console.log("Started dragging box:", boxIndex, box);
        }
      },
      [
        getMousePos,
        findBoxAtPosition,
        localDetections,
        naturalWidth,
        naturalHeight,
        displayWidth,
        displayHeight,
        scoreThreshold,
      ]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (draggedBox === null) return;

        e.preventDefault();
        const mousePos = getMousePos(e);
        const newX = mousePos.x - dragOffset.x;
        const newY = mousePos.y - dragOffset.y;

        const filteredDetections = localDetections.filter(
          (det) => det.score >= scoreThreshold
        );

        if (draggedBox < filteredDetections.length) {
          const draggedDetection = filteredDetections[draggedBox];
          const originalIndex = localDetections.findIndex(
            (d) => d === draggedDetection
          );

          if (originalIndex !== -1) {
            const scaled = scaleDetections(
              [draggedDetection],
              naturalWidth,
              naturalHeight,
              displayWidth,
              displayHeight
            )[0];

            const width = scaled.box.xmax - scaled.box.xmin;
            const height = scaled.box.ymax - scaled.box.ymin;

            const newBox = {
              xmin: Math.max(0, Math.min(newX, displayWidth - width)),
              ymin: Math.max(0, Math.min(newY, displayHeight - height)),
              xmax: Math.max(0, Math.min(newX + width, displayWidth)),
              ymax: Math.max(0, Math.min(newY + height, displayHeight)),
            };

            const scaleX = naturalWidth / displayWidth;
            const scaleY = naturalHeight / displayHeight;

            const updatedDetections = [...localDetections];
            updatedDetections[originalIndex] = {
              ...updatedDetections[originalIndex],
              box: {
                xmin: newBox.xmin * scaleX,
                ymin: newBox.ymin * scaleY,
                xmax: newBox.xmax * scaleX,
                ymax: newBox.ymax * scaleY,
              },
            };

            setLocalDetections(updatedDetections);
            onDetectionUpdate?.(updatedDetections);
          }
        }
      },
      [
        draggedBox,
        dragOffset,
        getMousePos,
        localDetections,
        naturalWidth,
        naturalHeight,
        displayWidth,
        displayHeight,
        scoreThreshold,
        onDetectionUpdate,
      ]
    );

    const handleMouseUp = useCallback(() => {
      setDraggedBox(null);
      setDragOffset({ x: 0, y: 0 });
    }, []);

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
        localDetections,
        naturalWidth,
        naturalHeight,
        displayWidth,
        displayHeight
      ).filter((d) => d.score >= scoreThreshold);

      console.log("Drawing detections:", {
        original: localDetections.length,
        scaled: scaled.length,
        natural: { width: naturalWidth, height: naturalHeight },
        display: { width: displayWidth, height: displayHeight },
        scalingFactor: displayWidth / naturalWidth,
        sampleDetection: localDetections[0]
          ? {
              label: localDetections[0].label,
              originalBox: localDetections[0].box,
              scaledBox: scaled[0]?.box,
            }
          : null,
      });

      ctx.lineWidth = lineWidth;
      ctx.font =
        "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textBaseline = "top";

      scaled.forEach((d, index) => {
        const { xmin, ymin, xmax, ymax } = d.box;
        const w = Math.max(0, xmax - xmin);
        const h = Math.max(0, ymax - ymin);

        const color = colorForLabel(d.label);
        const isDragging = draggedBox === index;

        ctx.strokeStyle = color;
        ctx.lineWidth = isDragging ? lineWidth + 2 : lineWidth;
        ctx.strokeRect(xmin, ymin, w, h);
        ctx.fillStyle = withAlpha(color, isDragging ? 0.15 : 0.08);
        ctx.fillRect(xmin, ymin, w, h);

        const text = `${d.label} (${Math.round(d.score * 100)}%)`;
        const coordsText = `(${Math.round(xmin)}, ${Math.round(ymin)})`;
        const metrics = ctx.measureText(text);
        const coordsMetrics = ctx.measureText(coordsText);
        const pillW =
          Math.max(metrics.width, coordsMetrics.width) + padding * 2;
        const pillH = 32 + padding * 2;
        const pillX = xmin;
        const pillY = Math.max(0, ymin - pillH);

        ctx.fillStyle = withAlpha(color, 0.9);
        roundRect(ctx, pillX, pillY, pillW, pillH, 6);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.fillText(text, pillX + padding, pillY + padding);
        ctx.fillText(coordsText, pillX + padding, pillY + padding + 16);
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
      localDetections,
      scoreThreshold,
      lineWidth,
      draggedBox,
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
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: draggedBox !== null ? "grabbing" : "grab",
            position: "absolute",
            top: 0,
            left: 0,
            width: displayWidth,
            height: displayHeight,
          }}
        />
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
