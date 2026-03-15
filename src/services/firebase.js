import { initializeApp, getApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    onSnapshot,
    getDocs,
    deleteDoc,
    writeBatch,
    updateDoc,
    orderBy,
    Timestamp
} from 'firebase/firestore';

// --- Firebase Configuration ---
// Values are loaded from the .env file (see .env.example).
// Never hardcode credentials here — they would be exposed in your public git repo.
const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId:     process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Secondary app for admin user creation ---
// Using a secondary Firebase app instance prevents createUserWithEmailAndPassword
// from signing in the new user and logging out the current admin session.
let secondaryAuth;
try {
    const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
    secondaryAuth = getAuth(secondaryApp);
} catch (e) {
    // 'Secondary' app already exists (e.g. hot module reload) — reuse it
    secondaryAuth = getAuth(getApp('Secondary'));
}

// --- EXPORT EVERYTHING ---
// This is the part that was missing. We now export all the functions
// so that other files can import and use them.
export { 
    app,
    auth,
    secondaryAuth,
    db,
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    onSnapshot,
    getDocs,
    deleteDoc,
    writeBatch,
    updateDoc,
    orderBy,
    Timestamp 
};
