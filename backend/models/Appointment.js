const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  doctor: {
    type: String,
    ref: 'Doctor',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['consultation', 'follow-up', 'emergency']
  },
  symptoms: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual populate
appointmentSchema.virtual('doctorDetails', {
  ref: 'Doctor',
  localField: 'doctor',
  foreignField: '_id',
  justOne: true
});

// Always populate virtual fields
appointmentSchema.set('toJSON', { virtuals: true });
appointmentSchema.set('toObject', { virtuals: true });

appointmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
