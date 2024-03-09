const mongoose = require('mongoose');
const constants = require('../util/constants');
const Schema = mongoose.Schema;

const VideoPostSchema = new Schema(
  {
    postTitle: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    videoUrl: {
      type: String,
      require: true,
    },
    coverImageUrl: {
      type: String,
    },
    restaurantName: {
      type: String,
    },
    restaurantAddress: {
      street: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
        uppercase: true,
        enum: constants.statesArray,
      },
      zipcode: {
        type: Number,
      },
    },
    orderedVia: {
      type: String,
    },
    postTime: {
      type: Date,
      required: true,
    },
    countComment: {
      type: Number,
      default: 0,
    },
    countLike: {
      type: Number,
      default: 0,
    },
    countCollections: {
      type: Number,
      default: 0,
    },
    likes: [
      {
        userSub: {
          type: String,
        },
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    comments: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        text: {
          type: String,
          require: true,
        },
        name: {
          type: String,
        },
        avator: {
          type: String,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    collection: 'videoposts',
  },
);
module.exports = mongoose.model('VideoPost', VideoPostSchema);
