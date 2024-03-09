const AWS = require('aws-sdk');
const config = require('../config/production');

const adminToCDeleteUser = async (username) => {
  try {
    const cognito = new AWS.CognitoIdentityServiceProvider();
    await cognito
      .adminDeleteUser({
        Username: username,
        UserPoolId: config.CognitoToCUserPoolId,
      })
      .promise();

    return {
      isDeleted: true,
    };
  } catch (err) {
    return {
      isDeleted: false,
      err: err,
    };
  }
};

module.exports = {
  adminToCDeleteUser,
};
