import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db, onAuthStateChanged, signOut, doc, getDoc } from '../services/firebase';
import Spinner from '../components/common/Spinner';

// 1. Create the context
const AuthContext = createContext();

// 2. Create a custom hook for easy access to the context
export const useAuth = () => {
    return useContext(AuthContext);
};

// 3. Create the Provider component
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // This is the authentication logic you CUT from App.js
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    setCurrentUser(userDocSnap.data());
                } else {
                    // Handle case where user exists in Auth but not Firestore
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        // Cleanup subscription on unmount
        return unsubscribe;
    }, []); // Empty array ensures this runs only once on mount

    const logout = () => {
        return signOut(auth);
    };

    // The value object holds what we want to share with the rest of the app
    const value = {
        currentUser,
        logout,
    };

    // Show a loading spinner while checking for user, then show the app
    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="min-h-screen bg-gray-100 flex justify-center items-center">
                    <Spinner />
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};