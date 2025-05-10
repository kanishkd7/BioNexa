const express = require('express');
const router = express.Router();
const multer = require('multer');
const Prescription = require('../models/Prescription');

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/prescriptions')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop())
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

// Create new prescription with image
router.post('/', upload.single('prescriptionImage'), async (req, res) => {
  try {
    const { medications, diagnosis, validUntil, notes } = req.body;
    const prescriptionData = {
      patient: req.user._id,
      doctor: req.user.role === 'doctor' ? req.user._id : req.body.doctorId,
      prescriptionImage: `/uploads/prescriptions/${req.file.filename}`,
      medications: JSON.parse(medications),
      diagnosis,
      validUntil,
      notes
    };

    const prescription = await Prescription.create(prescriptionData);
    const populatedPrescription = await prescription
      .populate('patient', 'name email')
      .populate('doctor', 'name email specialty');

    res.status(201).json(populatedPrescription);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all prescriptions for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const prescriptions = await Prescription.find({
      $or: [{ patient: userId }, { doctor: userId }]
    })
    .populate('patient', 'name email')
    .populate('doctor', 'name email specialty')
    .sort({ issuedDate: -1 });

    res.status(200).json(prescriptions);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update prescription status
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const prescription = await Prescription.findByIdAndUpdate(
      id,
      { status, notes },
      { new: true, runValidators: true }
    )
    .populate('patient', 'name email')
    .populate('doctor', 'name email specialty');

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    res.status(200).json(prescription);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;