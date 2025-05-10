import React, { useEffect, useState } from 'react';
import {
  useHMSStore,
  selectLocalPeer,
  selectPeers,
  useHMSActions,
} from '@100mslive/react-sdk';
import { Button } from '@100mslive/react-ui';
import { toast } from 'react-hot-toast';

const VideoRoom = ({ roomId, role, token }) => {
  const [isConnected, setIsConnected] = useState(false);
  const localPeer = useHMSStore(selectLocalPeer);
  const peers = useHMSStore(selectPeers);
  const hmsActions = useHMSActions();

  useEffect(() => {
    const setupRoom = async () => {
      try {
        await hmsActions.join({
          authToken: token,
          userName: role === 'doctor' ? 'Dr. Smith' : 'Patient',
          settings: {
            isAudioMuted: false,
            isVideoMuted: false,
          },
        });
        setIsConnected(true);
      } catch (error) {
        console.error('Error joining room:', error);
        toast.error('Failed to join the video room');
      }
    };

    if (roomId && token) {
      setupRoom();
    }

    return () => {
      hmsActions.leave();
    };
  }, [roomId, token, role, hmsActions]);

  const toggleAudio = () => {
    hmsActions.setLocalAudioEnabled(!localPeer?.isAudioEnabled);
  };

  const toggleVideo = () => {
    hmsActions.setLocalVideoEnabled(!localPeer?.isVideoEnabled);
  };

  const leaveRoom = () => {
    hmsActions.leave();
    setIsConnected(false);
  };

  if (!isConnected) {
    return <div>Connecting to room...</div>;
  }

  return (
    <div className="video-room">
      <div className="video-grid">
        {/* Local video */}
        <div className="video-container">
          <video
            ref={(video) => {
              if (video && localPeer) {
                hmsActions.attachVideo(localPeer.videoTrack, video);
              }
            }}
            autoPlay
            muted
            playsInline
          />
          <div className="participant-name">You ({role})</div>
        </div>

        {/* Remote participants */}
        {peers.map((peer) => (
          <div key={peer.id} className="video-container">
            <video
              ref={(video) => {
                if (video && peer.videoTrack) {
                  hmsActions.attachVideo(peer.videoTrack, video);
                }
              }}
              autoPlay
              playsInline
            />
            <div className="participant-name">
              {peer.name} ({peer.roleName})
            </div>
          </div>
        ))}
      </div>

      <div className="controls">
        <Button onClick={toggleAudio}>
          {localPeer?.isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        </Button>
        <Button onClick={toggleVideo}>
          {localPeer?.isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
        </Button>
        <Button onClick={leaveRoom} variant="danger">
          Leave Room
        </Button>
      </div>
    </div>
  );
};

export default VideoRoom; 