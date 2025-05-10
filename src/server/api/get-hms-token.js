import { HMS } from '@100mslive/server-sdk';

// Initialize HMS with your credentials
const hms = new HMS({
  accessKey: process.env.HMS_ACCESS_KEY,
  secret: process.env.HMS_SECRET,
  appId: process.env.HMS_APP_ID
});

// Template ID from your 100ms dashboard
const TEMPLATE_ID = '67f926338102660b706b5284';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomName, role } = req.query;

    if (!roomName || !role) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Define role configuration based on user type
    const roleConfig = {
      doctor: {
        name: 'doctor',
        permissions: {
          canPublish: true,
          canSubscribe: true,
          canRecord: true,
          canShareScreen: true,
          canEndRoom: true,
          canRemoveParticipants: true,
          canMuteParticipants: true,
          canChangeRole: true
        }
      },
      patient: {
        name: 'patient',
        permissions: {
          canPublish: true,
          canSubscribe: true,
          canShareScreen: true
        }
      }
    };

    // Get or create room
    let room;
    try {
      room = await hms.rooms.get(roomName);
    } catch (error) {
      // If room doesn't exist, create it
      room = await hms.rooms.create({
        name: roomName,
        description: `Appointment room for ${roomName}`,
        template_id: TEMPLATE_ID
      });
    }

    // Generate token
    const token = await hms.tokens.generate({
      roomId: room.id,
      role: roleConfig[role].name,
      userId: `${role}-${Date.now()}`, // Unique user ID
      permissions: roleConfig[role].permissions
    });

    res.status(200).json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
} 