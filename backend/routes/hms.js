const express = require('express');
const router = express.Router();
const hmsSDK = require('@100mslive/server-sdk');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const JWT = require('jsonwebtoken');

// Test route to check if the router is loaded
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'HMS router is working' });
});

// GET endpoint for token generation (for frontend compatibility)
router.get('/get-hms-token', async (req, res) => {
  try {
    const { roomName, role } = req.query;
    
    console.log('\n=== Token Generation Request (GET) ===');
    console.log('Request parameters:', { roomName, role });
    
    // Validate input parameters
    if (!role || !['host', 'guest'].includes(role)) {
      console.error('Invalid role specified:', role);
      return res.status(400).json({ 
        success: false, 
        message: 'Valid role (host or guest) is required' 
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
    
    // Use the fixed room ID from 100ms dashboard instead of generating one
    const roomId = "67fd35bd36d4cfc1981f1e18";
    const roomName100ms = "bionexa1";
    console.log(`Using fixed room ID: ${roomId}, room name: ${roomName100ms}`);
    
    const userId = `${role}-${Date.now()}`;
    
    // Create the auth token payload
    const payload = {
      access_key: process.env.HMS_ACCESS_KEY,
      room_id: roomId,
      user_id: userId,
      role: role,
      type: 'app',
      version: 2,
      jti: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      iat: Math.floor(Date.now() / 1000),
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 // Token expires in 24 hours
    };
    
    // Sign the token with the HMS secret key
    const token = jwt.sign(
      payload,
      process.env.HMS_SECRET_KEY,
      { algorithm: 'HS256' }
    );
    
    console.log('Token generated successfully');
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
    console.log('Room ID:', roomId);
    
    return res.json({ 
      success: true, 
      token,
      roomId 
    });
  } catch (error) {
    console.error('Error generating HMS token:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to generate token', 
      error: error.message 
    });
  }
});

// POST endpoint for token generation (original endpoint)
router.post('/token', async (req, res) => {
  try {
    const { roomName, role } = req.body;

    console.log('\n=== Token Generation Request (POST) ===');
    console.log('Request parameters:', { roomName, role });

    // Validate input parameters
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

    try {
      // Use the fixed room ID from 100ms dashboard instead of generating one
      const roomId = "67fd35bd36d4cfc1981f1e18";
      const roomName100ms = "bionexa1";
      console.log(`Using fixed room ID: ${roomId}, room name: ${roomName100ms}`);
      
      // Use the room ID from the request
      const userId = `${role}-${Date.now()}`;

      // Define permissions based on role
      const isHost = role === 'host';
      
      console.log('\nGenerating auth token for room...');
      
      // Create the auth token payload
      const payload = {
        access_key: process.env.HMS_ACCESS_KEY,
        room_id: roomId,
        user_id: userId,
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
        roomId
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

module.exports = router; 