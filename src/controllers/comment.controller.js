import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(400, "Invalid video id");
  }
  const aggregateComments =  [
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likeDetails",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likeDetails" },
        owner: {
          $first: "$ownerDetails",
        },
        islikedBy: {
          $cond: {
            if: { $in: [req.user?._id, "$likeDetails.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        likesCount: 1,
        islikedBy: 1,
        ownerDetail: {
          username: 1,
          "avatar.url": 1,
        },
      },
    },
  ]

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  const comments = await Comment.aggregatePaginate(
    aggregateComments, 
    options
  );

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comment fatched on successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const comment = await Comment.create({
    content,
    videoId,
    owner: req.user?._id,
  });

  if (!comment) {
    throw new ApiError(404, "Failed to create comment");
  }

  return res.status(200).json(new ApiResponse(200, comment, "Comment created"));
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  const { content } = req.body;
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  if (comment?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You can't update this comment as you are not the owner"
    );
  }

  const updateComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  );
  if (!updateComment) {
    throw new ApiError(500, "Failed to update comment");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updateComment, "updated comment successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You can't delete this comment as you are not the owner"
    );
  }
  const deleteComment = await Comment.findByIdAndDelete(commentId);
  if (!deleteComment) {
    throw new ApiError(500, "Failed to delete comment");
  }

  await Like.deleteMany({
    comment: commentId,
    likedBy: req.user,
  });

  // await Reply.deleteMany({
  //     comment: commentId,
  //     likedBy: req.user})

  return res
    .status(200)
    .json(new ApiResponse(200, { commentId }, "delete comment successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
