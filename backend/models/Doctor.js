const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    unique: true
  },
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  mobileNumber: {
    type: String,
    default: ''
  },
  specialization: {
    type: String,
    required: true
  },
  expertise: {
    type: String,
    required: true
  },
  experience: {
    type: String,
    required: true
  },
  education: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    required: true
  },
  patients: {
    type: Number,
    required: true
  },
  uid: {
    type: String,
    required: true,
    unique: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  profilePhotoUrl: {
    type: String,
    default: null
  },
  availableDates: [{
    type: String
  }],
  availableSlots: [{
    type: String
  }],
  contact: {
    email: String,
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String
    }
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number
  }],
  availability: {
    type: [{
      date: {
        type: String,
        required: true,
        validate: {
          validator: function(v) {
            return /^\d{4}-\d{2}-\d{2}$/.test(v);
          },
          message: props => `${props.value} is not a valid date format! Use YYYY-MM-DD`
        }
      },
      time: {
        type: String,
        required: true,
        validate: {
          validator: function(v) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
          },
          message: props => `${props.value} is not a valid time format! Use HH:MM`
        }
      },
      isAvailable: {
        type: Boolean,
        default: true
      },
      isBooked: {
        type: Boolean,
        default: false
      },
      patientLimit: {
        type: Number,
        default: 1,
        min: 1
      },
      currentBookings: {
        type: Number,
        default: 0
      }
    }],
    default: []
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

// Create a compound index on id to ensure uniqueness
doctorSchema.index({ id: 1 }, { unique: true });

// Pre-save middleware to set _id equal to id
doctorSchema.pre('save', function(next) {
  if (this.isNew) {
    this._id = this.id;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Doctor', doctorSchema); 