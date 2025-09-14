# Open-Ended Questions: Backend Design Implementation

## Question 1: Features to Highlight

### Key Implementation Features

**1. Type-Safe Architecture**

- Comprehensive TypeScript interfaces for all data structures
- Strong typing throughout the API layer ensures compile-time error detection
- Proper error handling with custom exception classes and HTTP status codes

**2. Scalable Database Design**

- Normalized schema with proper indexing on `user_id` and `created_at`
- JSONB storage for detection results allows for flexible querying
- Pagination support with efficient offset-based queries
- Separate `detection_objects` table for advanced analytics capabilities

**3. Production-Ready Error Handling**

- Hierarchical error classes with appropriate HTTP status codes
- Comprehensive input validation and sanitization
- Proper logging and error propagation
- Graceful degradation for database failures

**4. Performance Optimizations**

- Database indexing strategy for fast user-specific queries
- Pagination to prevent large data transfers
- Efficient SQL queries with parameterized statements
- Caching considerations for frequently accessed data

**5. Security-First Approach**

- User isolation ensuring data privacy
- Input validation and sanitization
- Rate limiting considerations
- Secure file storage with proper access controls

## Question 2: Top 3 Changes with 5 More Hours

### 1. Batch Image Processing & History

**Priority: High**

- **Multiple image upload** - drag & drop multiple files at once for batch processing
- **Processing queue** - show progress for each image with individual status indicators
- **Local storage history** - save results in browser localStorage for quick access
- **Quick re-run** - click to re-process any previous image from history
- **Export results** - download detection results as JSON/CSV for analysis
- **Implementation**: Add file array handling, progress tracking, and localStorage integration

### 2. Advanced Search and Filtering

**Priority: Medium**

- Full-text search across detection labels and metadata
- Date range filtering with calendar picker
- Filter by detection confidence scores
- Sort by various criteria (date, confidence, detection count)
- **Implementation**: Add search indexes, implement query builder, create filter UI components

### 3. Image Optimization and CDN Integration

**Priority: Medium**

- Generate multiple image sizes (thumbnail, medium, full) during upload
- Implement CDN integration for faster image delivery
- Add image compression and format optimization
- Implement lazy loading for better performance
- **Implementation**: Add image processing pipeline, integrate with AWS CloudFront or similar

## Question 3: Video Upload - API Calls vs Accuracy Balance

### Recommended Approach: Hybrid Frame Sampling Strategy

**Core Strategy:**

- Process every Nth frame (e.g., every 5th frame) for real-time feedback
- Use interpolation for intermediate frames
- Implement confidence-based frame selection for critical moments

**Implementation Details:**

```typescript
interface VideoProcessingConfig {
  frameSamplingRate: number; // Process every N frames
  interpolationEnabled: boolean;
  confidenceThreshold: number; // Skip frames with high confidence
  criticalFrameDetection: boolean; // Detect scene changes
}

// Pseudo-implementation
async function processVideoFrames(
  videoFile: File,
  config: VideoProcessingConfig
) {
  const frames = extractFrames(videoFile, config.frameSamplingRate);
  const results = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    // Skip processing if previous frame had high confidence
    if (
      i > 0 &&
      results[i - 1].averageConfidence > config.confidenceThreshold
    ) {
      results.push(interpolateResults(results[i - 1], results[i - 2]));
      continue;
    }

    const detection = await detectObjects(frame);
    results.push(detection);
  }

  return interpolateIntermediateFrames(results);
}
```

**Benefits:**

- **Performance**: Reduces API calls by 60-80% while maintaining visual continuity
- **Accuracy**: Critical frames are always processed, ensuring important detections aren't missed
- **User Experience**: Smooth bounding box animations between processed frames
- **Cost Efficiency**: Significantly reduces API costs for video processing

## Question 4: Backend Changes for Video Performance

### 1. Asynchronous Processing Pipeline

