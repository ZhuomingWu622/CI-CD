const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  userId: {
    type: String,
    // required: true,
  },
  email: {
    type: String,
    // required: true,
  },
  userName: {
    type: String,
    unique: true,
  },
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  profilePhoto: {
    type: String,
  },
  videos: [
    {
      videoPost: {
        type: Schema.Types.ObjectId,
        ref: 'VideoPost',
      },
    },
  ],
  collections: [
    {
      videoPost: {
        type: String, // need type string to compare with params.videoPostId
        ref: 'VideoPost',
      },
    },
  ],
  likedVideos: [
    {
      videoPost: {
        type: String, // need type string to compare with params.videoPostId
        ref: 'VideoPost',
      },
    },
  ],
});

module.exports = mongoose.model('User', userSchema);
