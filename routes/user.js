const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user');
const { isToCCognitoAuthenticated } = require('../middleware/is-auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Customer Create Based Cognito
router.post('/new', isToCCognitoAuthenticated, UserController.customerCreate);

// get user profile
router.get(
  '/profile/me',
  isToCCognitoAuthenticated,
  UserController.getCustomerProfile,
);

// update profile
router.post(
  '/profile/me',
  isToCCognitoAuthenticated,
  UserController.updateProfile,
);

// profile photo
router.post(
  '/profile/photo',
  upload.single('imageContent'),
  isToCCognitoAuthenticated,
  UserController.UpdateProfilePhoto,
);

// delete Video from collection
router.delete(
  '/videos/videoCollection/:videoPostId',
  isToCCognitoAuthenticated,
  UserController.deleteVideoFromCollection,
);

// add Video to collection
router.post(
  '/videos/videoCollection/:videoPostId',
  isToCCognitoAuthenticated,
  UserController.addVideoInCollection,
);

module.exports = router;
