import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCamera, faSpinner, faCheck, faLock } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { RecaptchaVerifier, signInWithPhoneNumber, updatePassword } from 'firebase/auth';
import './Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUser(user);
        setPhotoURL(user.photoURL);
        
        // Fetch user data from backend
        try {
          const response = await fetch(`http://localhost:5000/api/users/${user.uid}`, {
            headers: {
              'Authorization': `Bearer ${await user.getIdToken()}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setUserData({
              name: data.name || '',
              email: data.email || '',
              phone: data.phone || '',
              address: data.address || ''
            });
            setIsPhoneVerified(data.phoneVerified || false);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `profile_photos/${user.uid}`);
      await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update user profile in Firebase
      await user.updateProfile({
        photoURL: downloadURL
      });
      
      // Update the local state
      setPhotoURL(downloadURL);
      
      // Update the backend with the new photo URL
      const idToken = await user.getIdToken(true);
      const response = await fetch('http://localhost:5000/api/doctors/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: userData.name,
          mobileNumber: userData.phone,
          profilePhotoUrl: downloadURL
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update profile photo');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Profile photo updated successfully!');
      } else {
        throw new Error(data.message || 'Failed to update profile photo');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(error.message || 'Failed to update profile photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error('You must be logged in to update your profile');
        return;
      }

      console.log('Current user:', {
        uid: currentUser.uid,
        email: currentUser.email,
        emailVerified: currentUser.emailVerified
      });

      const idToken = await currentUser.getIdToken(true);
      console.log('Got ID token, length:', idToken.length);

      const response = await fetch('http://localhost:5000/api/doctors/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: userData.name,
          mobileNumber: userData.phone,
          profilePhotoUrl: photoURL
        })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      if (data.success) {
        toast.success('Profile updated successfully!');
      } else {
        throw new Error(data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile. Please try again.');
    }
  };

  const setupRecaptcha = () => {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'normal',
      'callback': (response) => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
      }
    });
  };

  const handleSendOtp = async () => {
    try {
      if (!userData.phone) {
        toast.error('Please enter a phone number first');
        return;
      }

      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, userData.phone, appVerifier);
      setVerificationId(confirmationResult);
      setShowOtpInput(true);
      toast.success('OTP sent successfully!');
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const result = await verificationId.confirm(otp);
      if (result.user) {
        setIsPhoneVerified(true);
        setShowOtpInput(false);
        toast.success('Phone number verified successfully!');
        
        // Update backend with verified status
        const idToken = await user.getIdToken(true);
        await fetch('http://localhost:5000/api/doctors/update-profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            ...userData,
            phoneVerified: true
          })
        });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast.error('Invalid OTP. Please try again.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!isPhoneVerified) {
      toast.error('Please verify your phone number first');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password should be at least 6 characters long');
      return;
    }

    setIsChangingPassword(true);
    try {
      await updatePassword(user, newPassword);
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2>Profile Settings</h2>
      </div>
      
      <div className="profile-content">
        <div className="profile-photo-section">
          <div className="profile-photo">
            {photoURL ? (
              <img src={photoURL} alt="Profile" />
            ) : (
              <FontAwesomeIcon icon={faUser} className="default-avatar" />
            )}
            <div className="photo-upload">
              <label htmlFor="photo-upload" className="upload-button">
                <FontAwesomeIcon icon={faCamera} />
                {isUploading ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  'Change Photo'
                )}
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={isUploading}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={userData.name}
              onChange={handleInputChange}
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={userData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              disabled
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <div className="phone-input-group">
              <input
                type="tel"
                id="phone"
                name="phone"
                value={userData.phone}
                onChange={handleInputChange}
                placeholder="Enter your phone number"
                disabled={isPhoneVerified}
              />
              {!isPhoneVerified && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="verify-button"
                >
                  Verify Phone
                </button>
              )}
              {isPhoneVerified && (
                <span className="verified-badge">
                  <FontAwesomeIcon icon={faCheck} /> Verified
                </span>
              )}
            </div>
          </div>

          {showOtpInput && (
            <div className="form-group">
              <label htmlFor="otp">Enter OTP</label>
              <div className="otp-input-group">
                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  className="verify-button"
                >
                  Verify OTP
                </button>
              </div>
              <div id="recaptcha-container"></div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              name="address"
              value={userData.address}
              onChange={handleInputChange}
              placeholder="Enter your address"
              rows="3"
            />
          </div>

          <button type="submit" className="submit-button">
            Update Profile
          </button>
        </form>

        <div className="password-change-section">
          <h3><FontAwesomeIcon icon={faLock} /> Change Password</h3>
          <form onSubmit={handlePasswordChange} className="password-form">
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={!isPhoneVerified}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={!isPhoneVerified}
              />
            </div>
            <button
              type="submit"
              className="submit-button"
              disabled={!isPhoneVerified || isChangingPassword}
            >
              {isChangingPassword ? (
                <FontAwesomeIcon icon={faSpinner} spin />
              ) : (
                'Change Password'
              )}
            </button>
            {!isPhoneVerified && (
              <p className="verification-notice">
                Please verify your phone number to change password
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile; 