"use client";

import { useState, useRef, useEffect } from "react";
import { DetectionResult } from "@/types/detection";
import { Detection } from "@/lib/types";
import DetectionsCanvas, { DetectionsCanvasHandle } from "./DetectionsCanvas";

interface ObjectDetectionResultsProps {
  results: DetectionResult[];
  originalImage: string;
  onResultsUpdate?: (results: DetectionResult[]) => void;
}

export default function ObjectDetectionResults({
  results,
  originalImage,
  onResultsUpdate,
}: ObjectDetectionResultsProps) {
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [displayDimensions, setDisplayDimensions] = useState({
    width: 0,
    height: 0,
  });
  const canvasRef = useRef<DetectionsCanvasHandle>(null);

  console.log("ObjectDetectionResults render:", {
    resultsCount: results.length,
    originalImage: originalImage.substring(0, 50) + "...",
    imageDimensions,
    displayDimensions,
  });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = originalImage;
  }, [originalImage]);

  useEffect(() => {
    if (imageDimensions.width > 0 && imageDimensions.height > 0) {
      const maxWidth = 1000;
      const maxHeight = 750;
      const aspectRatio = imageDimensions.height / imageDimensions.width;

      let displayWidth = Math.min(maxWidth, imageDimensions.width);
      let displayHeight = displayWidth * aspectRatio;

      if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight / aspectRatio;
      }

      console.log("Calculated display dimensions:", {
        originalDimensions: imageDimensions,
        maxWidth,
        maxHeight,
        aspectRatio,
        calculatedWidth: displayWidth,
        calculatedHeight: displayHeight,
      });

      setDisplayDimensions({ width: displayWidth, height: displayHeight });
    }
  }, [imageDimensions]);

  const mapToDetection = (result: DetectionResult): Detection => ({
    label: result.label,
    score: result.score,
    box: {
      xmin: result.box.xmin,
      ymin: result.box.ymin,
      xmax: result.box.xmax,
      ymax: result.box.ymax,
    },
  });

  const mapToDetectionResult = (detection: Detection): DetectionResult => ({
    label: detection.label,
    score: detection.score,
    box: {
      xmin: detection.box.xmin,
      ymin: detection.box.ymin,
      xmax: detection.box.xmax,
      ymax: detection.box.ymax,
    },
  });

  const handleDetectionUpdate = (detections: Detection[]) => {
    const updatedResults = detections.map(mapToDetectionResult);
    onResultsUpdate?.(updatedResults);
  };

  const getRandomColor = (index: number) => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E9",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Detection Results
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Found {results.length} object{results.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => canvasRef.current?.downloadPNG()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Download Annotated Image
        </button>
      </div>

      {imageDimensions.width > 0 && displayDimensions.width > 0 && (
        <div className="flex justify-center">
          <DetectionsCanvas
            ref={canvasRef}
            imageUrl={originalImage}
            naturalWidth={imageDimensions.width}
            naturalHeight={imageDimensions.height}
            displayWidth={displayDimensions.width}
            displayHeight={displayDimensions.height}
            detections={results.map(mapToDetection)}
            scoreThreshold={0.3}
            onDetectionUpdate={handleDetectionUpdate}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result, index) => {
          const color = getRandomColor(index);

          return (
            <div
              key={index}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4"
              style={{ borderLeftColor: color }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {result.label}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(result.score * 100)}%
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p>
                  Position: ({Math.round(result.box.xmin)},{" "}
                  {Math.round(result.box.ymin)})
                </p>
                <p>
                  Size: {Math.round(result.box.xmax - result.box.xmin)} ×{" "}
                  {Math.round(result.box.ymax - result.box.ymin)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
