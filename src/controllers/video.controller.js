import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  console.log(userId);
  const pipeline = [];
  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"],
        },
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "userId is missing");
    }
    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }
  //Match Stage for Published Videos:
  pipeline.push({ $match: { isPublished: true } });

  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortType]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$ownerDetails",
    }
  );
  const videoAggregator = Video.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const video = await Video.aggregatePaginate(videoAggregator, options);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fatched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const videoLocalPath = req.files?.videoFile[0]?.path;
  if (!videoLocalPath) {
    throw new ApiError(400, "video path is required");
  }

  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail Path is required");
  }

  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile) {
    throw new ApiError(400, "Video not found failed");
  }
  if (!thumbnail) {
    throw new ApiError(400, "thumbnail not found failed");
  }

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: videoFile.url, // Change here to use only the URL
    _id: videoFile._id,
    thumbnail: thumbnail.url, // Change here to use only the URL
    _id: thumbnail._id,
    owner: req.user?._id,
    isPublished: true,
  });

  const videoUpload = await Video.findById(video._id);

  if (!videoUpload) {
    throw new ApiError(400, "video upload failed");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId not provided");
  }

  if (!isValidObjectId(req.user?._id)) {
    throw new ApiError(400, "Invalid userId");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },

    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              subscribersCount: 1,
              isSubscribed: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },

    {
      $addFields: {
        likeCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },

        islikedBy: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.like"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "video.url": 1,
        title: 1,
        description: 1,
        likeCount: 1,
        owner: 1,
        islikedBy: 1,
        comments: 1,
        views: 1,
        cretedAt: 1,
        isSubscribed: 1,
        subscribersCount: 1,
        duration: 1,
      },
    },
  ]);

  if (!video) {
    throw new ApiError(404, " video Not Found");
  }
  // increment views if video fetched successfully
  await Video.findByIdAndUpdate(videoId, {
    $inc: {
        views: 1
    }
});

// add this video to user watch history
await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
        watchHistory: videoId
    }
  });
  return res
    .status(200)
    .json(new ApiResponse(200, video, "video found successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId are required");
  }
  if (!title || !description) {
    throw new ApiError(400, "title and description are required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, " video Not Found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    // ?.owner - Optional chaining to safely access owner
    // toString() - Convert MongoDB ObjectId to string
    // req.user?._id - Current logged-in user's ID
    throw new ApiError(
      400,
      "You can't edit this video as you are not the owner"
    );
  }

  const thumbnailLocalPath = req.file?.path;
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail is required");
  }
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail.url) {
    throw new ApiError(400, "thumbnail upload failed");
  }
  
  // Update video details
  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: thumbnail.url,
      },
    },
    { new: true }
  );
  if (!updatedVideo) {
    throw new ApiError(500, "update video failed");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    // ?.owner - Optional chaining to safely access owner
    // toString() - Convert MongoDB ObjectId to string
    // req.user?._id - Current logged-in user's ID
    throw new ApiError(
      400,
      "You can't delete this video as you are not the owner"
    );
  }
  const videoDelete = await Video.findByIdAndDelete(video?._id);
  if (!videoDelete) {
    throw new ApiError(500, "delete video failed");
  }

  await deleteFromCloudinary(video.thumbnail.publicId);
  await deleteFromCloudinary(video.videoFile.publicId, "video");

  await Like.deleteMany({
    video: videoId,
  });

  await Comment.deleteMany({
    video: videoId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You can't change the publish status of this video as you are not the owner"
    );
  }

  const videoPublishAndUnpublish = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video?.isPublished,
      },
    },
    {
      new: true,
    }
  );
  if (!videoPublishAndUnpublish) {
    throw new ApiError(500, "You can't change the publish status of this");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: videoPublishAndUnpublish },
        "Video publish status toggled successfully"
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
