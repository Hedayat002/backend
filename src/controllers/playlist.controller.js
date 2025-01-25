import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import ApiError from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {Video} from "../models/video.model.js"

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  //TODO: create playlist
  if (!name || !description) {
    throw new ApiError(400, "Name and description are required");
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  });

  if(!playlist){
    throw new ApiError(404, "Playlist not created tryagain");
  }
  return res
  .status(200)
  .json(new ApiResponse(200, playlist,"playlis created successfully"))
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //TODO: get user playlists
  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }
 const userPlaylists = await Playlist.aggregate([
  {
    $match: {
      owner: new mongoose.Types.ObjectId(userId)
    }
  },{
    $lookup: {
      from: "videos",
      localField: "videos",
      foreignField: "_id",
      as: "videos",
    }
  },{
    $addFields:{
      totalVideoView:{
        $sum:"$videos.views"
      },
      totalVideo:{
        $size:"$videos"
      }
    }
  },
  {
    $project: {
        _id: 1,
        name: 1,
        description: 1,
        totalVideos: 1,
        totalViews: 1,
        updatedAt: 1
    }
}
 ])
 if (!userPlaylists){
  throw new ApiError(404, "No playlists found");
 }
 return res
 .status(200)
 .json(
  new ApiResponse(200, userPlaylists,"playlists found successfully")
 )
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  //TODO: get playlist by id
  
  if (!isValidObjectId(playlistId)){
    throw new ApiError(400, "Invalid playlist ID");

  }

  const playlists = await Playlist.aggregate([
    {
        $match: {
            owner:new mongoose.Types.ObjectId( playlistId)
        }
    },
    {
        $lookup:{
          from: "videos",
          localField: "videos",
          foreignField: "_id",
          as: "videos",
        }  
      },
    {
        $lookup:{
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",

        }
    },{
        $addFields:{
            videoCount:{
                $size:"$videos"
            },
            totalVideoView:{
                $sum:"$videos.views"
            },
            owner:{
                $first:"$owner"

            }
        }
    },{
        $project:{
            name:1,
            totalVideoView:1,
            videoCount:1,
            createdAt: 1,
            updatedAt: 1,
            videos:{
                _id: 1,
                "videoFile.url": 1,
                "thumbnail.url": 1,
                title: 1,
                description: 1,
                duration: 1,
                createdAt: 1,
                views: 1
            },
            owner:{
                username: 1,
                fullName: 1,
                "avatar.url": 1
            }
        }
    }
  ])

  if(!playlists){
    throw new ApiError(404,"data not found")
  }

  return res
  .status(200)
  .json(200,playlists,"get playlist fetched successfully")
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if(!isValidObjectId(videoId)){
    throw new ApiError(400, "invalid video id")
  }

  const playlist = await Playlist.findById(playlistId)
  if(!playlist){
    throw new ApiError(404,"playlist not found")
  }
  const video = await Video.findById(videoId)
  if(!video){
    throw new ApiError(404,"video not found")
  }

  if (
    (playlist.owner?.toString() && video.owner.toString()) !==
    req.user?._id.toString()
) {
    throw new ApiError(400, "only owner can add video to thier playlist");
}
const updatedPlaylist = await Playlist.findByIdAndUpdate( playlist?._id,
  {
    $addToSet: {
      videos: videoId 
    }
  },{
    new: true
  }
)
if(!updatedPlaylist){
  throw new ApiError(404,"playlist not updated")
}
return res
.status(200)
.json(new ApiResponse(200, updatedPlaylist,"updated playlists successfully"))

});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  // TODO: remove video from playlist
  if(!isValidObjectId(videoId)){
    throw new ApiError(400, "video id not valid")
  }
  const playlist = await Playlist.findById(playlistId)
  if(!playlist){
    throw new ApiError(404,"playlist not found")
  }
  const video = await Video.findById(videoId)
  if(!video){
    throw new ApiError(404,"video not found")
  }

  if (
    (playlist.owner?.toString() && video.owner.toString()) !==
    req.user?._id.toString()
) {
    throw new ApiError(400, "only owner can remove video to thier playlist");
}

const removePlaylist = await Playlist.findByIdAndUpdate(
  playlistId,
  {
    $pull: {
      videos: videoId
    }
  },
  {
    new: true
  }
);

if (!removePlaylist) {
  throw new ApiError(404, "Playlist not updated");
}

return res
  .status(200)
  .json(new ApiResponse(200, removePlaylist, "Removed video from playlist successfully"));
  
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  // TODO: delete playlist

  if(!isValidObjectId(playlistId)){
    throw new ApiError(400, "invalid playlist id")
  }
  const playlist = await Playlist.findById(playlistId);
  if(!playlist){
    throw new ApiError(404, "playlist not found")
  }
  if (playlist.owner.toString() !== req.user._id?.toString()) {
    throw new ApiError(403, "You can't delete this playlis as you are not the owner");
}

await Playlist.findByIdAndDelete(playlist?._id)

return res
.status(200)
.json(new ApiResponse(200,{},"delete successfull"))
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  //TODO: update playlist

  if(!name || !description){
    throw new ApiError(400, "name and description are required")
  }

  if(!isValidObjectId(playlistId)){
    throw new ApiError(400, "invalid playlist id")
  }
  const playlist = await Playlist.findById(playlistId)
  if(!playlist){
    throw new ApiError(404, "playlist not found")
  }
  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You can't update this playlist as you are not the owner");
}

const updatePlaylist =  await Playlist.findByIdAndUpdate(playlistId,
  {
  $set:{
    name,
    description
  }
},{
  new:true
})
if(!updatePlaylist){
  throw new ApiError(404, "playlist not update")
}
return res
.status(200)
.json(new ApiResponse(
  200,updatePlaylist,"update playlist successfully"
))
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
