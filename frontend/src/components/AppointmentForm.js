const checkDuplicateAppointment = async (appointmentData) => {
  try {
    const response = await fetch('/api/appointments/check-duplicate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doctorId: appointmentData.doctorId,
        date: appointmentData.date,
        time: appointmentData.time
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to check for duplicate appointments');
    }

    if (data.isDuplicate) {
      setError('You already have an appointment scheduled with this doctor at the selected date and time.');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking for duplicate appointment:', error);
    setError(error.message || 'An error occurred while checking for duplicate appointments');
    return true;
  }
};

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setSuccess('');

  const appointmentData = {
    doctorId: selectedDoctor,
    date: selectedDate,
    time: selectedTime,
    reason: appointmentReason
  };

  try {
    // Check for duplicate appointment first
    const isDuplicate = await checkDuplicateAppointment(appointmentData);
    if (isDuplicate) {
      return;
    }

    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(appointmentData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to schedule appointment');
    }

    setSuccess('Appointment scheduled successfully!');
    // Reset form
    setSelectedDoctor('');
    setSelectedDate('');
    setSelectedTime('');
    setAppointmentReason('');
  } catch (error) {
    console.error('Error scheduling appointment:', error);
    setError(error.message || 'An error occurred while scheduling the appointment');
  }
}; 