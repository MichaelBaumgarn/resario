# Backend Design: Object Detection Inference History System

## Overview

This document outlines the backend design for extending the existing object detection application to support inference history tracking. The system will allow users to view their previously processed images and access detection results on demand.

## Current System Analysis

The existing frontend application:

- Uses Next.js with TypeScript
- Implements object detection via Hugging Face DETR model
- Processes images through `/api/detect` endpoint
- Returns detection results with bounding boxes and confidence scores
- Displays results in real-time with visual overlays

## Design Considerations & Assumptions

### Considerations

1. **Scalability**: System should handle multiple users with varying inference volumes
2. **Data Integrity**: Ensure detection results are accurately stored and retrieved
3. **Performance**: Optimize for fast retrieval of inference history
4. **Storage Efficiency**: Balance image storage with access speed
5. **User Privacy**: Ensure users can only access their own inference history
6. **Data Retention**: Consider storage limits and cleanup policies

### Assumptions

1. User authentication is handled by an external system
2. Database and file storage systems are available
3. Images are stored as files with metadata in database
4. Detection results are stored as JSON in database
5. System supports concurrent users
6. Network latency is acceptable for image retrieval

## Database Schema Design

### Tables

#### `inferences` table

```sql
CREATE TABLE inferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    image_filename VARCHAR(500) NOT NULL,
    image_url VARCHAR(1000) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    image_size_bytes INTEGER NOT NULL,
    detection_results JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inferences_user_id ON inferences(user_id);
CREATE INDEX idx_inferences_created_at ON inferences(created_at DESC);
```

#### `detection_objects` table (normalized approach)

```sql
CREATE TABLE detection_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inference_id UUID REFERENCES inferences(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    bounding_box JSONB NOT NULL, -- {xmin, ymin, xmax, ymax}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_detection_objects_inference_id ON detection_objects(inference_id);
```

## API Design

### Core Function: `getInferenceHistory(userId)`

```typescript
/**
 * Retrieves the complete inference history for a specific user.
 *
 * @param userId - Unique identifier for the user
 * @param page - Page number for pagination (default: 1)
 * @param limit - Number of results per page (default: 20, max: 100)
 * @returns Promise<InferenceHistoryResponse> - Response containing paginated inference history
 * @throws {ValidationError} If userId is invalid
 * @throws {DatabaseError} If database query fails
 */

interface InferenceHistoryResponse {
  success: boolean;
  data: {
    inferences: InferenceHistoryItem[];
    pagination: PaginationInfo;
  };
  timestamp: string;
}

interface InferenceHistoryItem {
  id: string;
  imageUrl: string;
  originalFilename: string;
  imageSizeBytes: number;
  detectionResults: DetectionResult[];
  createdAt: string;
  detectionCount: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  limit: number;
}

interface DatabaseRow {
  id: string;
  image_filename: string;
  image_url: string;
  original_filename: string;
  image_size_bytes: number;
  detection_results: DetectionResult[];
  created_at: Date;
  total_count: number;
}

async function getInferenceHistory(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<InferenceHistoryResponse> {
  // Input validation
  if (!userId || typeof userId !== "string") {
    throw new ValidationError("Valid userId is required");
  }

  if (page < 1 || limit < 1 || limit > 100) {
    throw new ValidationError("Invalid pagination parameters");
  }

  // Calculate offset for pagination
  const offset = (page - 1) * limit;

  try {
    // Query database for user's inference history
    const query = `
      SELECT 
        i.id,
        i.image_filename,
        i.image_url,
        i.original_filename,
        i.image_size_bytes,
        i.detection_results,
        i.created_at,
        COUNT(*) OVER() as total_count
      FROM inferences i
      WHERE i.user_id = $1
      ORDER BY i.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const results: DatabaseRow[] = await database.query(query, [
      userId,
      limit,
      offset,
    ]);

    // Process results
    const inferences: InferenceHistoryItem[] = [];
    let totalCount = 0;

    for (const row of results) {
      if (totalCount === 0) {
        totalCount = row.total_count;
      }

      const inferenceData: InferenceHistoryItem = {
        id: row.id,
        imageUrl: row.image_url,
        originalFilename: row.original_filename,
        imageSizeBytes: row.image_size_bytes,
        detectionResults: row.detection_results,
        createdAt: row.created_at.toISOString(),
        detectionCount: row.detection_results?.length || 0,
      };
      inferences.push(inferenceData);
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      success: true,
      data: {
        inferences,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext,
          hasPrevious: hasPrev,
          limit,
        },
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error(
        `Database error retrieving inference history for user ${userId}:`,
        error
      );
      throw error;
    }
    console.error(
      `Unexpected error retrieving inference history for user ${userId}:`,
      error
    );
    throw new DatabaseError("Failed to retrieve inference history");
  }
}
```

### Supporting Functions

```typescript
/**
 * Stores a new inference result in the database and file system.
 *
 * @param userId - User identifier
 * @param imageFile - Uploaded image file
 * @param detectionResults - Detection results from AI model
 * @returns Promise<StoreInferenceResponse> - Response with stored inference details
 */

