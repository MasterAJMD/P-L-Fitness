const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Check for token in Authorization header first, then fall back to cookies
  let token = req.header('Authorization')?.replace('Bearer ', '');

  // If no token in header, check cookies
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      message: 'No Token, Access Denied'
    });
  }

  try {
    const decode = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decode;
    next();
  } catch (error) {
    res.status(401).json({
      message: 'Invalid Token'
    });
  }
};
