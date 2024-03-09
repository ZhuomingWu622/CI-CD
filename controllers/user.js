const User = require('../models/user');
const VideoPost = require('../models/videopost');
const AWS_S3 = require('../util/aws-s3');
const { getFileBaseName } = require('../util/path');
const config = require('../config/production');
const { adminToCDeleteUser } = require('../util/aws-cognito');

const s3 = AWS_S3.setS3Credentials;

/**
 * @api {post} /api/v1/user/create CustomerCreate
 * @apiName CustomerCreate
 * @apiGroup User
 * @apiDescription Create New Customer
 *
 * @apiparam (Header) {string} cognito-token        User Unique Identifier from Cognito
 * @apiparam (body) {string} email                  User Email
 *
 * @apiSuccess (Success Returned JSON) {String}  User is created successfully
 * @apiError return corresponding errors
 */
exports.customerCreate = async (req, res) => {
  // Parameter guard
  const numOfParams = Object.keys(req.body).length;
  if (numOfParams > 1) {
    return res
      .status(400)
      .json({ errors: [{ msg: 'Bad Request, too many parameters.' }] });
  }

  const userSub = req.userSub;
  try {
    // if user already exist
    let user = await User.findById(req.userId);

    if (user) {
      return res.status(400).json({
        errors: [{ msg: 'The user already registed, Please sign in.' }],
      });
    }

    const email = req.body.email;
    const emailPrefix = email.substring(0, email.lastIndexOf('@'));

    // same email signed up, but
    // 1. sign up by email, password
    // 2. sign up by google, but google is email

    // Check if the email is already used as a existing default user name
    const isUserNameDuplicated = await User.findOne({ userName: emailPrefix });
    const defaultUserName = isUserNameDuplicated
      ? emailPrefix + userSub
      : emailPrefix;

    // Create a new user to save
    user = new User({
      userId: userSub,
      userName: defaultUserName,
      email,
      createdTime: new Date().toISOString(),
    });

    // Save to the database
    await user.save();
    return res.status(200).json({
      message: 'User account created successfully.',
      user,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error', err: err.message });
  }
};

/**
 * @api {get} /api/v1/user/profile/me GetUserProfile
 * @apiName GetUserProfile
 * @apiGroup User
 * @apiDescription Toc Use | get user's profile
 * @apiSucces {Object} profile user's profile
 * @apiError return corresponding errors
 */
exports.getCustomerProfile = async (req, res) => {
  // 1. check user if exist
  let user = await User.findById(req.userId);
  if (!user) {
    return res
      .status(400)
      .json({ errors: [{ msg: 'Can not find the user.' }] });
  }
  try {
    // 1. basic info: userName, etc
    // 2. videos: populate
    // 2.1 upload videos
    // 2.2 collected videos
    // 2.3 liked videos
    user.populate('videos.videoPost');
    //pupulate video collections
    await User.populate(user, { path: 'collections.videoPost' });
    await User.populate(user, {
      path: 'collections.videoPost.userId',
      select: ['_id', 'userId', 'userName', 'profilePhoto'],
    });
    await User.populate(user, { path: 'collections.videoPost.comments.user' });

    //populate user's liked video
    await User.populate(user, { path: 'likedVideos.videoPost' });
    await User.populate(user, {
      path: 'likedVideos.videoPost.userId',
      select: ['_id', 'userId', 'userName', 'profilePhoto'],
    });
    await User.populate(user, { path: 'likedVideos.videoPost.comments.user' });

    return res.status(200).send(user);
  } catch (err) {
    res
      .status(500)
      .send({ msg: 'Failed to retrive user profile.', err: err.message });
  }
};

/**
 * @api {post} /api/v1/user/profile/me Update User Profile
 * @apiName Update User Profile
 * @apiGroup User
 * @apiDescription Change Customer;s profile based on user input
 *
 * @apiParam (Body) {String} userName     the new user name to change
 * @apiParam (Body) {String} firstName    new First Name
 * @apiParam (Body) {String} lastName     new Last Name
 *
 * @apiError return corresponding errors
 *
 */
exports.updateProfile = async (req, res) => {
  // Parameter guard
  const numOfParams = Object.keys(req.body).length;
  if (numOfParams > 3) {
    return res.status(400).json({
      errors: [
        { msg: 'Bad Request, too many parameters. Please only 3 params' },
      ],
    });
  }

  const newUserName = req.body.userName;
  const newFirstName = req.body.firstName;
  const newLastName = req.body.lastName;

  //check uniquness
  let user = await User.findOne({ userName: newUserName });
  // If not unique
  if (user !== null && user.userId !== req.userSub) {
    // Make sure it is not the user's own username
    return res.status(400).json({
      error: [{ msg: 'User name already exists, Please try an another name.' }],
    });
  }

  try {
    user = await User.findById(req.userId);

    //Otherwise, update user's profile
    user.userName = newUserName;
    user.firstName = newFirstName;
    user.lastName = newLastName;

    await user.save();
    return res.status(200).json({
      message: 'User profile is updated',
      user,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update profile', err: err.message });
  }
};

/**
 * @api {post} /api/v1/user/profile/photo UpdataUserProfilePhoto
 * @apiName UpdateUserProfilePhoto
 * @apiGroup User
 * @apiDescription Toc use | update a customer's profile photo
 *
 * @apiBody {File} binary image    the customer's profile photo
 *
 * @apiSuccess return photo url that is stored on AWS
 * @apiError Sever Error 500 with error message
 */
exports.UpdateProfilePhoto = async (req, res) => {
  const imageParams = AWS_S3.s3ProfilePhotoParams(req);
  // multer
  // aws s3
  try {
    // Check if the user exists
    const user = await User.findById(req.userId);

    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Can not find the user.' }] });
    }

    // Upload the new profile photo
    const ImageStored = await s3
      .upload(imageParams, (err) => {
        // Check error
        if (err) {
          return res.status(500).json({
            errors: [
              {
                msg: 'Error occured while trying to upload image to S3 bucket',
                err,
              },
            ],
          });
        }
      })
      .promise();

    // if the photo already exist, delete the previous one
    if (user.profilePhoto) {
      // Delete the current profile photo
      var deleteParams = {
        Bucket: config.S3ProfilePhotoBucketName,
        Key: getFileBaseName(user.profilePhoto),
      };
      s3.deleteObject(deleteParams, function (err) {
        // Check error
        if (err) {
          return res.status(500).json({
            errors: [
              {
                msg: 'Error occured while trying to delete the old profile photo from S3',
                err,
              },
            ],
          });
        }
      });
    }

    const imageFileName = getFileBaseName(ImageStored.Location);
    const imageUrl = AWS_S3.profilePhotoUrlGenerator(imageFileName);
    // Update the database
    user.profilePhoto = imageUrl;
    await user.save();

    return res.status(200).json({
      message: 'User profile photo is updated',
      user,
    });
  } catch (err) {
    res
      .status(500)
      .json({ msg: 'Failed to update profile photo', err: err.message });
  }
};

/**
 * @api {delete} /api/v1/user/delete CustomerDelete
 * @apiName CustomerDelete
 * @apiGroup User
 * @apiDescription Delete New Customer
 *
 * @apiParam (Body) {String} email            the email of an delete account
 *
 * @apiSuccess (Success Returned JSON) {String}  User is created successfully
 * @apiError return corresponding errors
 */
exports.CustomerDelete = async (req, res) => {
  // database user instance/record
  // userPhoto - url - aws s3 image
  // videoPostId --> video -> aws s3 video
  // aws congito - user delete
  const email = req.body.email;

  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'The user is not found.' }] });
    }

    // Delete user Photo
    if (user.profilePhoto) {
      var deleteParams = {
        Bucket: config.S3ProfilePhotoBucketName,
        Key: getFileBaseName(user.profilePhoto),
      };
      s3.deleteObject(deleteParams, (err) => {
        if (err) {
          return res.status(500).json({
            errors: [
              {
                msg: 'Error occured while trying to delete the old profile photo from S3',
                err,
              },
            ],
          });
        }
      });
    }

    //TODO: Delete Video when we finish video APIs
    await User.populate(user, {
      path: 'videos',
      populate: { path: 'videoPost', model: 'VideoPost' },
    });

    for (let v of user.videos) {
      let videoPost = v.videoPost;

      let err = AWS_S3.deleteVideoInS3(videoPost.url);

      if (err) {
        return res.status(500).json({
          errors: [
            {
              msg: 'Error occured while trying to delete the video file from S3',
              err,
            },
          ],
        });
      }

      err = AWS_S3.deleteVideoInS3CoverImage(videoPost.coverImageUrl);
      if (err) {
        return res.status(500).json({
          errors: [
            {
              msg: 'Error occured while trying to delete the cover Image from S3',
              err,
            },
          ],
        });
      }
    }

    // Delete videoPost records from DB
    await VideoPost.deleteMany({ userId: userObjectId });
    // Delete user from mongoDB
    const userObjectId = user._id;
    await User.deleteOne({ _id: userObjectId });

    // Delete account from AWS congito
    await adminToCDeleteUser(email);

    return res.status(200).json({
      message: 'User account delete successfully.',
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error', err: err.message });
  }
};

