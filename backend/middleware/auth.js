const admin = require('firebase-admin');

const verifyToken = async (req, res, next) => {
  try {
    console.log('Verifying token...');
    console.log('Request headers:', req.headers);
    
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    console.log('Token found, verifying with Firebase...');
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log('Token verified successfully:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      iss: decodedToken.iss,
      aud: decodedToken.aud,
      auth_time: decodedToken.auth_time,
      exp: decodedToken.exp
    });
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

module.exports = {
  verifyToken
}; 