interface StoreInferenceResponse {
  success: boolean;
  data: {
    inferenceId: string;
    imageUrl: string;
    detectionCount: number;
  };
}

interface StoredInference {
  id: string;
  user_id: string;
  image_filename: string;
  image_url: string;
  original_filename: string;
  image_size_bytes: number;
  detection_results: DetectionResult[];
  created_at: Date;
}

async function storeInference(
  userId: string,
  imageFile: File,
  detectionResults: DetectionResult[]
): Promise<StoreInferenceResponse> {
  // Generate unique filename
  const fileExtension = imageFile.name.split(".").pop() || "jpg";
  const uniqueFilename = `${crypto.randomUUID()}.${fileExtension}`;

  // Store image file
  const imageUrl = await fileStorage.storeImage(imageFile, uniqueFilename);

  // Store in database
  const query = `
    INSERT INTO inferences (
      user_id, 
      image_filename, 
      image_url, 
      original_filename, 
      image_size_bytes, 
      detection_results
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;

  const result = await database.query(query, [
    userId,
    uniqueFilename,
    imageUrl,
    imageFile.name,
    imageFile.size,
    JSON.stringify(detectionResults),
  ]);

  const inferenceId = result[0].id;

  return {
    success: true,
    data: {
      inferenceId: inferenceId,
      imageUrl: imageUrl,
      detectionCount: detectionResults.length,
    },
  };
}

/**
 * Retrieves a specific inference by ID for detailed view.
 *
 * @param inferenceId - Unique inference identifier
 * @param userId - User identifier for authorization
 * @returns Promise<GetInferenceResponse> - Complete inference details
 */

interface GetInferenceResponse {
  success: boolean;
  data: {
    id: string;
    imageUrl: string;
    originalFilename: string;
    detectionResults: DetectionResult[];
    createdAt: string;
  };
}

async function getInferenceById(
  inferenceId: string,
  userId: string
): Promise<GetInferenceResponse> {
  // Verify user owns this inference
  const query = `
    SELECT * FROM inferences 
    WHERE id = $1 AND user_id = $2
  `;

  const result: StoredInference[] = await database.query(query, [
    inferenceId,
    userId,
  ]);

  if (!result || result.length === 0) {
    throw new NotFoundError("Inference not found or access denied");
  }

  const inference = result[0];

  return {
    success: true,
    data: {
      id: inference.id,
      imageUrl: inference.image_url,
      originalFilename: inference.original_filename,
      detectionResults: inference.detection_results,
      createdAt: inference.created_at.toISOString(),
    },
  };
}
```

## Expected API Response Format

### `getInferenceHistory(userId)` Response

```json
{
  "success": true,
  "data": {
    "inferences": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "imageUrl": "https://storage.example.com/images/550e8400-e29b-41d4-a716-446655440000.jpg",
        "originalFilename": "vacation_photo.jpg",
        "imageSizeBytes": 2048576,
        "detectionResults": [
          {
            "label": "person",
            "score": 0.95,
            "box": {
              "xmin": 100,
              "ymin": 150,
              "xmax": 300,
              "ymax": 500
            }
          },
          {
            "label": "car",
            "score": 0.87,
            "box": {
              "xmin": 400,
              "ymin": 200,
              "xmax": 600,
              "ymax": 400
            }
          }
        ],
        "createdAt": "2024-01-15T10:30:00Z",
        "detectionCount": 2
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 87,
      "hasNext": true,
      "hasPrevious": false,
      "limit": 20
    }
  },
  "timestamp": "2024-01-15T10:35:00Z"
}
```

## Next.js API Route Implementation

### API Route: `/api/inferences/history`

```typescript
// app/api/inferences/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getInferenceHistory } from "@/lib/inference-service";
import { ValidationError, DatabaseError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    const result = await getInferenceHistory(userId, page, limit);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { error: "Database error occurred" },
        { status: error.statusCode }
      );
    }

    console.error("Unexpected error in inference history API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### API Route: `/api/inferences/[id]`

```typescript
// app/api/inferences/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getInferenceById } from "@/lib/inference-service";
import { InferenceNotFoundError, ValidationError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    const result = await getInferenceById(params.id, userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InferenceNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Unexpected error in get inference API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Frontend Integration Strategy

### 1. History List View

The frontend will use the `getInferenceHistory` API to display a paginated list of previous inferences:

```typescript
// Frontend component for inference history
interface InferenceHistoryItem {
  id: string;
  imageUrl: string;
  originalFilename: string;
  detectionCount: number;
  createdAt: string;
}

const fetchInferenceHistory = async (page: number = 1) => {
  const response = await fetch(`/api/inferences/history?page=${page}&limit=20`);
  const data = await response.json();
  return data.data;
};
```

**Frontend Implementation:**

- Display thumbnail images in a grid layout
- Show detection count and timestamp for each item
- Implement pagination controls
- Add search/filter functionality by date range
- Click handler to navigate to detailed view

### 2. Detailed Inference View

When a user clicks on a history item, the frontend will:

```typescript
const fetchInferenceDetails = async (inferenceId: string) => {
  const response = await fetch(`/api/inferences/${inferenceId}`);
  const data = await response.json();
  return data.data;
};
```

**Frontend Implementation:**

- Reuse existing `ObjectDetectionResults` component
- Display full-size image with bounding boxes
- Show complete detection results with confidence scores
- Provide option to re-process or delete the inference

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │    │   (Node.js)     │    │   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. GET /api/inferences│                       │
         │    /history           │                       │
         ├──────────────────────►│                       │
         │                       │ 2. Query inferences   │
         │                       │    table              │
         │                       ├──────────────────────►│
         │                       │ 3. Return paginated   │
         │                       │    results            │
         │                       │◄──────────────────────┤
         │ 4. JSON response      │                       │
         │◄──────────────────────┤                       │
         │                       │                       │
         │ 5. GET /api/inferences│                       │
         │    /{id}              │                       │
         ├──────────────────────►│                       │
         │                       │ 6. Query specific     │
         │                       │    inference          │
         │                       ├──────────────────────►│
         │                       │ 7. Return full        │
         │                       │    inference data     │
         │                       │◄──────────────────────┤
         │ 8. JSON response      │                       │
         │◄──────────────────────┤                       │
         │                       │                       │
┌─────────────────┐              │                       │
│   File Storage  │              │                       │
│   (AWS S3/      │              │                       │
│   Local Files)  │              │                       │
└─────────────────┘              │                       │
         │                       │                       │
         │ 9. Serve image files  │                       │
         │◄──────────────────────┤                       │
```

## Performance Optimizations

1. **Database Indexing**: Index on `user_id` and `created_at` for fast queries
2. **Image Optimization**: Store multiple image sizes (thumbnail, medium, full)
3. **Caching**: Implement Redis caching for frequently accessed inference data
4. **Pagination**: Limit results per page to prevent large data transfers
5. **Lazy Loading**: Load images on-demand in the frontend

## Security Considerations

1. **User Isolation**: Ensure users can only access their own inference data
2. **Input Validation**: Validate all input parameters and file uploads
3. **File Storage Security**: Secure file storage with proper access controls
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Data Sanitization**: Sanitize all user inputs before database storage

## Error Handling

```typescript
/**
 * Base exception for inference history operations
 */
class InferenceHistoryError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = "InferenceHistoryError";
  }
}

/**
 * Raised when user ID is invalid or user not found
 */
class UserNotFoundError extends InferenceHistoryError {
  constructor(message: string = "User not found") {
    super(message, 404);
    this.name = "UserNotFoundError";
  }
}

/**
 * Raised when inference ID is not found or access denied
 */
class InferenceNotFoundError extends InferenceHistoryError {
  constructor(message: string = "Inference not found or access denied") {
    super(message, 404);
    this.name = "InferenceNotFoundError";
  }
}

/**
 * Raised when database operations fail
 */
class DatabaseError extends InferenceHistoryError {
  constructor(message: string = "Database operation failed") {
    super(message, 500);
    this.name = "DatabaseError";
  }
}

/**
 * Raised when input validation fails
 */
class ValidationError extends InferenceHistoryError {
  constructor(message: string = "Invalid input parameters") {
    super(message, 400);
    this.name = "ValidationError";
  }
}
```

## Future Enhancements

1. **Search Functionality**: Add text search across detection labels
2. **Export Features**: Allow users to export their inference history
3. **Analytics**: Provide usage statistics and detection trends
4. **Batch Operations**: Support bulk deletion or organization of inferences
5. **Sharing**: Allow users to share specific inference results
6. **Backup/Restore**: Implement data backup and recovery mechanisms

## Conclusion

This design provides a robust foundation for implementing inference history tracking while maintaining the existing application's performance and user experience. The modular approach allows for incremental implementation and future enhancements as requirements evolve.
