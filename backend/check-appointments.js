const mongoose = require('mongoose');
const Appointment = require('./models/Appointment');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bionexa')
  .then(() => {
    console.log('Connected to MongoDB');
    checkAppointments();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });

async function checkAppointments() {
  try {
    // Query by exact doctor ID
    const doctorId = 'DRA08A5CB4';
    
    console.log(`Checking for appointments with doctor ID: ${doctorId}`);
    
    // Find all appointments in the system
    const allAppointments = await Appointment.find({});
    console.log(`Total appointments in database: ${allAppointments.length}`);
    
    // Show all doctor IDs in appointments collection
    console.log('Doctor IDs in appointment records:');
    const doctorIds = [...new Set(allAppointments.map(a => a.doctor))];
    console.log(doctorIds);
    
    // Find appointments for specific doctor with exact ID
    const exactMatches = await Appointment.find({ doctor: doctorId });
    console.log(`Appointments with exact doctor ID match: ${exactMatches.length}`);
    
    if (exactMatches.length > 0) {
      console.log('First exact match appointment:', {
        id: exactMatches[0]._id,
        doctor: exactMatches[0].doctor,
        user: exactMatches[0].user,
        date: exactMatches[0].date,
        status: exactMatches[0].status
      });
    }
    
    // Find with regex (in case of formatting issues)
    const regexMatches = await Appointment.find({ doctor: { $regex: new RegExp(doctorId, 'i') } });
    console.log(`Appointments with regex doctor ID match: ${regexMatches.length}`);

    // Close connection
    mongoose.connection.close();
  } catch (error) {
    console.error('Error checking appointments:', error);
    mongoose.connection.close();
    process.exit(1);
  }
} 