/**
 * @api {post} /api/v1/user/videos/videoCollection/:videoPostId
 * @apiName add video into collections
 * @apiGroup User
 * @apiDescription add video into collections
 *
 * @apiParam (params) {String} videoPostId
 *
 * @apiError return corresponding errors
 */
exports.addVideoInCollection = async (req, res) => {
  // find the user
  // find videopost
  // try to add videopostId to the user's collection
  let user = await User.findById(req.userId);
  if (!user) {
    return res
      .status(400)
      .json({ errors: [{ msg: 'Can not find the user.' }] });
  }

  try {
    const videoPostId = req.params.videoPostId;

    // find the videoPost
    let post = await VideoPost.findById(videoPostId);
    if (!post) {
      return res.status(400).json({ errors: [{ msg: 'No video post.' }] });
    }

    // modify the user's collection: add videopost into user collection array
    // Check if the post is alrealy collected by the user
    // If the collections array contains the the id of current video id, don‘t allow collect again
    if (
      user.collections.filter(
        (collection) => collection.videoPost === videoPostId,
      ).length > 0
    ) {
      return res.status(400).json({ msg: 'Already collect this video' });
    }

    user.collections.push({ videoPost: videoPostId });

    // update videopost countCollection
    post.countCollections += 1;

    await post.save();
    await user.save();

    await User.populate(user, { path: 'collections.videoPost' });
    const collections = user.collections;

    return res.status(200).json({
      message: 'User add video in collection successfully',
      collections,
      post,
    });
  } catch (err) {
    res
      .status(500)
      .json({ msg: 'Failed to add video into collections', err: err.message });
  }
};

