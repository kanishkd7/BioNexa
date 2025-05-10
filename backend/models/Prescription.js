const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  prescriptionImage: {
    type: String, // URL to the stored image
    required: [true, 'Prescription image is required']
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Prescription must belong to a patient']
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Prescription must be issued by a doctor']
  },
  medications: [{
    name: {
      type: String,
      required: [true, 'Medication name is required']
    },
    dosage: String,
    frequency: String,
    duration: String
  }],
  diagnosis: {
    type: String,
    required: [true, 'Diagnosis is required']
  },
  notes: String,
  issuedDate: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: [true, 'Prescription validity period is required']
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  }
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);
module.exports = Prescription;