const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');
const ffmpeg = require("fluent-ffmpeg");
// Add these lines at the top of your controller file
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;

// Set the paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
exports.getAllVideos = async (req, res) => {
  try {
    const videos = await prisma.video.findMany();
    res.json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
};

exports.getVideoById = async (req, res) => {
  const { id } = req.params;
  try {
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) },
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json(video);
  } catch (error) {
    console.error(`Error fetching video with ID ${id}:`, error);
    res.status(500).json({ error: "Failed to fetch video" });
  }
};

exports.uploadVideo = async (req, res) => {
  try {
    // Check if file exists in request
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const { originalname, filename, path: filePath, size } = req.file;

    // Extract metadata using FFmpeg
    const metadata = await extractMetadata(filePath);

    // Save video info to database
    const video = await prisma.video.create({
      data: {
        title: originalname,
        filename: filename,
        path: filePath,
        size: size,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        status: "uploaded",
        createdAt: new Date(),
      },
    });

    res
      .status(201)
      .json({ success: true, message: "Video uploaded successfully", video });
  } catch (error) {
    console.error("Error uploading video:", error);
    res.status(500).json({
      error: "Failed to upload video",
      details: error.message,
    });
  }
};
exports.trimVideo = async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime } = req.body;

  try {
    const video = await prisma.video.findUnique({   where: { id: parseInt(id) },
  });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    const inputPath = video.path;

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Video file not found on disk' });
    }
    const trimmedPath = path.join('uploads', `trimmed-${Date.now()}.mp4`);
    console.log(video)
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(endTime - startTime)
      .output(trimmedPath)
      .on('end', async () => {
        // Optionally: save path to DB or return it
        await prisma.video.update({
          where: { id: parseInt(id) },
          data: {
            path: trimmedPath,
            status: 'trimmed',
          },
        });

        res.status(200).json({
          message: 'Video trimmed successfully',
          trimmedPath,
        });
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        res.status(500).json({ error: 'Trimming failed' });
      })
      .run();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.addSubtitles = async (req, res) => {
  const { id } = req.params;
  const { text, startTime, endTime } = req.body;

  try {
    const video = await prisma.video.findUnique({ where: { id: parseInt(id) } });
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const inputPath = video.path;
    const outputPath = path.join('uploads', `subtitled-${Date.now()}.mp4`);

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found on disk' });
    }

    const duration = endTime - startTime;

    // Build drawtext filter
    const drawtext = `drawtext=text='${text}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-100:enable='between(t,${startTime},${endTime})'`;

    ffmpeg(inputPath)
      .videoFilter(drawtext)
      .output(outputPath)
      .on('end', async () => {
        await prisma.video.update({
          where: { id: parseInt(id) },
          data: {
            path: path.resolve(outputPath),
            status: 'subtitled',
          },
        });

        res.status(200).json({
          message: 'Subtitle added successfully',
          output: outputPath,
        });
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        res.status(500).json({ error: 'Subtitle rendering failed' });
      })
      .run();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteVideo = async (req, res) => {
  const { id } = req.params;
  try {
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) },
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Delete the actual file
    const fs = require("fs");
    if (fs.existsSync(video.path)) {
      fs.unlinkSync(video.path);
    }

    // Delete from database
    await prisma.video.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: `Video with ID: ${id} deleted successfully` });
  } catch (error) {
    console.error(`Error deleting video with ID ${id}:`, error);
    res.status(500).json({ error: "Failed to delete video" });
  }
};

// Helper function to extract metadata using FFmpeg
function extractMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video"
      );

      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream ? videoStream.width : 0,
        height: videoStream ? videoStream.height : 0,
        format: metadata.format.format_name,
        bitrate: metadata.format.bit_rate,
      });
    });
  });
}
