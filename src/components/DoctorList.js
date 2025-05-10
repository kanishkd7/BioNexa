import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faCalendarCheck, faArrowLeft, faFilter, faTimes } from '@fortawesome/free-solid-svg-icons';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './DoctorList.css';

const DoctorList = ({ doctors, loading, onBack }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [filteredDoctors, setFilteredDoctors] = useState(doctors);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingStatus, setBookingStatus] = useState('');

  useEffect(() => {
    if (selectedDoctor) {
      fetchDoctorAvailability();
    }
  }, [selectedDoctor]);

  const fetchDoctorAvailability = async () => {
    try {
      const availabilityDoc = await getDocs(doc(db, 'doctorAvailability', selectedDoctor.id));
      if (availabilityDoc.exists()) {
        const slots = availabilityDoc.data().slots || [];
        // Filter slots for the next 3 days
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);
        
        const availableSlots = slots.filter(slot => {
          const slotDate = new Date(slot.date);
          return slot.isAvailable && 
                 slotDate >= today && 
                 slotDate <= threeDaysFromNow &&
                 (slot.currentBookings < (slot.patientLimit || 1)); // Check if slot is full
        });
        
        setAvailableSlots(availableSlots);
      }
    } catch (error) {
      console.error('Error fetching doctor availability:', error);
    }
  };

  const handleDateFilter = (date) => {
    setSelectedDate(date);
    if (date) {
      const filtered = doctors.filter(doctor => 
        doctor.availableDates && doctor.availableDates.includes(date)
      );
      setFilteredDoctors(filtered);
    } else {
      setFilteredDoctors(doctors);
    }
  };

  const handleBookAppointment = async (doctor) => {
    setSelectedDoctor(doctor);
    setShowSlotsModal(true);
  };

  const handleSlotSelect = async (slot) => {
    try {
      // Check if the slot has reached its patient limit
      if (slot.currentBookings >= slot.patientLimit) {
        alert('This slot has reached its maximum patient limit');
        return;
      }
      
      setBookingStatus('booking');
      // Create new appointment
      const appointmentData = {
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        patientId: 'current-user-id', // Replace with actual user ID
        patientName: 'Patient Name', // Replace with actual patient name
        date: slot.date,
        time: slot.time,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'appointments'), appointmentData);
      setBookingStatus('success');
      
      // Update availability
      const availabilityRef = doc(db, 'doctorAvailability', selectedDoctor.id);
      const availabilityDoc = await getDocs(availabilityRef);
      if (availabilityDoc.exists()) {
        const slots = availabilityDoc.data().slots || [];
        const updatedSlots = slots.map(s => {
          if (s.date === slot.date && s.time === slot.time) {
            // Increment currentBookings
            const newCurrentBookings = (s.currentBookings || 0) + 1;
            // Check if slot is now fully booked
            const isFullyBooked = newCurrentBookings >= (s.patientLimit || 1);
            return { 
              ...s, 
              isAvailable: !isFullyBooked,
              currentBookings: newCurrentBookings
            };
          }
          return s;
        });
        await updateDoc(availabilityRef, { slots: updatedSlots });
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      setBookingStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="doctor-list-loading">
        <div className="loading-spinner"></div>
        <p>Finding available doctors...</p>
      </div>
    );
  }

  if (!doctors || doctors.length === 0) {
    return null;
  }

  return (
    <div className="doctor-list-container">
      <div className="doctor-list-header">
        <button className="back-button" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <h3>Available Doctors</h3>
        <div className="filter-section">
          <FontAwesomeIcon icon={faFilter} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateFilter(e.target.value)}
            className="date-filter"
          />
        </div>
      </div>

      <div className="doctor-grid">
        {filteredDoctors.map((doctor) => (
          <div key={doctor.id} className="doctor-card">
            <div className="doctor-header">
              <div className="doctor-status">
                <FontAwesomeIcon 
                  icon={faCircle} 
                  className={`status-icon ${doctor.isAvailable ? 'available' : 'unavailable'}`} 
                />
                {doctor.isAvailable ? 'Available' : 'Unavailable'}
              </div>
            </div>
            
            <div className="doctor-info">
              <h4>{doctor.name}</h4>
              <p className="doctor-specialty">{doctor.specialization || doctor.expertise || doctor.specialty}</p>
              <p className="doctor-experience">{doctor.experience} years experience</p>
              <p className="doctor-description">{doctor.description}</p>
            </div>

            <div className="doctor-footer">
              <div className="doctor-rating">
                <span className="rating-score">{doctor.rating}</span>
                <span className="rating-count">({doctor.reviewCount} reviews)</span>
              </div>
              <button 
                className="book-appointment-btn"
                onClick={() => handleBookAppointment(doctor)}
                disabled={!doctor.isAvailable}
              >
                <FontAwesomeIcon icon={faCalendarCheck} />
                Book Appointment
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Available Slots Modal */}
      {showSlotsModal && (
        <div className="slots-modal">
          <div className="slots-modal-content">
            <div className="slots-modal-header">
              <h3>Available Time Slots</h3>
              <button className="close-modal" onClick={() => setShowSlotsModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            {bookingStatus === 'booking' && (
              <div className="booking-status">
                <div className="loading-spinner"></div>
                <p>Booking your appointment...</p>
              </div>
            )}

            {bookingStatus === 'success' && (
              <div className="booking-success">
                <p>Appointment booked successfully!</p>
                <button onClick={() => setShowSlotsModal(false)}>Close</button>
              </div>
            )}

            {bookingStatus === 'error' && (
              <div className="booking-error">
                <p>Failed to book appointment. Please try again.</p>
                <button onClick={() => setBookingStatus('')}>Try Again</button>
              </div>
            )}

            {!bookingStatus && (
              <div className="available-slots">
                {availableSlots.length === 0 ? (
                  <p>No available slots for the next 3 days</p>
                ) : (
                  availableSlots.map((slot, index) => (
                    <div
                      key={index}
                      className={`time-slot ${selectedSlot === slot ? 'selected' : ''} ${slot.currentBookings >= slot.patientLimit ? 'fully-booked' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      <div className="slot-date">{new Date(slot.date).toLocaleDateString()}</div>
                      <div className="slot-time">{slot.time}</div>
                      <div className="slot-availability">
                        {slot.currentBookings || 0} / {slot.patientLimit || 1} booked
                      </div>
                    </div>
                  ))
                )}
                {selectedSlot && (
                  <button
                    className="confirm-booking-btn"
                    onClick={() => handleSlotSelect(selectedSlot)}
                  >
                    Confirm Booking
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorList;