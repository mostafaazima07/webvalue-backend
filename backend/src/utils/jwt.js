import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const generateTokens = (user) => {
  // Remove sensitive information from user object
  const userForToken = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  // Generate access token
  const accessToken = jwt.sign(
    userForToken,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    userForToken,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );

  return {
    accessToken,
    refreshToken
  };
};

const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      valid: true,
      expired: false,
      decoded
    };
  } catch (error) {
    return {
      valid: false,
      expired: error.name === 'TokenExpiredError',
      decoded: null
    };
  }
};

const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    return {
      valid: true,
      expired: false,
      decoded
    };
  } catch (error) {
    return {
      valid: false,
      expired: error.name === 'TokenExpiredError',
      decoded: null
    };
  }
};

const validateEmailDomain = (email) => {
  const domain = email.split('@')[1];
  return domain === process.env.ALLOWED_EMAIL_DOMAIN;
};

export {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  validateEmailDomain
};
