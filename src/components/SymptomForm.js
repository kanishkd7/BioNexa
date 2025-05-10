import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faNotesMedical, faUserMd, faListUl } from '@fortawesome/free-solid-svg-icons';
import './SymptomForm.css';

const specialistMap = {
  // Common symptoms and their corresponding specialists
  'headache': 'Neurologist',
  'migraine': 'Neurologist',
  'chest pain': 'Cardiologist',
  'heart palpitations': 'Cardiologist',
  'joint pain': 'Orthopedist',
  'back pain': 'Orthopedist',
  'skin rash': 'Dermatologist',
  'acne': 'Dermatologist',
  'anxiety': 'Psychiatrist',
  'depression': 'Psychiatrist',
  'stomach pain': 'Gastroenterologist',
  'digestive issues': 'Gastroenterologist',
  'vision problems': 'Ophthalmologist',
  'eye pain': 'Ophthalmologist',
  'sore throat': 'ENT Specialist',
  'hearing problems': 'ENT Specialist',
  'cough': 'Pulmonologist',
  'breathing difficulty': 'Pulmonologist',
  'fever': 'General Physician',
  'cold': 'General Physician'
};

const SymptomForm = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('symptoms');
  const [symptoms, setSymptoms] = useState('');
  const [specialist, setSpecialist] = useState(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Convert symptoms to lowercase for matching
    const symptomsList = symptoms.toLowerCase().split(',').map(s => s.trim());
    
    // Find matching specialist based on symptoms
    let recommendedSpecialist = 'General Physician';
    for (const symptom of symptomsList) {
      if (specialistMap[symptom]) {
        recommendedSpecialist = specialistMap[symptom];
        break;
      }
    }
    
    setSpecialist(recommendedSpecialist);
  };

  const uniqueSpecialists = [...new Set(Object.values(specialistMap))].sort();

  const handleDirectSelection = (e) => {
    e.preventDefault();
    setSpecialist(selectedSpecialist);
  };

  return (
    <div className="symptom-form-overlay">
      <div className="symptom-form-container">
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2><FontAwesomeIcon icon={faNotesMedical} /> Book Appointment</h2>

        <div className="booking-tabs">
          <button
            className={`tab-button ${activeTab === 'symptoms' ? 'active' : ''}`}
            onClick={() => setActiveTab('symptoms')}
          >
            <FontAwesomeIcon icon={faSearch} /> By Symptoms
          </button>
          <button
            className={`tab-button ${activeTab === 'specialist' ? 'active' : ''}`}
            onClick={() => setActiveTab('specialist')}
          >
            <FontAwesomeIcon icon={faUserMd} /> Select Specialist
          </button>
        </div>
        
        {activeTab === 'symptoms' ? (
          <form onSubmit={handleSubmit} className="symptom-form">
            <div className="form-group">
              <label htmlFor="symptoms">Please describe your symptoms:</label>
              <textarea
                id="symptoms"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Enter your symptoms (separate multiple symptoms with commas)"
                required
              />
            </div>
            
            <button type="submit" className="submit-button">
              <FontAwesomeIcon icon={faSearch} /> Analyze Symptoms
            </button>
          </form>
        ) : (
          <form onSubmit={handleDirectSelection} className="specialist-form">
            <div className="form-group">
              <label htmlFor="specialist">Select a Specialist:</label>
              <select
                id="specialist"
                value={selectedSpecialist}
                onChange={(e) => setSelectedSpecialist(e.target.value)}
                required
                className="specialist-select"
              >
                <option value="">Choose a specialist...</option>
                {uniqueSpecialists.map((specialist, index) => (
                  <option key={index} value={specialist}>
                    {specialist}
                  </option>
                ))}
              </select>
            </div>
            
            <button type="submit" className="submit-button">
              <FontAwesomeIcon icon={faUserMd} /> Book with Specialist
            </button>
          </form>
        )}

        {activeTab === 'symptoms' && specialist && (
          <div className="specialist-recommendation">
            <h3>Based on your symptoms, we recommend:</h3>
            <p>A consultation with a <strong>{specialist}</strong></p>
            <button className="find-specialist-button">
              Find {specialist}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SymptomForm;