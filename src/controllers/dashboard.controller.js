import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import ApiError from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    
    const videos = await Video.aggregate([
        {
            $match: {
                owner:new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },{
            $project:{
                totalLikes:{
                    $size:"$likes"
                },
                totalViews:"$views",
                totalVideos:1
            }
        },{
            $group:{
                _id:null,
                totalLikes:{
                    $sum:"$totalLikes"
                },
                totalViews:{
                    $sum:"$totalViews"
                },
                totalVideos:{
                    $sum:1
                }
            }
        }
    ])

    const totalSubscribers = await Subscription.aggregate([
        {
            $match: {
                owner:new mongoose.Types.ObjectId(req.user?._id)
            }
        },{
            $group: {
                _id: null,
                totalSubscribers: {
                    $sum: 1
                }
            }
        }
    ])

    const channelStats=
    {
        totalViews: videos[0]?.totalViews || 0,
        totalSubscribers: totalSubscribers[0]?.totalSubscribers || 0,
        totalVideos: videos[0]?.totalVideos || 0,
        totalLikes: videos[0]?.totalLikes || 0
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channelStats, "Channel stats fetched successfully")
    )
    
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const videos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(req.user?._id)
            }
        },{
            $lookup:{
                from: "likest",
                localField: "_id",
                foreignField: "viseo",
                as: "likes"
            }
        },
        {
            $addFields:{
                totalLikes:{$size:"$likes"},
                createAt:{
                    $dateToString:{
                        date:"$createAt"
                    }
                }
            }
        },
        {
            $sort:{
                createAt: -1
            }
        },
        {
         $project:{
            _id:1,
            "videoFile.url": 1,
            "thumbnail.url": 1,
            title: 1,
            description: 1,
            duration: 1,
            views: 1,
            isPublished: 1,
            owner: 1,
            totalLikes: 1,
            createAt: {
                year:1,
                month:1,
                day:1
            }
         }
        }
    ])
    return res
    .status(200)
    .json(
        new ApiResponse(200, videos, "Channel videos fetched successfully")
    )
    
})

export {
    getChannelStats, 
    getChannelVideos
    }
