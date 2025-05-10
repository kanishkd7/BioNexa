import React, { useEffect, useState, useRef, useReducer } from 'react';
import { HMSReactiveStore } from '@100mslive/hms-video-store';
import { 
  selectIsConnectedToRoom, 
  selectLocalPeerID,
  selectIsLocalAudioEnabled,
  selectIsLocalVideoEnabled,
  selectPeers,
  selectLocalPeer,
  selectIsPeerAudioEnabled,
  selectIsPeerVideoEnabled,
  selectPeerByID
} from '@100mslive/hms-video-store';
import './HMSMeet.css';

// Simple component to show content after a delay if a condition is met
const ShowAfterDelay = ({ delay, children, condition = true }) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!condition) {
      setShowContent(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setShowContent(true);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [delay, condition]);

  return showContent ? children : null;
};

const hmsManager = new HMSReactiveStore();
const hmsStore = hmsManager.getStore();
const hmsActions = hmsManager.getActions();

// Direct Camera Preview component that bypasses HMS SDK
const DirectCameraPreview = ({ isVisible, isMirrored = true }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [manuallyDisabled, setManuallyDisabled] = useState(false);
  const [trackPublished, setTrackPublished] = useState(false);
  
  // Start camera directly using browser APIs with simple error handling
  const startCamera = async () => {
    try {
      if (manuallyDisabled) {
        console.log("Not starting camera because user manually disabled it");
        return;
      }

      // First check permissions
      const permissions = await navigator.permissions.query({ name: 'camera' });
      if (permissions.state === 'denied') {
        throw new Error('Camera permission was denied. Please enable it in your browser settings.');
      }
      
      // Close any existing streams
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      console.log("Starting direct camera preview");
      
      // Try with basic constraints first
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setHasCamera(true);
        setErrorMsg('');
        
        window._directMediaStream = mediaStream;
        
        const videoTrack = mediaStream.getVideoTracks()[0];
        console.log("Camera accessed:", videoTrack.label);
        console.log("Camera settings:", videoTrack.getSettings());
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setErrorMsg(`Camera error: ${err.message}. Please check your camera permissions.`);
      setHasCamera(false);
    }
  };
  
  const stopCamera = async () => {
    if (stream) {
      console.log("Stopping camera preview stream");
      
      try {
        // If we published this track, try to disable video
        if (trackPublished) {
          console.log("Turning off HMS video because direct camera is being stopped");
          await hmsActions.setLocalVideoEnabled(false);
          setTrackPublished(false);
        }
      } catch (err) {
        console.error("Error disabling HMS video:", err);
      }
      
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setHasCamera(false);
    
    // Set flag when user explicitly stops camera
    setManuallyDisabled(true);
  };
  
  // Watch for room connection state to publish camera when connected
  useEffect(() => {
    const connectionSubscription = hmsStore.subscribe(selectIsConnectedToRoom, async () => {
      const isConnected = hmsStore.getState(selectIsConnectedToRoom);
      
      // If we just connected and have a camera stream that's not published yet
      if (isConnected && hasCamera && stream && !trackPublished) {
        try {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            console.log("Connection detected, publishing preview camera");
            await hmsActions.replaceLocalVideoTrack(videoTrack);
            setTrackPublished(true);
          }
        } catch (err) {
          console.error("Failed to publish camera after connection:", err);
        }
      }
    });
    
    return () => connectionSubscription();
  }, [hasCamera, stream, trackPublished]);
  
  // Start/stop camera based on visibility and HMS video state
  useEffect(() => {
    if (isVisible && !manuallyDisabled) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => stopCamera();
  }, [isVisible, manuallyDisabled]);
  
  // Sync with HMS video state
  useEffect(() => {
    const subscription = hmsStore.subscribe(selectIsLocalVideoEnabled, () => {
      const isVideoEnabled = hmsStore.getState(selectIsLocalVideoEnabled);
      
      if (!isVideoEnabled && hasCamera) {
        // When HMS video is turned off, stop the camera and mark as manually disabled
        console.log("Stopping preview camera because HMS video was disabled");
        stopCamera();
      } else if (isVideoEnabled && !hasCamera && !manuallyDisabled) {
        // When HMS video is turned on, start the camera if not manually disabled
        console.log("Starting preview camera because HMS video was enabled");
        setManuallyDisabled(false); // Clear the flag
        startCamera();
      }
    });
    
    return () => subscription();
  }, [hasCamera, manuallyDisabled]);
  
  // Start camera immediately when component mounts - ensures we display something
  useEffect(() => {
    if (isVisible) {
      console.log("DirectCameraPreview is now visible, starting camera immediately");
      startCamera();
    }
  }, [isVisible]);

  // Add styles to make the component more visible/prominent
  const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80%',
    maxWidth: '640px',
    height: '60%',
    maxHeight: '480px',
    backgroundColor: '#000',
    zIndex: 1000,
    borderRadius: '8px',
    boxShadow: '0 0 30px rgba(0, 0, 0, 0.5)',
    border: '2px solid #2196f3',
    overflow: 'hidden',
  };

  if (!isVisible) return null;
  
  return (
    <div className="direct-camera-preview" style={isVisible ? style : undefined}>
      {hasCamera ? (
        <>
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
          <div style={{position: 'absolute', bottom: '10px', left: '10px', padding: '5px 10px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: '5px', fontSize: '14px'}}>
            Direct Camera Preview (100ms SDK is having issues)
          </div>
          <div style={{position: 'absolute', top: '10px', right: '10px', padding: '5px 10px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', borderRadius: '5px', fontSize: '12px'}}>
            Camera Active: {hasCamera ? 'Yes' : 'No'}<br/>
            Track Published: {trackPublished ? 'Yes' : 'No'}<br/>
            Camera Status: {stream ? 'Stream Active' : 'No Stream'}
          </div>
          <button 
            className="camera-stop-btn"
            onClick={stopCamera}
            title="Turn off camera"
          >
            <i className="fas fa-video-slash"></i>
          </button>
        </>
      ) : (
        <div className="camera-error">
          <i className="fas fa-video-slash"></i>
          <p>{errorMsg || (manuallyDisabled ? "Camera turned off" : "Camera not available")}</p>
          <button onClick={() => {
            setManuallyDisabled(false);
            startCamera();
          }}>
            {manuallyDisabled ? "Turn On" : "Retry"}
          </button>
          <div style={{marginTop: '10px', fontSize: '12px', color: '#aaa'}}>
            <p>Troubleshooting Tips:</p>
            <ul style={{textAlign: 'left', marginTop: '5px'}}>
              <li>Ensure camera permissions are granted in browser settings</li>
              <li>Close other applications using your camera</li>
              <li>Try refreshing the page</li>
              <li>Check if camera is working in other applications</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Peer Video component that handles video rendering
const PeerVideo = ({ peer }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [videoAttached, setVideoAttached] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [attachmentAttempts, setAttachmentAttempts] = useState(0);

  // Function to get a display name character for avatar
  const getAvatarColor = () => {
    const colors = ['#2196f3', '#ff9800', '#f44336', '#4caf50', '#9c27b0', '#00bcd4'];
    const nameHash = peer.name ? peer.name.charCodeAt(0) % colors.length : 0;
    return colors[nameHash];
  };

  // Get peer role for display
  const getPeerRole = () => {
    if (peer.roleName) {
      return peer.roleName.charAt(0).toUpperCase() + peer.roleName.slice(1);
    }
    return peer.isLocal ? 'You' : 'Guest';
  };

  // Fallback direct camera method for local peer when HMS SDK attachment fails
  const tryDirectCamera = async () => {
    if (!peer.isLocal || !videoRef.current) return false;
    
    try {
      console.log("Attempting direct camera access as fallback");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 },
        audio: false 
      });
      
      videoRef.current.srcObject = stream;
      videoRef.current.style.display = 'block';
      setVideoAttached(true);
      console.log("Direct camera fallback successful");
      return true;
    } catch (err) {
      console.error("Direct camera fallback failed:", err);
      return false;
    }
  };

  // Attach video using HMS SDK with fallbacks
  const attachVideo = async () => {
    if (!videoRef.current || !peer) return false;
    
    try {
      console.log(`Attaching video for peer ${peer.id}`);
      
      // Check if peer has a video track
      if (peer.videoTrack) {
        // Use the correct method to attach the video track
        await hmsActions.attachVideo(peer.videoTrack, videoRef.current);
        console.log(`Successfully attached video for peer ${peer.id}`);
        setVideoAttached(true);
        
        // Set a backup check to verify video is actually playing
        setTimeout(() => {
          if (videoRef.current && !videoRef.current.srcObject) {
            console.log(`Video not attached properly for peer ${peer.id}, retrying...`);
            hmsActions.attachVideo(peer.videoTrack, videoRef.current)
              .catch(err => console.error(`Retry attachment failed for peer ${peer.id}:`, err));
          } else {
            console.log(`Video confirmed active for peer ${peer.id}`);
          }
        }, 1000);
        
        return true;
      } else {
        console.log(`Peer ${peer.id} has no video track available`);
        return false;
      }
    } catch (err) {
      console.error(`Error attaching video for peer ${peer.id}:`, err);
      return false;
    }
  };

  // Try to attach video when component mounts or when peer changes
  useEffect(() => {
    // Try to attach video when component mounts or when peer changes
    const attachVideoAndMonitor = async () => {
      try {
        // First attempt to attach video
        const success = await attachVideo();
        if (!success && attachmentAttempts < 3) {
          console.log(`Scheduling retry for peer ${peer.id}, attempt ${attachmentAttempts + 1}`);
          
          // Schedule a retry after a delay
          setTimeout(() => {
            setAttachmentAttempts(prev => prev + 1);
            attachVideo();
          }, 2000);
        }
      } catch (err) {
        console.error(`Error in video attachment effect for peer ${peer?.id}:`, err);
      }
    };
    
    attachVideoAndMonitor();
    
    // Update video enabled status
    const updateVideoState = () => {
      if (peer) {
        try {
          if (peer.isLocal) {
            // For local peer, get state from HMS store
            setIsVideoEnabled(hmsStore.getState(selectIsLocalVideoEnabled));
          } else {
            // For remote peer, use the peer's video enabled status
            setIsVideoEnabled(hmsStore.getState(selectIsPeerVideoEnabled(peer.id)));
          }
        } catch (err) {
          console.error(`Error getting video state for peer ${peer.id}:`, err);
        }
      }
    };
    
    // Set up initial state
    updateVideoState();
    
    // Set up subscriptions to monitor changes
    const subscriptions = [];
    
    if (peer) {
      if (peer.isLocal) {
        // For local peer, subscribe to local video state changes
        subscriptions.push(
          hmsStore.subscribe(selectIsLocalVideoEnabled, () => {
            updateVideoState();
          })
        );
      } else {
        // For remote peers, subscribe to that peer's video state changes
        subscriptions.push(
          hmsStore.subscribe(selectIsPeerVideoEnabled(peer.id), () => {
            updateVideoState();
            // When a remote peer's video state changes, try to reattach the video
            if (hmsStore.getState(selectIsPeerVideoEnabled(peer.id))) {
              console.log(`Remote peer ${peer.id} video enabled, trying to attach`);
              setTimeout(() => attachVideo(), 1000);
            }
          })
        );
        
        // Also subscribe to changes in the peer's video track
        subscriptions.push(
          hmsStore.subscribe(selectPeerByID(peer.id), () => {
            const updatedPeer = hmsStore.getState(selectPeerByID(peer.id));
            if (updatedPeer && updatedPeer.videoTrack) {
              console.log(`Peer ${peer.id} video track updated, reattaching`);
              setTimeout(() => attachVideo(), 500);
            }
          })
        );
      }
    }
    
    // Clean up subscriptions
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [peer, attachmentAttempts]);

  // Update audio enabled state
  useEffect(() => {
    setIsAudioEnabled(hmsStore.getState(selectIsPeerAudioEnabled(peer.id)));
    
    const audioSubscription = hmsStore.subscribe(selectIsPeerAudioEnabled(peer.id), () => {
      setIsAudioEnabled(hmsStore.getState(selectIsPeerAudioEnabled(peer.id)));
    });

    return () => {
      audioSubscription();
    };
  }, [peer.id]);

  // Add click-to-play fallback for video element
  useEffect(() => {
    if (videoRef.current) {
      const handleClick = () => {
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(err => {
            console.warn("Play on click failed:", err);
          });
        }
      };
      
      videoRef.current.addEventListener('click', handleClick);
      
      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('click', handleClick);
        }
      };
    }
  }, [videoRef.current]);
  
  return (
    <div className="peer-container" ref={containerRef}>
      <div className="peer-video-container">
        <video 
          ref={videoRef}
          className="peer-video"
          autoPlay
          playsInline
          muted={peer.isLocal}
        />
        
        {(!isVideoEnabled || !videoAttached) && (
          <div className="video-off-indicator">
            <div className="avatar" style={{ backgroundColor: getAvatarColor() }}>
              {peer.name ? peer.name[0].toUpperCase() : '?'}
            </div>
          </div>
        )}
      </div>
      
      <div className="peer-info">
        <div className="peer-details">
          <p className="peer-name">
            {peer.name || 'Guest'} {peer.isLocal && '(You)'}
          </p>
          <span className="peer-role">{getPeerRole()}</span>
        </div>
        <div className="peer-audio-indicator">
          <i className={`fas fa-${isAudioEnabled ? 'microphone' : 'microphone-slash'}`}></i>
        </div>
      </div>
    </div>
  );
};

