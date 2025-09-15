"use client";

import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { DetectionResult } from "@/types/detection";

interface ImageUploadProps {
  onDetectionComplete: (results: DetectionResult[], imageUrl: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

export default function ImageUpload({
  onDetectionComplete,
  onLoadingChange,
}: ImageUploadProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      alert("Please select a valid image file.");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const detectObjects = async () => {
    if (!selectedImage) {
      alert("Please select an image first.");
      return;
    }

    onLoadingChange(true);

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);

      const response = await fetch("/api/detect", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Detection failed");
      }

      const responseData = await response.json();

      const results = responseData.detections || responseData;
      const processedImage = responseData.processedImage;

      onDetectionComplete(results, processedImage);
    } catch (error) {
      alert("Failed to detect objects. Please try again.");
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <div className="w-full">
      {!selectedImage ? (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.svg"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="space-y-4">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                Upload an image
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                Drag and drop or click to select
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Supports JPG, PNG, GIF, WebP, TIFF, SVG and more
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative inline-block">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-64 max-w-full rounded-lg shadow-md"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {selectedImage.name}
            </p>
            <button
              onClick={detectObjects}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Detect Objects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
