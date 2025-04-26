# Video Editing Backend API

## Project Overview
A scalable backend for a video editing platform, built using:
- Node.js
- Express.js
- PostgreSQL (Prisma ORM)
- FFmpeg (video processing)

## Features
- Upload videos
- Trim videos
- Add subtitles
- Render final edited video
- Download final rendered video

## Tech Stack
- Node.js
- Express.js
- PostgreSQL + Prisma ORM
- Fluent-FFmpeg
- Multer

## API Endpoints

### Upload Video
`POST /api/videos/upload`
- Uploads a video.

### Trim Video
`POST /api/videos/:id/trim`
- Trim a video between startTime and endTime.

### Add Subtitle
`POST /api/videos/:id/subtitles`
- Add a subtitle between startTime and endTime.

### Render Final Video
`POST /api/videos/:id/render`
- Renders the final processed video.

### Download Final Video
`GET /api/videos/:id/download`
- Download the final rendered video.

## Installation
1. Clone the repo
2. Run `npm install`
3. Setup PostgreSQL database
4. Setup `.env` file
5. Run `npx prisma migrate dev`
6. Run `npm start`

## Environment Variables
Create a `.env` file:

