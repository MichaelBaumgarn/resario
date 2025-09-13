# Resario - Object Detection App

A Next.js application that provides an easy and interactive way to perform object detection on uploaded images using the Hugging Face DETR (Detection Transformer) model.

## Features

- 🖼️ **Image Upload**: Drag and drop or click to upload images
- 🤖 **AI Detection**: Uses Facebook's DETR-ResNet-50 model for object detection
- 📦 **Bounding Boxes**: Visual overlay of detected objects with confidence scores
- 🎨 **Modern UI**: Beautiful, responsive interface with dark mode support
- ⚡ **Real-time**: Fast processing with loading states

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Hugging Face API key (free)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd resario
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:
```bash
HUGGINGFACE_API_KEY=your_api_key_here
```

To get a free Hugging Face API key:
1. Go to [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create a new token
3. Copy the token to your `.env.local` file

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Upload an Image**: Drag and drop an image or click to select one
2. **Detect Objects**: Click the "Detect Objects" button
3. **View Results**: See detected objects with bounding boxes and confidence scores

## API

The app uses the Hugging Face Inference API with the `facebook/detr-resnet-50` model:
- **Endpoint**: `/api/detect`
- **Method**: POST
- **Input**: FormData with image file
- **Output**: Array of detection results with bounding boxes

## Technologies Used

- **Next.js 14+**: React framework with App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Lucide React**: Icons
- **Hugging Face API**: Object detection model

## Project Structure

```
src/
├── app/
│   ├── api/detect/route.ts    # API endpoint for object detection
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main page
├── components/
│   ├── ImageUpload.tsx        # Image upload component
│   └── ObjectDetectionResults.tsx # Results display component
└── types/
    └── detection.ts           # TypeScript types
```

## Deployment

The app can be deployed to Vercel, Netlify, or any platform that supports Next.js:

```bash
npm run build
npm start
```

For Vercel deployment, make sure to add your `HUGGINGFACE_API_KEY` to the environment variables in your deployment settings.
