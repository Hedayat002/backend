import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { User } from "../models/user.model.js"
import ApiError from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { content } = req.body;

    if (!content) {
        throw new ApiError(400, "Content is required");
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user?._id,

    })

    if(!tweet){
        throw new ApiError(404, "Tweet not crated please atryagain");
    }

    return res
    .status(200)
    .json(new 
        ApiResponse(200,tweet, "Tweet created successfully")
    )

})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params;
   
    if(!isValidObjectId(userId )){
        throw new ApiError(400, "Invalid tweet id");
    }

    const tweet = await Tweet.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(userId )
            }
        },
        {
            $lookup: {
                from:"users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline:[
                    {
                        $project:{
                            username:1,
                            "avatar.url":1
                        }
                    }
                ]

            }
        },
        {
            $lookup:{
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likeDetails",
                pipeline: [
                    {
                      $project:{
                        likedBy:1,
                      }  
                    }
                ]
            }
        },
        {
            $addFields:{
                likesCount:{$size: "$likeDetails"},
                ownerDetail:{$size:"$ownerDetails"},
                islikedBy:{
                    $cond:{
                        if:{$in:[req.user?._id,"$likeDetails.likedBy"]},
                        then:true,
                        else:false

                    }
                }

            }
        },
        
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project:{
                content: 1,
                createdAt: 1,
                likesCount: 1,
                islikedBy: 1,
                ownerDetail:1
            }

        }
    ])

    if(!tweet){
        throw new ApiError(404,"Tweet not found ")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,tweet,"get Tweet successfully")
    )



})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { content } = req.body;
    const {tweetId} = req.params;
    
    if(!content){
        throw new ApiError(400, "Content is missing");
    }
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweet id");
    }
   const tweet = await Tweet.findById(tweetId);
   if(!tweet){
    throw new ApiError(404, "Tweet not found");
   }

   if (tweet?.owner.toString() !== req.user?._id.toString()) {
    // ?.owner - Optional chaining to safely access owner
    // toString() - Convert MongoDB ObjectId to string
    // req.user?._id - Current logged-in user's ID
    throw new ApiError(
        400,
        "You can't update this tweet as you are not the owner"
    );
  }

  // Update the tweet with the new tweet
  const updatedTweet = await Tweet.findByIdAndUpdate(tweetId,
    {
  $set:{
    content,

  }
  },
  {
    new: true,
  }
)

if(!updatedTweet){
    throw new ApiError(500,updatedTweet, "Tweet not updated");
}

return res 
.status(200)
.json(
    new ApiResponse(200, updatedTweet,"updated tweet")
)

})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet id");
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You can't delete this tweet as you are not the owner");
    }

    await Tweet.findByIdAndDelete(tweetId);

    return res
        .status(200)
        .json(
            new ApiResponse(200, null, "Tweet deleted successfully"));
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
