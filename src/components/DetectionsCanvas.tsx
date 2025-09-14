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

    const draw = () => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

      const scaled = scaleDetections(
        detections,
        naturalWidth,
        naturalHeight,
        displayWidth,
        displayHeight
      ).filter((d) => d.score >= scoreThreshold);

      scaled.forEach((detection) => {
        const { xmin, ymin, xmax, ymax } = detection.box;

        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);

        const label = `${detection.label} (${Math.round(
          detection.score * 100
        )}%)`;
        const labelWidth = ctx.measureText(label).width;
        const labelHeight = 20;

        ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
        ctx.fillRect(
          xmin,
          ymin - labelHeight - padding,
          labelWidth + padding * 2,
          labelHeight
        );

        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.fillText(label, xmin + padding, ymin - padding);
      });
    };

    useEffect(() => {
      draw();
    }, [
      detections,
      imageUrl,
      naturalWidth,
      naturalHeight,
      displayWidth,
      displayHeight,
      scoreThreshold,
      lineWidth,
      padding,
    ]);

    useImperativeHandle(ref, () => ({
      downloadPNG: (filename = "detections.png") => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement("a");
        link.download = filename;
        link.href = canvas.toDataURL();
        link.click();
      },
      redraw: () => {
        draw();
      },
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
    }));

    return (
      <div ref={containerRef} className="relative inline-block">
        <canvas
          ref={canvasRef}
          width={displayWidth}
          height={displayHeight}
          className="border border-gray-300 rounded"
        />
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Detection target"
          style={{ display: "none" }}
          onLoad={draw}
        />
      </div>
    );
  }
);

export default DetectionsCanvas;
