import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }
  const subscription = await Subscription.findOne({
    channel: channelId,
    subscriber: req.user?._id,
  });
  if (subscription) {
    await Subscription.findByIdAndDelete(
      subscription._id,
    );
    return res.status(200).json(new ApiResponse(200, "unsubscribing "));
  } else {
    const newSubscription = await Subscription.create({
      channel: channelId,
      subscriber: req.user?._id,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, newSubscription, "subsbscribing"));
  }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  console.log("Received channelId:", req.params.channelId); // Log the channelId
  let { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  channelId = new mongoose.Types.ObjectId(channelId);
  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: channelId,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribedTo",
            },
          },
          {
            $addFields: {
              subscribedTo: {
                $cond: {
                  if: { $in: [channelId, "$subscribedTo.subscriber"] },
                  then: true,
                  else: false,
                },
              },
              subscribersCount: {
                $size: "$subscribedTo",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscriber",
    },
    {
      $project: {
        _id: 0,
        subscriberId: {
          _id: 1,
          username: 1,
          fullName: 1,
          "avatar.url": 1,
          subscribersCount: 1,
          subscribedTo: 1,
        },
      },
    },
  ]);

  if (!subscribers) {
    throw new ApiError(
      404,
      "Please select a subscriber to subscribe to this channel "
    );
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribers, "subscribers fetched successfully")
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  console.log("Received subscriberId:", subscriberId);

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriber ID");
  }

  const subscribedChannels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedChannel",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "videos",
            },
          },
          {
            $addFields: {
              latestvideo: { $last: "$videos" },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscribedChannel",
    },
    {
      $project: {
        _id: 0,
        subscribedChannel: {
          _id: 1,
          username: 1,
          fullName: 1,
          "avatar.url": 1,
          latestvideo: {
            "videoFile.url": 1,
            "thumbnail.url": 1,
            owner: 1,
            title: 1,
            description: 1,
            duration: 1,
            views: 1,
            createAt: 1,
            likes: 1,
          },
        },
      },
    },
  ]);

  if (!subscribedChannels) {
    throw new ApiError(404, "No subscribed channels found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        "Subscribed channels list was successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
