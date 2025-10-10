import { initializeApp } from 'firebase/app';
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
// Make sure to replace this with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBY4ae3qHqC7DzCABvHcRZ_K-83pK2YWiU",
  authDomain: "computer-based-exam.firebaseapp.com",
  projectId: "computer-based-exam",
  storageBucket: "computer-based-exam.appspot.com",
  messagingSenderId: "40989888025",
  appId: "1:40989888025:web:f8daaf5e1921475ce32488",
  measurementId: "G-196KCD8H68"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- EXPORT EVERYTHING ---
// This is the part that was missing. We now export all the functions
// so that other files can import and use them.
export { 
    app,
    auth, 
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
