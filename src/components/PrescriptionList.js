import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faDownload, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import './PrescriptionList.css';

const PrescriptionList = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock data for prescriptions
  const [prescriptions] = useState([
    {
      id: 1,
      doctorName: 'Dr. Sarah Wilson',
      date: '2024-01-15',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5SeDwvdGV4dD48L3N2Zz4=',
      medications: ['Amoxicillin 500mg', 'Ibuprofen 400mg'],
      diagnosis: 'Acute bronchitis'
    },
    {
      id: 2,
      doctorName: 'Dr. Michael Chen',
      date: '2024-01-10',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5SeDwvdGV4dD48L3N2Zz4=',
      medications: ['Lisinopril 10mg', 'Aspirin 81mg'],
      diagnosis: 'Hypertension'
    }
  ]);

  const filteredPrescriptions = prescriptions.filter(prescription => {
    const searchLower = searchQuery.toLowerCase();
    return (
      prescription.doctorName.toLowerCase().includes(searchLower) ||
      prescription.date.includes(searchLower) ||
      prescription.diagnosis.toLowerCase().includes(searchLower) ||
      prescription.medications.some(med => med.toLowerCase().includes(searchLower))
    );
  });

  const handleDownload = (prescriptionId) => {
    // TODO: Implement prescription download functionality
    console.log(`Downloading prescription ${prescriptionId}`);
  };

  return (
    <div className="prescription-list-container">
      <div className="prescription-list-header">
        <h2>My Prescriptions</h2>
      </div>

      <div className="prescription-search">
        <div className="search-input-container">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="Search prescriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="prescription-grid">
        {filteredPrescriptions.map((prescription) => (
          <div key={prescription.id} className="prescription-card">
            <div className="prescription-thumbnail">
              <img src={prescription.thumbnail} alt="Prescription thumbnail" />
            </div>
            <div className="prescription-info">
              <h3>{prescription.doctorName}</h3>
              <p className="prescription-date">{prescription.date}</p>
              <p className="prescription-diagnosis">{prescription.diagnosis}</p>
            </div>
            <button
              className="download-button"
              onClick={() => handleDownload(prescription.id)}
            >
              <FontAwesomeIcon icon={faDownload} />
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrescriptionList;