const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

// Get user's appointments
router.get('/', verifyToken, async (req, res) => {
  try {
    // Log the requesting user info
    console.log(`[GET /appointments] Request from UID: ${req.user.uid}, Email: ${req.user.email}`);
    
    // Check if the user is a doctor (has doctor record)
    const doctor = await Doctor.findOne({ uid: req.user.uid });
    
    if (doctor) {
      console.log(`[GET /appointments] Found doctor: ${doctor.name}, ID: ${doctor._id}, Custom ID: ${doctor.id}`);
      
      // Find all appointments in the database first to check total count
      const allAppointments = await Appointment.find({});
      console.log(`[GET /appointments] Total appointments in database: ${allAppointments.length}`);
      
      // Log all doctor IDs in appointments
      const doctorIds = [...new Set(allAppointments.map(a => a.doctor))];
      console.log(`[GET /appointments] All doctor IDs in appointments: ${JSON.stringify(doctorIds)}`);
      
      // If it's a doctor, get appointments where this doctor is assigned
      // Use both _id and id fields to ensure compatibility and also try regex matching
      const appointments = await Appointment.find({ 
        $or: [
          { doctor: doctor._id ? doctor._id.toString() : null }, 
          { doctor: doctor.id ? doctor.id.toString() : null },
          { doctor: doctor.id ? doctor.id : null }
        ]
      }).sort({ date: 1 });
      
      console.log(`[GET /appointments] Doctor: ${doctor.name}`);
      console.log(`[GET /appointments] Search query: { $or: [{ doctor: "${doctor._id}" }, { doctor: "${doctor.id}" }, { doctor: /${doctor.id}/i }] }`);
      console.log(`[GET /appointments] Found ${appointments.length} appointments for doctor ${doctor.name}`);
      
      // Debug: Log raw appointment data
      console.log(`[GET /appointments] Raw appointments: ${JSON.stringify(appointments.map(a => ({
        id: a._id,
        doctor: a.doctor,
        user: a.user,
        date: a.date,
        time: a.time,
        status: a.status
      })), null, 2)}`);
      
      // Get patient details for each appointment
      const appointmentsWithPatients = [];
      for (const appointment of appointments) {
        // Find the user (patient) for this appointment
        console.log(`[GET /appointments] Looking for patient with UID: ${appointment.user}`);
        const patient = await User.findOne({ uid: appointment.user });
        
        if (patient) {
          console.log(`[GET /appointments] Found patient: ${patient.displayName}`);
        } else {
          console.log(`[GET /appointments] Patient not found for UID: ${appointment.user}, will use default values`);
        }
        
        // Format the date as YYYY-MM-DD for consistency
        const dateObj = new Date(appointment.date);
        const formattedDate = dateObj.toISOString().split('T')[0];
        
        appointmentsWithPatients.push({
          id: appointment._id,
          date: formattedDate,
          time: appointment.time || '10:00', // Default time if not available
          status: appointment.status,
          type: appointment.type || 'consultation', // Default type if not available
          symptoms: appointment.symptoms || 'General checkup', // Default symptoms if not available
          patientName: patient ? patient.displayName : 'Unknown Patient',
          patientEmail: patient ? patient.email : '',
          patientPhone: patient ? patient.phoneNumber : '',
          appointmentReason: appointment.symptoms || 'General checkup'
        });
      }
      
      console.log(`[GET /appointments] Formatted appointments: ${JSON.stringify(appointmentsWithPatients, null, 2)}`);
      
      // Return array directly instead of empty object when no appointments
      res.json({
        success: true,
        data: appointmentsWithPatients
      });
      return;
    }
    
    // Otherwise, get regular user appointments
    const appointments = await Appointment.find({ user: req.user.uid })
      .populate('doctor', 'name specialization description image')
      .sort({ date: 1 });

    res.json({
      success: true,
      data: {
        upcoming: appointments.filter(a => new Date(a.date) >= new Date() && a.status === 'scheduled'),
        previous: appointments.filter(a => new Date(a.date) < new Date() || a.status !== 'scheduled')
      }
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Book new appointment
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log("Received appointment request:", req.body);

    // Get doctor ID
    const doctorId = req.body.doctorId || req.body.doctor;
    console.log("Looking for doctor with ID:", doctorId);

    // Find doctor by _id or id
    const doctor = await Doctor.findOne({ 
      $or: [
        { _id: doctorId },
        { id: doctorId }
      ]
    });
    
    if (!doctor) {
      console.log("Doctor not found with ID:", doctorId);
      return res.status(404).json({ 
        success: false, 
        message: `Doctor not found with ID: ${doctorId}`
      });
    }

    console.log(`Found doctor: ${doctor.name}, ID: ${doctor._id}, Custom ID: ${doctor.id}`);
    console.log(`Creating appointment for user UID: ${req.user.uid}`);

    // Convert date string to Date object and set time to start of day
    const appointmentDate = new Date(req.body.date);
    appointmentDate.setHours(0, 0, 0, 0);

    // Get the end of the day for the appointment date
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Format date for availability check
    const formattedDate = appointmentDate.toISOString().split('T')[0];
    const time = req.body.time;

    // Check if the slot is available and not fully booked
    let slot = doctor.availability.find(
      s => s.date === formattedDate && s.time === time
    );

    // TEMPORARY FIX: If the slot doesn't exist but we're trying to book it,
    // automatically create the slot (this would only happen if UI shows a slot the doctor hasn't explicitly set up)
    if (!slot) {
      console.log(`Slot ${formattedDate} ${time} doesn't exist in doctor's availability, creating it automatically`);
      const newSlot = {
        date: formattedDate,
        time: time,
        isAvailable: true,
        isBooked: false,
        patientLimit: 1,
        currentBookings: 0
      };
      
      doctor.availability.push(newSlot);
      slot = newSlot;
      
      // Save the doctor with the new slot
      await doctor.save();
      console.log(`Created new slot for ${formattedDate} ${time}`);
    }

    if (!slot.isAvailable) {
      return res.status(400).json({
        success: false,
        message: "This time slot is not available."
      });
    }

    if (slot.isBooked || slot.currentBookings >= (slot.patientLimit || 1)) {
      return res.status(400).json({
        success: false,
        message: "This time slot is fully booked."
      });
    }

    // Check for existing appointment with the same doctor, date, and time
    const existingAppointment = await Appointment.findOne({
      user: req.user.uid,
      doctor: { $in: [doctor.id, doctor._id.toString()] },
      date: {
        $gte: appointmentDate,
        $lte: endOfDay
      },
      time: req.body.time,
      status: { $in: ['scheduled', 'pending'] }
    });

    if (existingAppointment) {
      console.log("Duplicate appointment found:", {
        id: existingAppointment._id,
        doctor: existingAppointment.doctor,
        date: existingAppointment.date,
        time: existingAppointment.time,
        status: existingAppointment.status
      });
      return res.status(400).json({
        success: false,
        message: "You already have an appointment scheduled with this doctor at this time."
      });
    }

    // Create new appointment
    const appointment = new Appointment({
      user: req.user.uid,
      doctor: doctor.id || doctor._id, // Prefer the custom ID if available
      date: appointmentDate,
      time: req.body.time,
      type: req.body.type,
      symptoms: req.body.symptoms,
      status: 'scheduled'
    });

    // Log the appointment that will be saved
    console.log("Saving appointment:", {
      user: appointment.user,
      doctor: appointment.doctor,
      date: appointment.date,
      time: appointment.time
    });

    // Save appointment
    await appointment.save();
    
    // Update doctor's availability for this slot
    const slotIndex = doctor.availability.findIndex(
      slot => slot.date === formattedDate && slot.time === req.body.time
    );
    
    if (slotIndex !== -1) {
      // Update existing slot's booking count
      const currentBookings = (doctor.availability[slotIndex].currentBookings || 0) + 1;
      doctor.availability[slotIndex].currentBookings = currentBookings;
      
      // Check if the slot is now fully booked
      const patientLimit = doctor.availability[slotIndex].patientLimit || 1;
      doctor.availability[slotIndex].isBooked = currentBookings >= patientLimit;
      
      console.log(`Updated slot booking count: ${currentBookings}/${patientLimit}`);
    } else {
      console.log(`Slot not found in doctor's availability, creating it now`);
      // Create a new slot if it doesn't exist
      doctor.availability.push({
        date: formattedDate,
        time: req.body.time,
        isAvailable: true,
        isBooked: false,
        patientLimit: 1,
        currentBookings: 1
      });
    }
    
    // Save the doctor with updated availability
    await doctor.save();
    console.log(`Doctor availability updated successfully`);
    
    // Populate doctor details
    await appointment.populate('doctor', 'name specialization description image');

    res.status(201).json({ 
      success: true, 
      data: appointment 
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error booking appointment"
    });
  }
});

// Update appointment status
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    console.log(`Updating appointment ${req.params.id} to status: ${status}`);
    
    if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      console.log(`Appointment not found with ID: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    console.log(`Found appointment: ${appointment._id}, current status: ${appointment.status}`);
    
    // Store the old status before updating
    const oldStatus = appointment.status;
    
    // Update status
    appointment.status = status;
    await appointment.save();
    console.log(`Appointment status updated to: ${status}`);

    // Update doctor's availability if status is changing from scheduled/pending to cancelled/completed
    // or from cancelled to scheduled
    if (
      (oldStatus === 'scheduled' || oldStatus === 'pending') && 
      (status === 'cancelled' || status === 'completed')
    ) {
      // Decrease booking count
      await updateDoctorAvailability(appointment, -1);
    } else if (oldStatus === 'cancelled' && status === 'scheduled') {
      // Increase booking count
      await updateDoctorAvailability(appointment, 1);
    }

    // For doctor responses, we need to format the appointment in the same way as the GET endpoint
    const doctor = await Doctor.findOne({ uid: req.user.uid });
    if (doctor) {
      // This is a doctor updating the appointment
      console.log(`Fetching patient data for UID: ${appointment.user}`);
      const patient = await User.findOne({ uid: appointment.user });
      
      if (patient) {
        console.log(`Found patient: ${patient.displayName}`);
      } else {
        console.log(`Patient not found for UID: ${appointment.user}`);
      }
      
      // Format the date as YYYY-MM-DD
      const dateObj = new Date(appointment.date);
      const formattedDate = dateObj.toISOString().split('T')[0];
      
      const formattedAppointment = {
        id: appointment._id,
        date: formattedDate,
        time: appointment.time,
        status: appointment.status,
        type: appointment.type,
        symptoms: appointment.symptoms,
        patientName: patient ? patient.displayName : 'Unknown Patient',
        patientEmail: patient ? patient.email : '',
        patientPhone: patient ? patient.phoneNumber : '',
        appointmentReason: appointment.symptoms
      };
      
      console.log(`Sending formatted appointment back to doctor:`, formattedAppointment);
      
      return res.json({
        success: true,
        data: formattedAppointment
      });
    }
    
    // For patient responses, use the standard format
    await appointment.populate('doctor', 'name specialization description image');
    
    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating appointment status'
    });
  }
});

// Helper function to update doctor availability when appointment status changes
async function updateDoctorAvailability(appointment, countChange) {
  try {
    console.log(`Updating doctor availability for appointment: ${appointment._id}, countChange: ${countChange}`);
    
    // Find the doctor
    const doctor = await Doctor.findOne({ 
      $or: [
        { _id: appointment.doctor },
        { id: appointment.doctor }
      ]
    });
    
    if (!doctor) {
      console.log(`Doctor not found for appointment: ${appointment._id}`);
      return;
    }
    
    console.log(`Found doctor: ${doctor.name}, ID: ${doctor._id}`);
    
    // Format the appointment date
    let formattedDate;
    if (typeof appointment.date === 'string') {
      formattedDate = appointment.date.split('T')[0];
    } else if (appointment.date instanceof Date) {
      formattedDate = appointment.date.toISOString().split('T')[0];
    } else {
      const appointmentDate = new Date(appointment.date);
      formattedDate = appointmentDate.toISOString().split('T')[0];
    }
    
    console.log(`Looking for slot with date: ${formattedDate}, time: ${appointment.time}`);
    
    // Find the slot in the doctor's availability
    const slotIndex = doctor.availability.findIndex(
      slot => slot.date === formattedDate && slot.time === appointment.time
    );
    
    if (slotIndex !== -1) {
      // Update existing slot's booking count
      const currentBookings = Math.max(0, (doctor.availability[slotIndex].currentBookings || 0) + countChange);
      doctor.availability[slotIndex].currentBookings = currentBookings;
      
      // Check if the slot is now fully booked
      const patientLimit = doctor.availability[slotIndex].patientLimit || 1;
      doctor.availability[slotIndex].isBooked = currentBookings >= patientLimit;
      
      console.log(`Updated slot booking count: ${currentBookings}/${patientLimit}`);
      
      // Save the doctor with updated availability
      await doctor.save();
      console.log(`Doctor availability updated successfully`);
    } else {
      console.log(`Slot not found in doctor's availability for date: ${formattedDate}, time: ${appointment.time}`);
      
      // If this is an increment operation, create a new slot
      if (countChange > 0) {
        console.log(`Creating new slot for date: ${formattedDate}, time: ${appointment.time}`);
        doctor.availability.push({
          date: formattedDate,
          time: appointment.time,
          isAvailable: true,
          isBooked: countChange >= 1, // Will be booked if countChange is 1 or more
          patientLimit: 1,
          currentBookings: countChange
        });
        
        // Save the doctor with the new slot
        await doctor.save();
        console.log(`Created new slot with booking count: ${countChange}`);
      }
    }
  } catch (error) {
    console.error('Error updating doctor availability:', error);
  }
}

