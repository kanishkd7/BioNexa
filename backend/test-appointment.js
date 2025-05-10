const mongoose = require('mongoose');
const Appointment = require('./models/Appointment');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bionexa')
  .then(() => {
    console.log('Connected to MongoDB');
    createTestAppointment();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });

async function createTestAppointment() {
  try {
    // Use the doctor ID from the logs: DRA08A5CB4
    const doctorId = 'DRA08A5CB4';
    
    // Create a test appointment
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const testAppointment = new Appointment({
      user: 'IprI0migRdMXhtlDtU4YQwGYz082',  // User ID provided in your example
      doctor: doctorId,
      date: tomorrow,
      time: '10:00',
      type: 'consultation',
      symptoms: 'Test appointment for debugging',
      status: 'scheduled'
    });
    
    console.log('Creating test appointment:', {
      user: testAppointment.user,
      doctor: testAppointment.doctor,
      date: testAppointment.date,
      time: testAppointment.time,
      status: testAppointment.status
    });
    
    // Save to database
    await testAppointment.save();
    
    console.log('Test appointment created successfully');
    console.log('Details:', testAppointment);
    
    // Close connection
    mongoose.connection.close();
  } catch (error) {
    console.error('Error creating test appointment:', error);
    mongoose.connection.close();
    process.exit(1);
  }
} 