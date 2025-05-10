const express = require('express');
const router = express.Router();
const hmsSDK = require('@100mslive/server-sdk');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { body, validationResult } = require('express-validator');

// Try to load Twilio, but don't fail if it's not available
let AccessToken, VideoGrant;
try {
  const twilio = require('twilio');
  AccessToken = twilio.AccessToken;
  VideoGrant = twilio.jwt.AccessToken.VideoGrant;
  console.log('Twilio SDK loaded successfully');
} catch (error) {
  console.warn('Twilio SDK not available. Twilio-based video calls will not work.');
  console.warn('To enable Twilio, run: npm install twilio');
}

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const { roomName, role } = req.body;
  if (!roomName || !role) {
    return res.status(400).json({
      success: false,
      message: 'Room name and role are required'
    });
  }
  if (!['guest', 'host'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be either "guest" or "host"'
    });
  }
  next();
};

// POST route to generate auth token
router.post('/token', async (req, res) => {
  try {
    // Extract parameters from request body
    const { role, userId } = req.body;
    
    console.log('\n=== Token Generation Request (video.js) ===');
    console.log('Request parameters:', { role, userId });

    // Validate required parameters
    if (!role) {
      console.error('Missing required parameters:', { role });
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    // Validate role
    if (!['guest', 'host'].includes(role)) {
      console.error('Invalid role specified:', role);
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "guest" or "host"'
      });
    }

    // Validate environment variables
    if (!process.env.HMS_ACCESS_KEY || !process.env.HMS_SECRET_KEY) {
      console.error('Missing HMS credentials in environment variables');
      console.error('HMS_ACCESS_KEY:', process.env.HMS_ACCESS_KEY ? 'Present' : 'Missing');
      console.error('HMS_SECRET_KEY:', process.env.HMS_SECRET_KEY ? 'Present' : 'Missing');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    console.log('Environment variables check passed');
    console.log('HMS Access Key (first 5 chars):', process.env.HMS_ACCESS_KEY.substring(0, 5));
    console.log('HMS Secret Key (first 5 chars):', process.env.HMS_SECRET_KEY.substring(0, 5));

    // Use the provided userId or generate one
    const finalUserId = userId || `${role}-${Date.now()}`;

    try {
      console.log('\nCreating token for video call...');
      
      // Use the fixed room ID from 100ms dashboard
      const roomId = "67fd35bd36d4cfc1981f1e18";
      const roomName100ms = "bionexa1";
      console.log(`Using fixed room ID: ${roomId}, room name: ${roomName100ms}`);
      
      // Create the auth token payload
      const payload = {
        access_key: process.env.HMS_ACCESS_KEY,
        room_id: roomId,
        user_id: finalUserId,
        role: role,
        type: 'app',
        version: 2,
        jti: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 // Token expires in 24 hours
      };
      
      // Sign the token with the HMS secret key
      const authToken = jwt.sign(
        payload,
        process.env.HMS_SECRET_KEY,
        { algorithm: 'HS256' }
      );
      
      console.log('Token generated successfully');
      console.log('Token (first 20 chars):', authToken.substring(0, 20) + '...');
      console.log('Room ID:', roomId);
      
      return res.json({
        success: true,
        token: authToken,
        roomId: roomId
      });
    } catch (tokenError) {
      console.error('\nToken generation failed:', {
        name: tokenError.name,
        message: tokenError.message,
        stack: tokenError.stack,
        code: tokenError.code,
        status: tokenError.status
      });
      
      // Try to get more details about the error
      if (tokenError.response) {
        console.error('Error response:', tokenError.response.data);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to generate token',
        error: tokenError.message,
        details: {
          name: tokenError.name,
          code: tokenError.code
        }
      });
    }
  } catch (error) {
    console.error('Error in token generation route:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// POST route to create a new room
router.post('/room', validateRequest, async (req, res) => {
  try {
    const { role } = req.body;
    
    // Return the fixed room details from 100ms dashboard
    const roomId = "67fd35bd36d4cfc1981f1e18";
    const roomName = "bionexa1";
    console.log(`Using fixed room: ${roomId}, name: ${roomName}`);
    
    // Return the room ID
    res.json({
      success: true,
      message: 'Room details retrieved successfully',
      roomName,
      roomId
    });
  } catch (error) {
    console.error('Error retrieving room details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve room details',
      error: error.message
    });
  }
});

router.get('/token', async (req, res) => {
  try {
    // Check if Twilio is available
    if (!AccessToken || !VideoGrant) {
      return res.status(501).json({
        success: false,
        message: 'Twilio video service is not available. Use HMS video service instead.',
        hint: 'Install Twilio with: npm install twilio'
      });
    }
    
    const { identity } = req.query;
    
    // Validate input parameters
    if (!identity) {
      return res.status(400).json({ 
        success: false, 
        message: 'Identity is required' 
      });
    }
    
    // Check for required environment variables
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_API_KEY || !process.env.TWILIO_API_SECRET) {
      console.error('Twilio credentials not found in environment variables');
      return res.status(500).json({ 
        success: false, 
        message: 'Video service configuration error' 
      });
    }
    
    // Use the fixed room ID from 100ms dashboard
    const roomId = "67fd35bd36d4cfc1981f1e18";
    const roomName = "bionexa1";
    console.log(`Generating Twilio token for room: ${roomId}, identity: ${identity}`);
    
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: identity }
    );
    
    // Create Video grant and add to token
    const videoGrant = new VideoGrant({ room: roomId });
    token.addGrant(videoGrant);
    
    // Generate token
    const generatedToken = token.toJwt();
    
    return res.json({ 
      success: true,
      token: generatedToken,
      roomId
    });
  } catch (error) {
    console.error('Error generating video token:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to generate token', 
      error: error.message 
    });
  }
});

module.exports = router; 