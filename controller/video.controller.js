const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

exports.uploadVideo = async (req, res) => {
  try {
    // Check if a file is provided in the request
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "Please Select a file to upload" });
    }

    // Extract file details from the request
    const { originalname, filename, path: filePath, size } = req.file;

    // Extract metadata from the uploaded video file
    const metadata = await extractMetadata(filePath);

    // Save video information in the database
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

    // Respond with success message and video details
    res
      .status(201)
      .json({ success: true, message: "Video uploaded successfully", video });
  } catch (error) {
    // Log error and respond with failure message
    console.error("Error uploading video:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload video",
      details: error.message,
    });
  }
};
exports.trimVideo = async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime } = req.body;

  try {
    // Find the video by id in the database
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) },
    });
    if (!video)
      return res.status(404).json({ success: false, error: "Video not found" });

    const inputPath = video.path;

    // Check if the video file exists on disk
    if (!fs.existsSync(inputPath)) {
      return res
        .status(404)
        .json({ success: false, error: "Video file not found on disk" });
    }

    // Define the path for the trimmed video output
    const trimmedPath = path.join("uploads", `trimmed-${Date.now()}.mp4`);

    // Use ffmpeg to trim the video
    ffmpeg(inputPath)
      .setStartTime(startTime) // Set the start time for trimming
      .setDuration(endTime - startTime) // Set the duration for trimming
      .output(trimmedPath)
      .on("end", async () => {
        // Update the video path and status in the database upon successful trimming
        await prisma.video.update({
          where: { id: parseInt(id) },
          data: {
            path: trimmedPath,
            status: "trimmed",
          },
        });

        // Respond with success and the path to the trimmed video
        res.status(200).json({
          success: true,
          message: "Video trimmed successfully",
          trimmedPath,
        });
      })
      .on("error", (err) => {
        // Log and respond with an error if FFmpeg fails
        console.error("FFmpeg error:", err);
        res.status(500).json({ success: false, error: "Trimming failed" });
      })
      .run();
  } catch (err) {
    // Log and respond with an error if an unexpected server error occurs
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

exports.addSubtitles = async (req, res) => {
  const { id } = req.params;
  const { text, startTime, endTime } = req.body;

  try {
    // Retrieve the video information from the database
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) },
    });
    if (!video)
      return res.status(404).json({ success: false, error: "Video not found" });

    const inputPath = video.path;
    const outputPath = path.join("uploads", `subtitled-${Date.now()}.mp4`);

    // Ensure the video file exists on disk
    if (!fs.existsSync(inputPath)) {
      return res
        .status(404)
        .json({ success: false, error: "Input file not found on disk" });
    }

    // Calculate the duration for which the subtitle should appear
    const duration = endTime - startTime;

    // Define the FFmpeg drawtext filter for subtitles
    const drawtext = `drawtext=text='${text}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-100:enable='between(t,${startTime},${endTime})'`;

    // Process the video to add subtitles using FFmpeg
    ffmpeg(inputPath)
      .videoFilter(drawtext)
      .output(outputPath)
      .on("end", async () => {
        // Update the video record in the database with the new path and status
        await prisma.video.update({
          where: { id: parseInt(id) },
          data: {
            path: path.resolve(outputPath),
            status: "subtitled",
          },
        });

        // Send a success response to the client
        res.status(200).json({
          success: true,
          message: "Subtitle added successfully",
          output: outputPath,
        });
      })
      .on("error", (err) => {
        // Handle FFmpeg processing errors
        console.error("FFmpeg error:", err);
        res
          .status(500)
          .json({ success: false, error: "Subtitle rendering failed" });
      })
      .run();
  } catch (err) {
    // Handle unexpected server errors
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.renderFinalVideo = async (req, res) => {
  const { id } = req.params;

  // Render the final video for the provided video ID
  try {
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) },
    });
    if (!video)
      return res.status(404).json({ success: false, error: "Video not found" });

    const inputPath = video.path;
    const outputPath = path.join("uploads", `rendered-${Date.now()}.mp4`);

    // Check if the input video exists on disk
    if (!fs.existsSync(inputPath)) {
      return res
        .status(404)
        .json({ success: false, error: "Input video file not found on disk" });
    }

    // Use FFmpeg to render the final video
    ffmpeg(inputPath)
      .videoCodec("libx264") // Use H.264 video codec
      .outputOptions("-preset veryfast") // Set the rendering preset to "veryfast"
      .output(outputPath)
      .on("end", async () => {
        // Update the video record with the new path and status
        await prisma.video.update({
          where: { id: parseInt(id) },
          data: {
            path: path.resolve(outputPath),
            status: "rendered",
          },
        });

        // Send a success response to the client
        res.status(200).json({
          success: true,
          message: "Final video rendered successfully",
          output: outputPath,
        });
      })
      .on("error", (err) => {
        // Handle FFmpeg rendering errors
        console.error("FFmpeg render error:", err);
        res
          .status(500)
          .json({ success: false, error: "Rendering final video failed" });
      })
      .run();
  } catch (err) {
    // Handle unexpected server errors
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.downloadVideo = async (req, res) => {
  /**
   * This endpoint allows clients to download the final rendered video.
   * It takes the video ID as a parameter and returns the video file
   * if it exists on the server.
   */

  const { id } = req.params;

  try {
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) },
    });
    if (!video)
      return res.status(404).json({ success: false, error: "Video not found" });

    const filePath = video.path;

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({
          success: false,
          error: "Final video file not found on server",
        });
    }

    res.download(filePath, (err) => {
      if (err) {
        console.error("Download error:", err);
        res
          .status(500)
          .json({ success: false, error: "Failed to download video" });
      } else {
        res
          .status(200)
          .json({ success: true, message: "Video downloaded successfully" });
      }
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

function extractMetadata(filePath) {
  return new Promise((resolve, reject) => {
    // Use ffmpeg to gather metadata from the video file
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        // Reject the promise if an error occurs while retrieving metadata
        return reject(err);
      }

      // Find the video stream in the metadata
      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video"
      );

      // Resolve the promise with extracted video metadata
      resolve({
        duration: metadata.format.duration || 0, // Video duration in seconds
        width: videoStream ? videoStream.width : 0, // Video width in pixels
        height: videoStream ? videoStream.height : 0, // Video height in pixels
        format: metadata.format.format_name, // Video format name
        bitrate: metadata.format.bit_rate, // Video bitrate
      });
    });
  });
}
