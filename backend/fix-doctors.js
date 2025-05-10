require('dotenv').config();
const mongoose = require('mongoose');
const Doctor = require('./models/Doctor');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function updateDoctors() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all doctors
    const doctors = await Doctor.find({});
    console.log(`Found ${doctors.length} doctors`);

    let updatedCount = 0;
    for (const doctor of doctors) {
      try {
        // Get Firebase user by email
        const userRecord = await admin.auth().getUserByEmail(doctor.email);
        console.log(`Found Firebase user for ${doctor.email}: ${userRecord.uid}`);

        // Update doctor with Firebase UID
        doctor.uid = userRecord.uid;
        await doctor.save();
        updatedCount++;
        console.log(`Updated doctor ${doctor._id} with UID ${userRecord.uid}`);
      } catch (error) {
        console.error(`Error updating doctor ${doctor._id}:`, error.message);
      }
    }

    console.log(`Updated ${updatedCount} doctors`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error updating doctors:', error);
  }
}

updateDoctors(); 