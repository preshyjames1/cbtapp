import React, { useState } from 'react';
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, doc, setDoc, getDoc } from '../services/firebase';
import { AlertCircle } from 'lucide-react';
import Spinner from '../components/common/Spinner';

const AuthComponent = ({ setcurrentUser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [role, setRole] = useState('student');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            let userCredential;
            if (isSignUp) {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const userDocRef = doc(db, "users", user.uid);
                const newUserProfile = {
                    uid: user.uid,
                    email: user.email,
                    role: role,
                    createdAt: new Date()
                };
                await setDoc(userDocRef, newUserProfile);
                setcurrentUser(newUserProfile);
            } else {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    setcurrentUser(userDocSnap.data());
                } else {
                    setError("No user profile found. Please contact an admin.");
                    await signOut(auth);
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
                    {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-center text-gray-500 mb-8">
                    {isSignUp ? 'Join the Online Exam Platform' : 'Sign in to continue'}
                </p>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleAuthAction}>
                    <div className="space-y-6">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email Address"
                            required
                            className="w-full px-4 py-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                            className="w-full px-4 py-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {isSignUp && (
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="admin">Admin</option>
                            </select>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-blue-300 flex justify-center items-center"
                    >
                        {loading ? <Spinner /> : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-8">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError('');
                        }}
                        className="font-semibold text-blue-600 hover:underline ml-1"
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
            </div>
        </div>
    );
};
export default AuthComponent;