// /**
//  * @api {post} /api/v1/user/signup CustomerSignUp
//  * @apiName CustomerSignUp
//  * @apiGroup User
//  * @apiDescription Customer Sign Up
//  *
//  * @apiParam (Body) {String} email            the email of an account
//  * @apiParam (Body) {String} password         the password of an account
//  *
//  * @apiSuccess  (Success Returned JSON) {String}  token   a JWT token
//  * @apiError return corresponding errors
//  */
//  exports.customerSignUp = async (req, res) => {
//   req.checkBody('email').exists().withMessage('Email is required');
//   req.checkBody('password').exists().withMessage('Password is required');
//   req.checkBody('confirmPassword').exists().withMessage('Password is required');
//   req.checkBody('email').isEmail().withMessage('Please include a valid email');
//   req
//     .checkBody('password')
//     .withMessage('Password needs to be at least 8 characters')
//     .isLength({
//       min: 8,
//       max: undefined,
//     });
//   req
//     .checkBody('confirmPassword')
//     .withMessage('Password confirmation does not match password')
//     .custom((value, { req }) => value == req.body.password);

//   // Pre-check
//   const errors = req.validationErrors();
//   if (errors || errors.length > 0) {
//     return res.status(400).json({ errors: errors });
//   }

//   // Parameter guard
//   const numOfParams = Object.keys(req.body).length;
//   if (numOfParams > 3) {
//     return res
//       .status(400)
//       .json({ errors: [{ msg: 'Bad Request, too many parameters.' }] });
//   }

