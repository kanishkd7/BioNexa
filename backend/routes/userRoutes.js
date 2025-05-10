const express = require('express');
const router = express.Router();
const User = require('../models/User');
const admin = require('firebase-admin');

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Create or update user profile
router.post('/profile', verifyToken, async (req, res) => {
  try {
    const { uid, email } = req.user;
    const { name, role, specialty } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      user = await User.findOneAndUpdate(
        { email },
        { name, role, specialty, firebaseUID: uid },
        { new: true }
      );
    } else {
      user = await User.create({
        email,
        name,
        role,
        specialty,
        firebaseUID: uid,
        password: 'firebase-auth' // Placeholder as we're using Firebase auth
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const { email } = req.user;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;