const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const { verifyToken } = require('../middleware/auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Generate unique doctor ID
const generateDoctorId = () => {
  return 'DR' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Function to send email using Brevo API
const sendBrevoEmail = async (to, subject, htmlContent) => {
  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: process.env.BREVO_SENDER_NAME,
          email: process.env.BREVO_SENDER_EMAIL
        },
        to: [{ email: to }],
        subject,
        htmlContent
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    throw error;
  }
};

// Configure multer for photo upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/profile-photos';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Get current doctor's profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ uid: req.user.uid });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: doctor._id,
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        expertise: doctor.expertise,
        experience: doctor.experience,
        education: doctor.education,
        rating: doctor.rating,
        description: doctor.description,
        patients: doctor.patients,
        uid: doctor.uid,
        isVerified: doctor.isVerified,
        profilePhotoUrl: doctor.profilePhotoUrl,
        mobileNumber: doctor.contact?.phone || '',
        contact: doctor.contact
      }
    });
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// Get doctor's availability
router.get('/availability', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    console.log('Fetching availability for UID:', req.user.uid);
    console.log('Date range:', { startDate, endDate });
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const doctor = await Doctor.findOne({ uid: req.user.uid });
    console.log('Found doctor by UID:', doctor ? 'Yes' : 'No');
    
    if (!doctor) {
      console.log('No doctor found with UID:', req.user.uid);
      // Try to find by email as fallback
      const doctorByEmail = await Doctor.findOne({ email: req.user.email });
      console.log('Found doctor by email:', doctorByEmail ? 'Yes' : 'No');
      
      if (doctorByEmail) {
        console.log('Updating doctor UID to match Firebase');
        doctorByEmail.uid = req.user.uid;
        await doctorByEmail.save();
        
        // Filter availability for the requested date range
        const filteredAvailability = doctorByEmail.availability?.filter(slot => {
          const slotDate = new Date(slot.date);
          const start = new Date(startDate);
          const end = new Date(endDate);
          return slotDate >= start && slotDate <= end;
        }) || [];
        
        return res.json({
          success: true,
          data: filteredAvailability
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Filter availability for the requested date range
    const filteredAvailability = doctor.availability?.filter(slot => {
      const slotDate = new Date(slot.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return slotDate >= start && slotDate <= end;
    }) || [];
    
    console.log('Returning availability:', filteredAvailability.length, 'slots');

    res.json({
      success: true,
      data: filteredAvailability
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Doctor diagnostic routes
// Simple diagnostic route
router.get('/find/:email', async (req, res) => {
  try {
    const { email } = req.params;
    console.log('Looking for doctor with email:', email);
    
    const doctor = await Doctor.findOne({ email });
    console.log('Found doctor:', doctor ? 'Yes' : 'No');
    
    if (doctor) {
      console.log('Doctor details:', {
        _id: doctor._id,
        email: doctor.email,
        name: doctor.name,
        uid: doctor.uid,
        isVerified: doctor.isVerified
      });
    }
    
    res.json({
      success: true,
      found: !!doctor,
      doctor: doctor ? {
        _id: doctor._id,
        email: doctor.email,
        name: doctor.name,
        uid: doctor.uid,
        isVerified: doctor.isVerified
      } : null
    });
  } catch (error) {
    console.error('Error finding doctor:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Temporary diagnostic route
router.get('/diagnose/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('Diagnostic check for UID:', uid);
    
    // Try to find doctor by UID
    const doctorByUid = await Doctor.findOne({ uid });
    console.log('Found by UID:', doctorByUid ? 'Yes' : 'No');
    
    // Try to find doctor by email
    const doctorByEmail = await Doctor.findOne({ email: 'xefac33520@exclussi.com' });
    console.log('Found by email:', doctorByEmail ? 'Yes' : 'No');
    
    // List all doctors in the database
    const allDoctors = await Doctor.find({}, 'email uid _id name isVerified');
    console.log('All doctors in database:', allDoctors);
    
    res.json({
      success: true,
      doctorByUid: doctorByUid ? {
        _id: doctorByUid._id,
        email: doctorByUid.email,
        name: doctorByUid.name,
        isVerified: doctorByUid.isVerified
      } : null,
      doctorByEmail: doctorByEmail ? {
        _id: doctorByEmail._id,
        email: doctorByEmail.email,
        name: doctorByEmail.name,
        isVerified: doctorByEmail.isVerified
      } : null,
      allDoctors
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Register new doctor
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      specialization,
      expertise,
      experience,
      education,
      patients,
      description,
      uid
    } = req.body;

    console.log('Doctor registration request received:', {
      email,
      uid,
      name,
      specialization
    });

    // Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      console.log('Doctor with this email already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'Doctor with this email already exists'
      });
    }

    // Create new doctor document
    const doctor = new Doctor({
      _id: generateDoctorId(),
      id: generateDoctorId(),
      name,
      email,
      password,
      specialization,
      expertise,
      experience,
      education,
      patients,
      description,
      uid,
      availableDates: [],
      availableSlots: []
    });

    console.log('Saving new doctor document with UID:', uid);
    await doctor.save();
    console.log('Doctor document saved successfully');

    // Send verification email using Brevo
    try {
      const htmlContent = `
        <h1>Welcome to BioNexa Healthcare!</h1>
        <p>Dear ${name},</p>
        <p>Thank you for registering as a doctor with BioNexa Healthcare. Your account has been created successfully.</p>
        <p>Your unique ID is: ${doctor._id}</p>
        <p>You can now log in to your account and start managing your appointments.</p>
        <p>Best regards,<br>BioNexa Healthcare Team</p>
      `;

      await sendBrevoEmail(email, 'Welcome to BioNexa Healthcare', htmlContent);
      console.log('Verification email sent successfully');
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Continue with registration even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Doctor registration request submitted successfully. Please check your email for verification.',
      doctorId: doctor._id
    });
  } catch (error) {
    console.error('Error registering doctor:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error registering doctor'
    });
  }
});

// Verify doctor
router.post('/verify/:doctorId', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ _id: req.params.doctorId });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Update doctor's verification status
    doctor.isVerified = true;
    await doctor.save();

    // Send verification confirmation email using Brevo
    try {
      const htmlContent = `
        <h2>Account Verified</h2>
        <p>Dear ${doctor.name},</p>
        <p>Your doctor account has been verified. You can now log in to the platform using your credentials:</p>
        <p>Doctor ID: <strong>${doctor._id}</strong></p>
        <p>Please change your password upon first login for security reasons.</p>
        <p>Best regards,<br>BioNexa Team</p>
      `;

      await sendBrevoEmail(
        doctor.email,
        'Account Verified - BioNexa Healthcare Platform',
        htmlContent
      );

      res.status(200).json({
        success: true,
        message: 'Doctor verified successfully'
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Still return success since the verification status was updated
      res.status(200).json({
        success: true,
        message: 'Doctor verified successfully, but there was an error sending the confirmation email'
      });
    }
  } catch (error) {
    console.error('Error verifying doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying doctor'
    });
  }
});

// Doctor login
router.post('/login', async (req, res) => {
  try {
    const { email, password, doctorId } = req.body;
    console.log('Doctor login attempt:', { email, doctorId });

    // Find doctor by email and doctorId
    const doctor = await Doctor.findOne({ email, _id: doctorId });
    console.log('Doctor found in database:', doctor ? 'Yes' : 'No');
    if (!doctor) {
      console.log('No doctor found with email:', email, 'and doctorId:', doctorId);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if doctor is verified
    console.log('Doctor verification status:', doctor.isVerified);
    
    // Check if doctor is verified, return error if not
    if (!doctor.isVerified) {
      console.log('Doctor account not verified:', email);
      
      // The frontend should already have verified the doctor's account
      // if the Firebase email is verified, but in case that didn't happen
      // we'll verify the doctor here as well.
      doctor.isVerified = true;
      await doctor.save();
      console.log('Auto-verified doctor during login:', email);
    }

    // Check password
    if (doctor.password !== password) {
      console.log('Password mismatch');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Return success response
    console.log('Login successful for doctor:', doctor._id);
    res.status(200).json({
      success: true,
      data: {
        doctorId: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        uid: doctor.uid // Include UID in response for debugging
      }
    });
  } catch (error) {
    console.error('Error logging in doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    });
  }
});

// Get all doctors
router.get('/', async (req, res) => {
  try {
    const doctors = await Doctor.find();
    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get doctors by specialization
router.get('/specialization/:specialization', async (req, res) => {
  try {
    const { date } = req.query;
    
    console.log(`Fetching doctors with specialization: ${req.params.specialization}, date filter: ${date || 'none'}`);
    
    // Find verified doctors with the requested specialization
    const doctors = await Doctor.find({ 
      specialization: req.params.specialization,
      isVerified: true
    }).select('name specialization expertise experience education rating patients description image availability');

    console.log(`Found ${doctors.length} verified doctors with specialization ${req.params.specialization}`);

    // Filter doctors based on availability
    const availableDoctors = doctors.filter(doctor => {
      if (!doctor.availability || doctor.availability.length === 0) {
        return false;
      }
      
      // If no specific date is requested, check if doctor has any available slots
      if (!date) {
        return doctor.availability.some(slot => 
          slot.isAvailable && 
          !slot.isBooked && 
          (slot.currentBookings < (slot.patientLimit || 1))
        );
      }
      
      // If a specific date is requested, check availability for that date
      return doctor.availability.some(slot => 
        slot.date === date && 
        slot.isAvailable && 
        !slot.isBooked &&
        (slot.currentBookings < (slot.patientLimit || 1))
      );
    });
    
    console.log(`Filtered to ${availableDoctors.length} doctors with availability`);
    
    res.json({
      success: true,
      data: availableDoctors
    });
  } catch (error) {
    console.error('Error fetching doctors by specialization:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get doctor by ID
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get available slots for a doctor
router.get('/:id/available-slots', async (req, res) => {
  try {
    const { date } = req.query;
    const doctor = await Doctor.findById(req.params.id);
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Filter slots that are available and not fully booked
    // Check both isBooked flag and currentBookings vs patientLimit
    const availableSlots = doctor.availability
      .filter(slot => 
        slot.date === date && 
        slot.isAvailable && 
        !slot.isBooked && 
        (slot.currentBookings < (slot.patientLimit || 1))
      );

    res.json({
      success: true,
      data: availableSlots
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update doctor's available slots
router.patch('/:id/available-slots', verifyToken, async (req, res) => {
  try {
    const { date, time, isBooked } = req.body;
    const doctor = await Doctor.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const dateIndex = doctor.availableDates.findIndex(
      d => d.date.toISOString().split('T')[0] === date
    );

    if (dateIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Date not found'
      });
    }

    const slotIndex = doctor.availableDates[dateIndex].slots.findIndex(
      s => s.time === time
    );

    if (slotIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found'
      });
    }

    doctor.availableDates[dateIndex].slots[slotIndex].isBooked = isBooked;
    await doctor.save();

    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update doctor's availability
router.patch('/availability', verifyToken, async (req, res) => {
  try {
    const { date, time, isAvailable, patientLimit } = req.body;
    
    // Validate input
    if (!date || !time || typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data'
      });
    }

    const doctor = await Doctor.findOne({ uid: req.user.uid });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Find existing slot
    const slotIndex = doctor.availability.findIndex(
      slot => slot.date === date && slot.time === time
    );

    if (slotIndex === -1) {
      // Add new slot
      doctor.availability.push({ 
        date, 
        time, 
        isAvailable, 
        isBooked: false,
        patientLimit: patientLimit || 1,
        currentBookings: 0
      });
    } else {
      // Update existing slot
      doctor.availability[slotIndex].isAvailable = isAvailable;
      
      // Update patientLimit if provided
      if (patientLimit !== undefined) {
        doctor.availability[slotIndex].patientLimit = patientLimit;
      }
    }

    await doctor.save();

    res.json({
      success: true,
      message: 'Availability updated successfully',
      data: doctor.availability
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating availability'
    });
  }
});

// Update doctor's Firebase UID
router.patch('/:doctorId/update-uid', async (req, res) => {
  try {
    const { uid } = req.body;
    const doctor = await Doctor.findOne({ _id: req.params.doctorId });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    doctor.uid = uid;
    await doctor.save();

    res.status(200).json({
      success: true,
      message: 'Doctor UID updated successfully'
    });
  } catch (error) {
    console.error('Error updating doctor UID:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating doctor UID'
    });
  }
});

// Add new route for doctor verification
router.post('/verify', async (req, res) => {
  try {
    console.log('Doctor verification request received:', req.body);
    const { email, doctorId } = req.body;

    if (!email || !doctorId) {
      console.log('Missing required fields');
      return res.status(400).json({ 
        success: false,
        message: 'Email and doctor ID are required' 
      });
    }

    // Find doctor by email and doctorId
    const doctor = await Doctor.findOne({ email, _id: doctorId });
    console.log('Doctor found:', doctor ? 'Yes' : 'No');

    if (!doctor) {
      console.log('Invalid doctor credentials');
      return res.status(401).json({ 
        success: false,
        message: 'Invalid doctor credentials' 
      });
    }

    // Set doctor as verified
    doctor.isVerified = true;
    await doctor.save();

    // Send verification confirmation email using Brevo
    try {
      const htmlContent = `
        <h2>Account Verified</h2>
        <p>Dear ${doctor.name},</p>
        <p>Your doctor account has been verified. You can now log in to the platform using your credentials:</p>
        <p>Doctor ID: <strong>${doctor._id}</strong></p>
        <p>Please change your password upon first login for security reasons.</p>
        <p>Best regards,<br>BioNexa Team</p>
      `;

      await sendBrevoEmail(
        doctor.email,
        'Account Verified - BioNexa Healthcare Platform',
        htmlContent
      );

      console.log('Doctor verification successful');
      res.json({ 
        success: true,
        message: 'Doctor verified successfully' 
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Still return success since the verification status was updated
      res.json({ 
        success: true,
        message: 'Doctor verified successfully, but there was an error sending the confirmation email' 
      });
    }
  } catch (error) {
    console.error('Error verifying doctor:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error verifying doctor credentials' 
    });
  }
});

// Add utility endpoint to verify doctor by email only
router.post('/verify-by-email', async (req, res) => {
  try {
    console.log('Email-only verification request received:', req.body);
    const { email } = req.body;

    if (!email) {
      console.log('Missing email');
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }

    // Find doctor by email only
    const doctor = await Doctor.findOne({ email });
    console.log('Doctor found:', doctor ? 'Yes' : 'No');

    if (!doctor) {
      console.log('No doctor found with email:', email);
      return res.status(404).json({ 
        success: false,
        message: 'No doctor found with this email' 
      });
    }

    // Set doctor as verified
    doctor.isVerified = true;
    await doctor.save();
    console.log('Doctor verified:', doctor.email, 'ID:', doctor._id);

    res.json({ 
      success: true,
      message: 'Doctor verified successfully',
      doctorId: doctor._id
    });
  } catch (error) {
    console.error('Error verifying doctor by email:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error verifying doctor' 
    });
  }
});

// Delete all doctors
router.delete('/all', async (req, res) => {
  try {
    await Doctor.deleteMany({});
    res.json({
      success: true,
      message: 'All doctors have been deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Bulk update doctor availability
router.patch('/availability/bulk', verifyToken, async (req, res) => {
  try {
    const { slots } = req.body;

    // Basic input validation
    if (!Array.isArray(slots)) {
      return res.status(400).json({
        success: false,
        message: 'Slots must be an array'
      });
    }

    // Validate each slot has required fields
    for (const slot of slots) {
      if (!slot.date || !slot.time) {
        return res.status(400).json({
          success: false,
          message: 'Each slot must have date and time'
        });
      }
    }

    // Find the doctor
    const doctor = await Doctor.findOne({ uid: req.user.uid });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    console.log('Doctor found:', doctor._id);
    console.log('Current availability:', JSON.stringify(doctor.availability, null, 2));

    // Ensure availability field exists and is initialized
    if (!doctor.availability) {
      console.log('Initializing empty availability array');
      doctor.availability = [];
    }

    // Map slots to the correct format, preserving currentBookings from existing slots
    const formattedSlots = slots.map(slot => {
      // Try to find an existing slot with the same date and time
      const existingSlot = doctor.availability.find(
        existingSlot => existingSlot.date === slot.date && existingSlot.time === slot.time
      );
      
      // Use the existing currentBookings if available, otherwise use the provided value or default to 0
      const currentBookings = slot.currentBookings !== undefined ? slot.currentBookings : 
                             (existingSlot ? existingSlot.currentBookings || 0 : 0);
      
      return {
        date: slot.date,
        time: slot.time,
        isAvailable: slot.isAvailable,
        isBooked: currentBookings >= (slot.patientLimit || 1),
        patientLimit: slot.patientLimit || 1,
        currentBookings: currentBookings
      };
    });

    console.log('Updating availability with formatted slots:', JSON.stringify(formattedSlots, null, 2));

    // Update availability
    doctor.availability = formattedSlots;

    // Save the document
    try {
      console.log('Saving doctor document...');
      await doctor.save();
      console.log('Successfully saved doctor availability');
      res.json({
        success: true,
        data: doctor.availability
      });
    } catch (saveError) {
      console.error('Error saving doctor document:', saveError);
      console.error('Save error details:', {
        name: saveError.name,
        message: saveError.message,
        stack: saveError.stack,
        errors: saveError.errors
      });
      res.status(500).json({
        success: false,
        message: 'Error saving availability. Please try again.',
        error: saveError.message
      });
    }
  } catch (error) {
    console.error('Error in bulk availability update:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating availability'
    });
  }
});

// Update doctor availability for a specific date
router.patch('/availability/date/:date', verifyToken, async (req, res) => {
  try {
    const { slots } = req.body;
    const date = req.params.date;
    
    // Validate input
    if (!Array.isArray(slots)) {
      return res.status(400).json({
        success: false,
        message: 'Slots must be an array'
      });
    }

    const doctor = await Doctor.findOne({ uid: req.user.uid });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Remove existing slots for this date
    doctor.availability = doctor.availability.filter(slot => slot.date !== date);

    // Add new slots for this date
    doctor.availability.push(...slots.map(slot => ({
      ...slot,
      date,
      isBooked: false,
      patientLimit: slot.patientLimit || 1,
      currentBookings: slot.currentBookings || 0
    })));

    await doctor.save();

    res.json({
      success: true,
      data: doctor.availability
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating availability'
    });
  }
});

// Check if doctor exists by UID
router.get('/check-uid/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('Checking doctor existence for UID:', uid);
    
    const doctor = await Doctor.findOne({ uid });
    console.log('Doctor found:', doctor ? 'Yes' : 'No');
    
    if (doctor) {
      console.log('Doctor details:', {
        _id: doctor._id,
        email: doctor.email,
        name: doctor.name,
        isVerified: doctor.isVerified
      });
    }

    res.json({
      success: true,
      exists: !!doctor,
      doctor: doctor ? {
        _id: doctor._id,
        email: doctor.email,
        name: doctor.name,
        isVerified: doctor.isVerified
      } : null
    });
  } catch (error) {
    console.error('Error checking doctor UID:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Auto-verify doctor when Firebase email is verified
router.post('/auto-verify', async (req, res) => {
  try {
    console.log('Auto-verification request received:', req.body);
    const { email, uid } = req.body;

    if (!email && !uid) {
      console.log('Missing required fields');
      return res.status(400).json({ 
        success: false,
        message: 'Email or UID is required' 
      });
    }

    // Find doctor by email or uid
    let doctor;
    if (email) {
      doctor = await Doctor.findOne({ email });
    } else if (uid) {
      doctor = await Doctor.findOne({ uid });
    }

    console.log('Doctor found:', doctor ? 'Yes' : 'No');

    if (!doctor) {
      console.log('No doctor found with provided credentials');
      return res.status(404).json({ 
        success: false,
        message: 'Doctor not found' 
      });
    }

    // Set doctor as verified
    doctor.isVerified = true;
    await doctor.save();
    console.log('Doctor auto-verified:', doctor.email, 'ID:', doctor._id);

    res.json({ 
      success: true,
      message: 'Doctor auto-verified successfully',
      doctorId: doctor._id
    });
  } catch (error) {
    console.error('Error auto-verifying doctor:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error verifying doctor' 
    });
  }
});

// Update doctor's profile
router.put('/update-profile', verifyToken, async (req, res) => {
  try {
    console.log('Profile update request received:', req.body);
    
    // Find doctor by UID
    const doctor = await Doctor.findOne({ uid: req.user.uid });
    if (!doctor) {
      console.log('Doctor not found for uid:', req.user.uid);
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Update allowed fields
    const { name, mobileNumber, profilePhotoUrl } = req.body;
    
    if (name) {
      doctor.name = name;
    }
    
    if (mobileNumber) {
      // Initialize contact object if it doesn't exist
      if (!doctor.contact) {
        doctor.contact = {};
      }
      doctor.contact.phone = mobileNumber;
    }
    
    if (profilePhotoUrl) {
      // Add profilePhotoUrl field if it doesn't exist in the schema
      doctor.profilePhotoUrl = profilePhotoUrl;
    }
    
    // Save the updated doctor
    await doctor.save();
    
    console.log('Doctor profile updated successfully:', {
      _id: doctor._id,
      name: doctor.name,
      mobileNumber: doctor.contact?.phone,
      profilePhotoUrl: doctor.profilePhotoUrl
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        name: doctor.name,
        mobileNumber: doctor.contact?.phone,
        profilePhotoUrl: doctor.profilePhotoUrl
      }
    });
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// Upload profile photo
router.post('/upload-photo', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get the doctor's current record
    const doctor = await Doctor.findOne({ uid: req.user.uid });
    if (!doctor) {
      // Delete the uploaded file if doctor not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Delete old photo if it exists
    if (doctor.profilePhotoUrl) {
      const oldPhotoPath = path.join(__dirname, '..', doctor.profilePhotoUrl);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Update the doctor's profile with the new photo URL
    const photoUrl = '/' + req.file.path.replace(/\\/g, '/');
    doctor.profilePhotoUrl = photoUrl;
    await doctor.save();

    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      photoUrl: photoUrl
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    // Delete the uploaded file if there's an error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading photo'
    });
  }
});

module.exports = router; 