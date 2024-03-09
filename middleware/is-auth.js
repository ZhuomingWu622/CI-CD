const CognitoExpress = require('cognito-express');
const User = require('../models/user');
const config = require('../config/production');
const jwt = require('jsonwebtoken');

//Initializing CognitoExpress constructor

const cognitoExpressToC = new CognitoExpress({
  region: config.CognitoRegion,
  cognitoUserPoolId: config.CognitoToCUserPoolId,
  tokenUse: config.CognitoTokenUse, //Possible Values: access | id
  tokenExpiration: config.CognitoTokenExpiration, //Up to default expiration of 1 hour (3600000 ms)
});

function isToCCognitoAuthenticated(req, res, next) {
  const token = req.header('cognito-token');

  // Check if not token
  if (!token) {
    return res.status(401).send('Access Token not found');
  }

  cognitoExpressToC.validate(token, async function (err, response) {
    //If API is not authenticated, Return 401 with error message.
    if (err) return res.status(401).json({ err });

    //Else API has been authenticated. Proceed.
    req.userSub = response.sub;
    let user = await User.findOne({ userId: response.sub });
    req.userId = null;

    if (user) {
      req.userId = user._id;
    }
    next();
  });
}

function isToCCognitoAuthenticatedOptional(req, res, next) {
  const token = req.header('cognito-token');

  if (!token) {
    next();
    return;
  }

  cognitoExpressToC.validate(token, function (err, response) {
    //If API is not authenticated, Return 401 with error message.
    if (err) return res.status(401).json({ err });
    //Else API has been authenticated. Proceed.
    req.userSub = response.sub;
    next();
  });
}

function isToCCognitoAuthenticatedByJWT(req, res, next) {
  // Get token from header
  const token = req.header('cognito-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token: Authenticationn Denied.' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, config.get('jwtSecret'));
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid.' });
  }
}

module.exports = {
  isToCCognitoAuthenticated,
  isToCCognitoAuthenticatedOptional,
  isToCCognitoAuthenticatedByJWT,
};
