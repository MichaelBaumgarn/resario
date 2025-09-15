import { NextRequest, NextResponse } from "next/server";
import { DetectionResult } from "@/types/detection";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageBuffer = await image.arrayBuffer();

    const originalImage = sharp(Buffer.from(imageBuffer));

    const resizedBuffer = await originalImage
      .resize(512, 512, {
        fit: "inside",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .jpeg({
        quality: 60,
        progressive: true,
      })
      .toBuffer();

    const base64Image = resizedBuffer.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const startTime = Date.now();
      const huggingFaceResponse = await fetch(
        "https://router.huggingface.co/hf-inference/models/facebook/detr-resnet-101",
        {
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY || "hf_demo"}`,
            "Content-Type": "image/jpeg",
          },
          method: "POST",
          body: resizedBuffer,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const endTime = Date.now();

      if (!huggingFaceResponse.ok) {
        const errorText = await huggingFaceResponse.text();

        return NextResponse.json(
          {
            error: "Failed to process image with Hugging Face API",
            details: errorText,
            status: huggingFaceResponse.status,
            headers: Object.fromEntries(huggingFaceResponse.headers.entries()),
            requestInfo: {
              approach: "binary",
              imageSize: resizedBuffer.length,
              base64Size: base64Image.length,
            },
          },
          { status: huggingFaceResponse.status }
        );
      }

      const huggingFaceResults: Array<{
        label: string;
        score: number;
        box: { xmin: number; ymin: number; xmax: number; ymax: number };
      }> = await huggingFaceResponse.json();

      const detectionResults: DetectionResult[] = huggingFaceResults
        .filter((result) => result.score > 0.3)
        .map((result) => ({
          label: result.label,
          score: result.score,
          box: result.box,
        }));

      return NextResponse.json({
        detections: detectionResults,
        processedImage: dataUrl,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        return NextResponse.json(
          {
            error: "Request timed out after 15 seconds",
            details:
              "The Hugging Face API did not respond within the timeout period",
            suggestion:
              "The service might be overloaded. Try again in a few moments.",
            requestInfo: {
              approach: "binary",
              imageSize: resizedBuffer.length,
              base64Size: base64Image.length,
              timeoutMs: 15000,
            },
          },
          { status: 408 }
        );
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