// Cancel appointment
router.patch('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if the appointment belongs to the user
    if (appointment.user !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this appointment'
      });
    }

    // Check if the appointment can be cancelled
    if (appointment.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed or already cancelled appointment'
      });
    }

    // Store old status for comparison
    const oldStatus = appointment.status;

    // Update appointment status
    appointment.status = 'cancelled';
    await appointment.save();

    // Update doctor's availability if status is changing from scheduled/pending to cancelled
    if (oldStatus === 'scheduled' || oldStatus === 'pending') {
      // Decrease booking count
      await updateDoctorAvailability(appointment, -1);
    }

    // Populate doctor details before sending response
    await appointment.populate('doctor');

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling appointment'
    });
  }
});

// Check for duplicate appointments
router.post('/check-duplicate', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { doctorId, date, time } = req.body;

    console.log('Checking for duplicate appointment:', {
      userId,
      doctorId,
      date,
      time
    });

    // Convert date string to Date object and set time to start of day
    const appointmentDate = new Date(date);
    appointmentDate.setHours(0, 0, 0, 0);

    // Get the end of the day for the appointment date
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log('Formatted appointment date range:', {
      start: appointmentDate,
      end: endOfDay
    });

    // Check for existing appointment with the same doctor, date, and time
    const existingAppointment = await Appointment.findOne({
      user: userId,
      doctor: doctorId,
      date: {
        $gte: appointmentDate,
        $lte: endOfDay
      },
      time: time,
      status: { $in: ['scheduled', 'pending'] }
    });

    console.log('Existing appointment found:', existingAppointment ? {
      id: existingAppointment._id,
      doctor: existingAppointment.doctor,
      date: existingAppointment.date,
      time: existingAppointment.time,
      status: existingAppointment.status
    } : 'None');

    res.json({
      success: true,
      isDuplicate: !!existingAppointment
    });
  } catch (error) {
    console.error('Error checking for duplicate appointment:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Error checking for duplicate appointment'
    });
  }
});

module.exports = router;
