import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBPctamWdHhnOMVtd1lGJsho3R6tTQqeFs",
  authDomain: "bionexa-b6b06.firebaseapp.com",
  projectId: "bionexa-b6b06",
  storageBucket: "bionexa-b6b06.firebasestorage.app",
  messagingSenderId: "671216681730",
  appId: "1:671216681730:web:8d98f382036cd44521381b",
  measurementId: "G-V01BCQCXQK"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence for Firestore
try {
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log('Firestore persistence enabled');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all of the features required for persistence');
      } else {
        console.error('Error enabling persistence:', err);
      }
    });
} catch (error) {
  console.warn('Unable to enable persistence:', error);
}

export { auth, analytics, db };