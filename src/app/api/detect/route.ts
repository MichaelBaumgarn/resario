import { NextRequest, NextResponse } from "next/server";
import { DetectionResult, HuggingFaceResponse } from "@/types/detection";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  console.log("🚀 API Route: Starting object detection request");

  try {
    console.log("📝 API Route: Parsing form data...");
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      console.log("❌ API Route: No image provided");
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    console.log(
      `📸 API Route: Image received - ${image.name}, ${image.type}, ${image.size} bytes`
    );

    console.log("🔄 API Route: Processing image...");
    const imageBuffer = await image.arrayBuffer();

    let targetSize = 512;
    let quality = 60;

    if (imageBuffer.byteLength > 5000000) {
      targetSize = 256;
      quality = 40;
      console.log(
        "📏 API Route: Very large image detected, using aggressive resizing"
      );
    }

    const resizedBuffer = await sharp(Buffer.from(imageBuffer))
      .resize(targetSize, targetSize, {
        fit: "inside",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .jpeg({
        quality: quality,
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();

    console.log(
      `📏 API Route: Image resized from ${imageBuffer.byteLength} to ${
        resizedBuffer.length
      } bytes (${Math.round(
        (resizedBuffer.length / imageBuffer.byteLength) * 100
      )}% of original)`
    );

    const base64Image = resizedBuffer.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    console.log(
      `📊 API Route: Base64 conversion complete - ${base64Image.length} characters`
    );

    console.log("🌐 API Route: Making request to Hugging Face API...");
    console.log(
      `🔑 API Route: Using API key: ${
        process.env.HUGGINGFACE_API_KEY ? "SET" : "NOT SET"
      }`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const startTime = Date.now();
      console.log("🔄 API Route: Using router endpoint with binary upload...");
      const huggingFaceResponse = await fetch(
        "https://router.huggingface.co/hf-inference/models/facebook/detr-resnet-101",
        {
          headers: {
            Authorization: `Bearer ${
              process.env.HUGGINGFACE_API_KEY || "hf_demo"
            }`,
            "Content-Type": "image/jpeg",
          },
          method: "POST",
          body: resizedBuffer,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const endTime = Date.now();
      console.log(
        `⏱️ API Route: Request completed in ${endTime - startTime}ms`
      );
      console.log(
        `📡 API Route: Response status: ${huggingFaceResponse.status}`
      );

      if (!huggingFaceResponse.ok) {
        const errorText = await huggingFaceResponse.text();
        console.error("❌ API Route: Hugging Face API error:", errorText);
        console.error(
          "❌ API Route: Response headers:",
          Object.fromEntries(huggingFaceResponse.headers.entries())
        );
        console.error("❌ API Route: Request details:", {
          url: "https://router.huggingface.co/hf-inference/models/facebook/detr-resnet-101",
          method: "POST",
          approach: "binary",
          imageSize: resizedBuffer.length,
          base64Size: base64Image.length,
        });

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

      const huggingFaceResults: any[] = await huggingFaceResponse.json();
      console.log(
        `📋 API Route: Received ${huggingFaceResults.length} detection results`
      );

      const detectionResults: DetectionResult[] = huggingFaceResults
        .filter((result: any) => result.score > 0.3)
        .map((result: any) => ({
          label: result.label,
          score: result.score,
          box: result.box,
        }));

      console.log(
        `🎯 API Route: Filtered to ${detectionResults.length} high-confidence detections`
      );
      console.log("✅ API Route: Returning real object detection results");
      return NextResponse.json(detectionResults);
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        console.log("⏰ API Route: Request timed out after 15 seconds");
        console.error("⏰ API Route: Timeout details:", {
          errorName: (error as Error).name,
          errorMessage: (error as Error).message,
          requestInfo: {
            approach: "binary",
            imageSize: resizedBuffer.length,
            base64Size: base64Image.length,
            timeoutMs: 15000,
          },
        });
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
      console.error("💥 API Route: Unexpected error during request:", error);
      throw error;
    }
  } catch (error) {
    console.error("💥 API Route: Error in detection API:", error);
    console.error("💥 API Route: Error stack:", (error as Error).stack);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