//   const { email, password } = req.body;

//   try {
//     // Check if the users already exist
//     let user = await User.findOne({ email });

//     if (user) {
//       return res.status(400).json({
//         errors: [{ msg: 'Email already registered, Please sign in.' }],
//       });
//     }

//     // Create a new user to save
//     user = new User({
//       email,
//       password,
//     });

//     // Encrypt password
//     const salt = await bcrypt.genSalt(10);
//     user.password = await bcrypt.hash(password, salt);

//     // Save to the database
//     await user.save();

//     // Prepare payload for jwt token
//     const payload = {
//       user: {
//         id: user.id,
//       },
//     };

//     // Sign and return jwt token
//     jwt.sign(
//       payload,
//       config.jwtSecret,
//       { expiresIn: config.jwtExpireTime },
//       (err, token) => {
//         if (err) throw err;
//         res.status(200).json({
//           message: 'User account created successfully.',
//           token,
//         });
//       }
//     );
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// exports.customerSignIn = async (req, res) => {
//   // req.checkBody('email').exists().withMessage('Email is required');
//   // req.checkBody('password').exists().withMessage('Password is required');
//   // req.checkBody('email').isEmail().withMessage('Please include a valid email');

//   // // Pre-check
//   // const errors = req.validationErrors();
//   // if (errors || errors.length > 0) {
//   //   return res.status(400).json({ errors: errors });
//   // }

//   // Parameter guard
//   const numOfParams = Object.keys(req.body).length;
//   if (numOfParams > 2) {
//     return res
//       .status(400)
//       .json({ errors: [{ msg: 'Bad Request, too many parameters.' }] });
//   }

//   const { email, password } = req.body;

//   try {
//     // Check if the users already exist
//     let user = await User.findOne({ email });

//     if (!user) {
//       return res
//         .status(400)
//         .json({ errors: [{ msg: 'No user registered by this email.' }] });
//     }

//     // if user exists, compare if the req password is same with user encrypted password
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res
//         .status(400)
//         .json({ errors: [{ msg: 'Invalid Credentials.' }] });
//     }

//     // Prepare payload for jwt token
//     const payload = {
//       user: {
//         id: user.id,
//       },
//     };

//     // Sign and return jwt token
//     jwt.sign(
//       payload,
//       config.jwtSecret,
//       { expiresIn: config.jwtExpireTime },
//       (err, token) => {
//         if (err) throw err;
//         res.status(200).json({
//           message: 'User sign in successfully.',
//           token,
//         });
//       }
//     );
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

/**
 * @api {delete} /api/v1/user/videos/videoCollection/:videoPostId
 * @apiName delete videoPost from user's collection
 * @apiGroup User
 * @apiDescription delete video from collections
 *
 * @apiParam (params) {String} videoPostId
 *
 * @apiError return corresponding errors
 */
exports.deleteVideoFromCollection = async (req, res) => {
  try {
    // Check if the user exists
    let user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Can not find the user.' }] });
    }

    const videoPostId = req.params.videoPostId;
    let post = await VideoPost.findById(videoPostId);
    if (!post) {
      res.status(400).json({ errors: [{ msg: 'No video post.' }] });
    }

    if (
      user.collections.filter(
        (collection) => collection.videoPost === videoPostId,
      ).length == 0
    ) {
      return res.status(400).json({ msg: 'No video in collections' });
    }
    user.collections = user.collections.filter(
      (collection) => collection.videoPost !== videoPostId,
    );

    if (!post.countCollections || post.countCollections <= 0) {
      return res.status(400).json({ msg: 'No video in collections' });
    }
    post.countCollections -= 1; // update countCollection in videoPost

    await post.save();
    await user.save();

    await User.populate(user, { path: 'collections.videoPost' });
    const collections = user.collections;

    return res.status(200).json({
      message: 'User remove video from collections successfully',
      collections,
      post,
    });
  } catch (err) {
    res.status(500).json({
      msg: 'Failed to delete video from collections',
      err: err.message,
    });
  }
};
