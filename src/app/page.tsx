"use client";

import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import ObjectDetectionResults from "@/components/ObjectDetectionResults";
import { DetectionResult } from "@/types/detection";

export default function Home() {
  const [detectionResults, setDetectionResults] = useState<DetectionResult[]>(
    []
  );
  const [originalImage, setOriginalImage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleDetectionComplete = (
    results: DetectionResult[],
    imageUrl: string
  ) => {
    setDetectionResults(results);
    setOriginalImage(imageUrl);
  };

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Object Detection App
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Upload an image to detect objects using AI-powered detection
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <ImageUpload
              onDetectionComplete={handleDetectionComplete}
              onLoadingChange={handleLoadingChange}
            />
          </div>

          {isLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">
                  Processing image...
                </span>
              </div>
            </div>
          )}

          {detectionResults.length > 0 && originalImage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <ObjectDetectionResults
                results={detectionResults}
                originalImage={originalImage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