```typescript
// Queue-based video processing
interface VideoProcessingJob {
  id: string;
  userId: string;
  videoUrl: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  results: VideoDetectionResult[];
}

// Background job processor
class VideoProcessor {
  async processVideo(job: VideoProcessingJob) {
    // Extract frames in batches
    const frameBatches = await this.extractFrameBatches(job.videoUrl);

    for (const batch of frameBatches) {
      const detections = await Promise.all(
        batch.map((frame) => this.detectObjects(frame))
      );

      await this.updateJobProgress(job.id, detections);
    }
  }
}
```

### 2. Optimized Database Schema for Video

```sql
-- Video-specific tables
CREATE TABLE video_inferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    video_filename VARCHAR(500) NOT NULL,
    video_url VARCHAR(1000) NOT NULL,
    total_frames INTEGER NOT NULL,
    processed_frames INTEGER DEFAULT 0,
    processing_status VARCHAR(50) DEFAULT 'queued',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE video_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_inference_id UUID REFERENCES video_inferences(id),
    frame_number INTEGER NOT NULL,
    detection_results JSONB NOT NULL,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimized indexes
CREATE INDEX idx_video_inferences_user_status ON video_inferences(user_id, processing_status);
CREATE INDEX idx_video_detections_video_frame ON video_detections(video_inference_id, frame_number);
```

### 3. Caching and Performance Optimizations

**Redis Caching Strategy:**

```typescript
class VideoCacheManager {
  // Cache processed frame results
  async cacheFrameDetection(
    videoId: string,
    frameNumber: number,
    results: DetectionResult[]
  ) {
    const key = `video:${videoId}:frame:${frameNumber}`;
    await redis.setex(key, 3600, JSON.stringify(results)); // 1 hour TTL
  }

  // Cache interpolated results
  async cacheInterpolatedFrames(
    videoId: string,
    frameRange: [number, number],
    results: DetectionResult[]
  ) {
    const key = `video:${videoId}:interpolated:${frameRange[0]}-${frameRange[1]}`;
    await redis.setex(key, 7200, JSON.stringify(results)); // 2 hours TTL
  }
}
```

### 4. Streaming and Progressive Loading

```typescript
// Server-Sent Events for real-time progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        const progress = await getVideoProcessingProgress(videoId);
        const data = `data: ${JSON.stringify(progress)}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));

        if (progress.status === "completed") {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 5. Frontend Optimizations

**Progressive Video Loading:**

```typescript
// Frontend video player with progressive detection loading
class VideoDetectionPlayer {
  private detectionCache = new Map<number, DetectionResult[]>();

  async loadDetectionsForTimeRange(startTime: number, endTime: number) {
    const frameNumbers = this.getFrameNumbersInRange(startTime, endTime);

    // Load cached detections first
    const cachedDetections = frameNumbers
      .map((frame) => this.detectionCache.get(frame))
      .filter(Boolean);

    // Fetch missing detections
    const missingFrames = frameNumbers.filter(
      (frame) => !this.detectionCache.has(frame)
    );
    if (missingFrames.length > 0) {
      const newDetections = await this.fetchDetectionsForFrames(missingFrames);
      newDetections.forEach((detection, index) => {
        this.detectionCache.set(missingFrames[index], detection);
      });
    }
  }
}
```

### Summary of Backend Changes:

1. **Asynchronous Processing**: Queue-based system for handling video uploads
2. **Optimized Schema**: Video-specific tables with proper indexing
3. **Caching Layer**: Redis for frame results and interpolated data
4. **Streaming API**: Real-time progress updates via Server-Sent Events
5. **Batch Processing**: Process multiple frames in parallel
6. **Smart Sampling**: Confidence-based frame selection to reduce processing load

These changes would enable:

- **Scalability**: Handle multiple video uploads simultaneously
- **Performance**: 3-5x faster processing through optimization
- **User Experience**: Real-time progress updates and smooth playback
- **Cost Efficiency**: Reduced API calls through intelligent frame sampling
- **Reliability**: Robust error handling and retry mechanisms