const VideoCall = ({ appointment, onClose, role }) => {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(hmsStore.getState(selectIsConnectedToRoom));
  const [isLocalAudioEnabled, setIsLocalAudioEnabled] = useState(hmsStore.getState(selectIsLocalAudioEnabled));
  const [isLocalVideoEnabled, setIsLocalVideoEnabled] = useState(hmsStore.getState(selectIsLocalVideoEnabled));
  const [peers, setPeers] = useState([]);
  const [uniquePeers, setUniquePeers] = useState([]);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [userDisabledCamera, setUserDisabledCamera] = useState(false);
  const localPeerId = hmsStore.getState(selectLocalPeerID);
  
  // Add forceUpdate helper function to force component re-render
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Debug flag to help troubleshoot rendering issues
  const [debugMode, setDebugMode] = useState(false);
  
  // Determine if we should show direct camera due to issues with HMS
  const shouldShowDirectCamera = 
    window._forceDirectCamera || 
    (!isConnected && error) ||
    (debugMode);
  
  // Added to help with debugging camera issues
  const toggleDebugMode = () => {
    console.log("Toggling camera debug mode");
    setDebugMode(!debugMode);
  };

  // Fetch HMS token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        console.log('Fetching token for room:', appointment.id);
        const url = new URL('http://localhost:5000/api/hms/get-hms-token');
        url.searchParams.append('roomName', appointment.id);
        url.searchParams.append('role', role === 'doctor' ? 'host' : 'guest');

        console.log('Making request to:', url.toString());
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const text = await response.text();
          console.error('Token fetch failed:', {
            status: response.status,
            statusText: response.statusText,
            body: text
          });
          throw new Error(`Failed to fetch token: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Token response:', {
          success: data.success,
          hasToken: !!data.token,
          roomId: data.roomId
        });
        
        if (!data.success || !data.token) {
          throw new Error('Invalid token response');
        }
        
        console.log('Token fetched successfully');
        setToken(data.token);
        setError(null); // Clear any previous errors
      } catch (error) {
        console.error('Error fetching token:', error);
        setError(`Failed to get video token: ${error.message}`);
        setToken(null);
      }
    };
    
    fetchToken();
  }, [appointment.id, role]);

  // Join HMS room when token is available
  useEffect(() => {
    if (token) {
      const joinRoom = async () => {
        try {
          if (!token) {
            throw new Error('No token available');
          }

          console.log('Initializing video...');
          
          // Request camera permission first
          const hasPermission = await requestCameraPermission();
          if (!hasPermission) {
            console.log('Falling back to direct camera mode due to permission issue');
            window._forceDirectCamera = true;
            forceUpdate();
            return;
          }

          // Initialize HMS with proper error handling
          try {
            console.log('Joining HMS room with token:', token.substring(0, 20) + '...');
            
            await hmsActions.join({
              userName: role === 'doctor' ? 'Doctor' : 'Patient',
              authToken: token,
              settings: {
                isAudioMuted: true,
                isVideoMuted: false,
                initialVideoState: true
              },
              rememberDeviceSelection: true,
              captureNetworkQualityInPreview: true
            });

            console.log('Successfully joined video call');
            setError('');
            
            // Force update connection state
            setIsConnected(true);
            
            // Enable video after joining
            setTimeout(async () => {
              try {
                await hmsActions.setLocalVideoEnabled(true);
              } catch (err) {
                console.error('Error enabling video after join:', err);
              }
            }, 1000);
            
          } catch (hmsError) {
            console.error('HMS join error:', hmsError);
            throw new Error(`Failed to join HMS room: ${hmsError.message}`);
          }
        } catch (err) {
          console.error('Error joining room:', err);
          setError(err.message);
          setIsConnected(false);
          
          // If HMS fails, try direct camera mode
          window._forceDirectCamera = true;
          forceUpdate();
        }
      };
      
      joinRoom();
      
      // Clean up function to leave the room when component unmounts
      return () => {
        if (hmsStore.getState(selectIsConnectedToRoom)) {
          console.log("Leaving HMS room on cleanup");
          hmsActions.leave().catch(err => {
            console.error("Error leaving room:", err);
          });
        }
        
        // Clean up direct media stream if it exists
        if (window._directMediaStream) {
          window._directMediaStream.getTracks().forEach(track => track.stop());
          delete window._directMediaStream;
        }
      };
    }
  }, [token, appointment, role]);

  // Handle video toggle
  const handleVideoToggle = async () => {
    try {
      // If turning off video, set the flag that user explicitly disabled it
      if (isLocalVideoEnabled) {
        console.log("User explicitly disabled camera");
        setUserDisabledCamera(true);
        await hmsActions.setLocalVideoEnabled(false);
      } else {
        // If turning on, clear the flag and do a more complete restart
        console.log("User explicitly enabled camera");
        setUserDisabledCamera(false);
        
        // First enable the video track
        await hmsActions.setLocalVideoEnabled(true);
        
        // Then ensure it's properly published by getting a fresh track
        setTimeout(async () => {
          try {
            // Get fresh camera access
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: true,
              audio: false 
            });
            
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              console.log("Replacing video track to ensure proper publishing");
              await hmsActions.replaceLocalVideoTrack(videoTrack);
            }
          } catch (err) {
            console.error("Error replacing video track:", err);
          }
        }, 500);
      }
    } catch (err) {
      console.error("Error toggling video:", err);
    }
  };

  // List available cameras
  useEffect(() => {
    const listDevices = async () => {
      try {
        const devices = await hmsActions.getDevices();
        const videoDevices = devices.videoInput;
        console.log("Available video devices:", videoDevices);
        setCameraDevices(videoDevices);
        
        // Select the first camera as default if available
        if (videoDevices.length > 0 && !selectedCameraId) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Error listing devices:", err);
      }
    };
    
    if (isConnected) {
      listDevices();
    }
  }, [isConnected, selectedCameraId]);

  // Switch camera when selected camera changes
  useEffect(() => {
    const switchCamera = async () => {
      if (!selectedCameraId || !isConnected || !isLocalVideoEnabled) return;
      
      try {
        setIsCameraLoading(true);
        console.log("Switching to camera:", selectedCameraId);
        
        await hmsActions.setVideoSettings({
          deviceId: selectedCameraId
        });
        
        console.log("Camera switched successfully");
      } catch (err) {
        console.error("Error switching camera:", err);
      } finally {
        setIsCameraLoading(false);
      }
    };
    
    switchCamera();
  }, [selectedCameraId, isConnected, isLocalVideoEnabled]);

  // Set up HMS store subscriptions
  useEffect(() => {
    console.log('Setting up HMS store subscriptions');
    
    const subscriptions = [
      hmsStore.subscribe(selectIsLocalVideoEnabled, () => {
        const videoEnabled = hmsStore.getState(selectIsLocalVideoEnabled);
        console.log('Local video state changed:', videoEnabled);
        setIsLocalVideoEnabled(videoEnabled);
      }),
      
      hmsStore.subscribe(selectIsConnectedToRoom, () => {
        const connected = hmsStore.getState(selectIsConnectedToRoom);
        console.log('Connection state changed:', connected);
        setIsConnected(connected);
      }),
      
      hmsStore.subscribe(selectPeers, () => {
        const peersList = hmsStore.getState(selectPeers);
        console.log('Peers list changed:', peersList);
        setPeers(peersList);
      }),

      hmsStore.subscribe(selectIsLocalAudioEnabled, () => {
        const audioEnabled = hmsStore.getState(selectIsLocalAudioEnabled);
        console.log('Local audio state changed:', audioEnabled);
        setIsLocalAudioEnabled(audioEnabled);
      })
    ];
    
    // Initial state setup
    setIsConnected(hmsStore.getState(selectIsConnectedToRoom));
    setIsLocalVideoEnabled(hmsStore.getState(selectIsLocalVideoEnabled));
    setIsLocalAudioEnabled(hmsStore.getState(selectIsLocalAudioEnabled));
    setPeers(hmsStore.getState(selectPeers));
    
    // Cleanup subscriptions
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
      
      // Cleanup HMS connection on unmount
      if (hmsStore.getState(selectIsConnectedToRoom)) {
        hmsActions.leave().catch(console.error);
      }
    };
  }, []);

  // Process peers for UI display
  useEffect(() => {
    if (!peers.length) {
      setUniquePeers([]);
      return;
    }
    
    // Filter out duplicate peers and ensure we show the local peer first
    const localPeer = peers.find(p => p.isLocal);
    const remotePeers = peers.filter(p => !p.isLocal);
    
    // Create final list with local peer first, then remote peers
    const finalPeersList = localPeer ? [localPeer, ...remotePeers] : remotePeers;
    
    console.log("Updated peers list:", finalPeersList.map(p => ({ 
      id: p.id, 
      name: p.name, 
      isLocal: p.isLocal,
      hasVideo: !!p.videoTrack
    })));
    
    setUniquePeers(finalPeersList);
  }, [peers]);

  // Add code to detect 100ms issues and switch to direct camera mode automatically
  useEffect(() => {
    if (!isConnected || !isLocalVideoEnabled) return;
    
    const checkHmsVideoWorking = () => {
      const localPeer = peers.find(p => p.isLocal);
      console.log("Checking if HMS video is working...", {
        hasLocalPeer: !!localPeer,
        hasVideoTrack: localPeer ? !!localPeer.videoTrack : false,
        videoEnabled: isLocalVideoEnabled
      });
      
      if (isLocalVideoEnabled && (!localPeer || !localPeer.videoTrack)) {
        console.log("HMS video not working - switching to direct camera mode");
        window._forceDirectCamera = true;
        forceUpdate();
      }
      
      // Log all peers and their video tracks for debugging
      if (peers.length > 0) {
        console.log("Current peers and video status:", peers.map(p => ({
          id: p.id,
          name: p.name,
          isLocal: p.isLocal,
          role: p.roleName,
          hasVideoTrack: !!p.videoTrack,
          videoTrackId: p.videoTrack ? p.videoTrack.id : null,
          videoEnabled: p.isLocal 
            ? hmsStore.getState(selectIsLocalVideoEnabled)
            : hmsStore.getState(selectIsPeerVideoEnabled(p.id))
        })));
      }
    };
    
    // Check immediately and periodically
    checkHmsVideoWorking();
    const checkInterval = setInterval(checkHmsVideoWorking, 5000);
    
    return () => clearInterval(checkInterval);
  }, [isConnected, isLocalVideoEnabled, peers]);
  
  const requestCameraPermission = async () => {
    try {
      // First check if permissions are already granted
      const permissions = await navigator.permissions.query({ name: 'camera' });
      if (permissions.state === 'denied') {
        throw new Error('Camera permission was denied. Please enable it in your browser settings.');
      }

      // Request camera access with lower quality first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 }
        },
        audio: true
      });

      // Clean up test stream
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error('Camera permission error:', err);
      setError(`Camera access error: ${err.message}. Please check your camera permissions and try again.`);
      return false;
    }
  };

  return (
    <div className="hms-meet-container">
      <div className="hms-header">
        <h2>Video Consultation</h2>
        {error && <div className="error-message">{error}</div>}
        {/* Add a debug button to help with troubleshooting */}
        <div className="header-controls">
          <button 
            onClick={toggleDebugMode} 
            className="debug-btn"
            style={{ background: 'transparent', color: '#999', border: '1px solid #666', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
            {debugMode ? 'Hide Direct Camera' : 'Try Direct Camera'}
          </button>
          <button 
            onClick={onClose}
            className="close-call-btn"
            style={{ 
              background: 'rgba(220, 38, 38, 0.8)', 
              color: 'white', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '4px', 
              fontSize: '14px',
              marginLeft: '10px',
              cursor: 'pointer'
            }}>
            End Call
          </button>
        </div>
      </div>
      
      {/* Show direct camera preview when needed */}
      {shouldShowDirectCamera && (
        <DirectCameraPreview 
          isVisible={true}
          isMirrored={true}
        />
      )}
      
      {/* Only show the HMS video grid if we're not in direct camera mode */}
      {!shouldShowDirectCamera && (
        <div className="hms-video-container">
          {!isConnected ? (
            <div className="hms-connecting">
              <div className="connecting-spinner"></div>
              <p>Connecting to video call...</p>
              <p className="connecting-tip">Once connected, you can turn on your camera and microphone.</p>
            </div>
          ) : (
            <div className="hms-video-grid">
              {uniquePeers.length > 0 ? (
                uniquePeers.map(peer => (
                  <PeerVideo key={peer.id} peer={peer} />
                ))
              ) : (
                <div className="empty-room-message">
                  <div className="waiting-message">
                    <i className="fas fa-users"></i>
                    <p>Waiting for others to join...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="hms-controls">
        <button 
          className={`control-btn ${!isLocalAudioEnabled ? 'muted' : ''}`}
          onClick={async () => {
            try {
              await hmsActions.setLocalAudioEnabled(!isLocalAudioEnabled);
            } catch (err) {
              console.error("Error toggling audio:", err);
            }
          }}
        >
          <i className={`fas fa-${isLocalAudioEnabled ? 'microphone' : 'microphone-slash'}`}></i>
          {isLocalAudioEnabled ? 'Mute' : 'Unmute'}
        </button>
        
        <button 
          className={`control-btn ${!isLocalVideoEnabled ? 'muted' : ''}`}
          onClick={handleVideoToggle}
        >
          <i className={`fas fa-${isLocalVideoEnabled ? 'video' : 'video-slash'}`}></i>
          {isLocalVideoEnabled ? 'Stop Video' : 'Start Video'}
        </button>

        {/* Add a dedicated refresh button for video tracks */}
        <button 
          className="control-btn"
          onClick={async () => {
            try {
              console.log("Manual video refresh requested");
              // Temporarily disable video
              await hmsActions.setLocalVideoEnabled(false);
              
              // Short delay
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Get fresh camera access
              const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true,
                audio: false 
              });
              
              const videoTrack = stream.getVideoTracks()[0];
              if (videoTrack) {
                // Replace the track
                await hmsActions.replaceLocalVideoTrack(videoTrack);
                
                // Re-enable video
                await hmsActions.setLocalVideoEnabled(true);
                console.log("Video manually refreshed successfully");
              }
            } catch (err) {
              console.error("Error refreshing video:", err);
            }
          }}
        >
          <i className="fas fa-sync-alt"></i>
          Refresh Video
        </button>
        
        {cameraDevices.length > 1 && (
          <div className="camera-selector">
            <select 
              value={selectedCameraId || ''} 
              onChange={(e) => setSelectedCameraId(e.target.value)}
              disabled={isCameraLoading || !isLocalVideoEnabled}
            >
              {cameraDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.substr(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Add buttons for troubleshooting */}
        <button 
          className="control-btn"
          onClick={async () => {
            try {
              console.log("Manual camera republish requested");
              // First try to get a fresh camera stream
              const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 },
                audio: false 
              });
              
              const videoTrack = stream.getVideoTracks()[0];
              if (videoTrack) {
                // Temporarily disable video
                await hmsActions.setLocalVideoEnabled(false);
                
                // Short delay
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Set the new track
                await hmsActions.setVideoSettings({
                  track: videoTrack
                });
                
                // Re-enable video
                await hmsActions.setLocalVideoEnabled(true);
                console.log("Video manually republished successfully");
              }
            } catch (err) {
              console.error("Error republishing camera:", err);
            }
          }}
        >
          <i className="fas fa-sync"></i>
          Republish
        </button>
        
        {/* Direct camera button */}
        <button 
          className={`control-btn ${window._forceDirectCamera ? 'muted' : ''}`}
          onClick={() => {
            window._forceDirectCamera = !window._forceDirectCamera;
            forceUpdate();
          }}
        >
          <i className="fas fa-webcam"></i>
          {window._forceDirectCamera ? "HMS View" : "Direct Camera"}
        </button>
        
        <button 
          className="control-btn end-call"
          onClick={async () => {
            try {
              await hmsActions.leave();
              onClose();
            } catch (err) {
              console.error("Error leaving room:", err);
              onClose(); // Force close even if HMS SDK fails
            }
          }}
        >
          <i className="fas fa-phone-slash"></i>
          End Call
        </button>
      </div>
    </div>
  );
};

export default VideoCall; 