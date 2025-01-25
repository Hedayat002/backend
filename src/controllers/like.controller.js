import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import ApiError from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video
    if (!isValidObjectId(videoId)) {
      throw new ApiError(400,"video id is not valid")
    }
    const like = await Like.findOne(
        { 
            video: videoId, 
            likedBy:  req.user?._id });

    if (like) {
        await Like.deleteOne(
            { _id: like._id });

        return res
        .status(200)
         .json(new ApiResponse( 200, "like removed"))
    } else {
        await Like.create(
            { video: videoId,
              likedBy: req.user?._id 
            });

        return res
        .status(200).
        json(new ApiResponse(200, "Like added"));
    }
    
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
    if (!isValidObjectId(commentId)) {
        throw new ApiError(400,"comment id is not valid")
    }

    const like = await Like.findOne(
        { 
            comment: commentId, 
            likedBy:  req.user?._id });

    if (like) {
        await Like.deleteOne(
            { _id: like._id });

        return res
        .status(200)
         .json(new ApiResponse( 200, "like removed"))
    } else {
        await Like.create(
            { comment: commentId,
              likedBy: req.user?._id 
            });

        return res
        .status(200).
        json(new ApiResponse(200, "Like added"));
    }
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    if (!isValidObjectId(commentId)) {
        throw new ApiError(400,"comment id is not valid")
    }
    const like = await Like.findOne(
        { 
            tweet: tweetId, 
            likedBy: req.user?._id 
        });

    if (like) {
        await Like.deleteOne(
            { _id: like._id });

        return res
        .status(200)
        .json(new ApiResponse(200, "like removed"));
    } else {
        await Like.create(
            { tweet: tweetId,
              likedBy: req.user?._id 
            });

        return res
        .status(200)
        .json(new ApiResponse(200, "Like added"));
    }
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const likedVideos = await Like.aggregate([

        {
             $match: { 
                likedBy: new mongoose.Types.ObjectId(req.user?._id) 
            } 
        },
        { 
            $lookup: {
            from: "videos",
            localField: "video",
            foreignField: "_id",
            as: "videodetails",
            pipeline:[
                {
                    $lookup:{
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as:"ownerDetails",
                    }
                },
                { 
                    $unwind: "$ownerDetails",
                },
            ]
        }
    },
    {
        $unwind: "$videodetails",
    },

    {
        $sort:{
            createdAt:-1,
        }
    },
       
        { $project: {
            _id: 0,
            videodetails:{
                _id:1,
                title:1,
                description: 1,
                owner: 1,
                views:1,
                "thumbnail.url":1,
                "videoFile.url":1,
                isPublished:1,
                createdAt:1,
                duration:1,
                owner:{
                    username:1,
                    fullName:1,
                    "avatar.url":1,
                }



            }
            
        }}
    ]);

   return res
   .status(200)
   .json(
    new ApiResponse(
        200,
        likedVideos,
        "liked videos find success"
    
    ))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}
