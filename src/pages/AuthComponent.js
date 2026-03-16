import React, { useState } from 'react';
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, doc, setDoc, getDoc } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, CheckCircle } from 'lucide-react';
import Spinner from '../components/common/Spinner';

// 'view' controls which panel is shown: 'login' | 'signup' | 'forgot'
const AuthComponent = () => {
    const [view, setView]         = useState('login');
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [name, setName]         = useState('');
    const [error, setError]       = useState('');
    const [success, setSuccess]   = useState('');
    const [loading, setLoading]   = useState(false);

    const reset = (nextView) => {
        setError(''); setSuccess('');
        setEmail(''); setPassword(''); setName('');
        setView(nextView);
    };

    // ── Sign In ───────────────────────────────────────────────────────────────
    const handleSignIn = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            const snap = await getDoc(doc(db, 'users', credential.user.uid));
            if (!snap.exists()) {
                setError('No profile found for this account. Contact your administrator.');
                await signOut(auth);
            }
            // AuthContext's onAuthStateChanged handles the rest
        } catch (err) {
            setError(friendlyError(err.code));
        } finally {
            setLoading(false);
        }
    };

    // ── Sign Up ───────────────────────────────────────────────────────────────
    // Note: role is always 'student' — admins & teachers are created by an admin.
    const handleSignUp = async (e) => {
        e.preventDefault();
        if (!name.trim()) { setError('Please enter your full name.'); return; }
        setLoading(true); setError('');
        try {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'users', credential.user.uid), {
                uid:       credential.user.uid,
                email:     credential.user.email,
                name:      name.trim(),
                role:      'student',   // public signup is always student
                createdAt: new Date(),
            });
            // AuthContext picks up the new session automatically
        } catch (err) {
            setError(friendlyError(err.code));
        } finally {
            setLoading(false);
        }
    };

    // ── Forgot Password ───────────────────────────────────────────────────────
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        if (!email) { setError('Please enter your email address.'); return; }
        setLoading(true); setError('');
        try {
            await sendPasswordResetEmail(auth, email);
            setSuccess(`Password reset email sent to ${email}. Check your inbox.`);
        } catch (err) {
            setError(friendlyError(err.code));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">

                {/* Title */}
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
                    {view === 'login'  ? 'Welcome Back'       :
                     view === 'signup' ? 'Create Account'     :
                                        'Reset Password'}
                </h2>
                <p className="text-center text-gray-500 mb-8">
                    {view === 'login'  ? 'Sign in to continue'             :
                     view === 'signup' ? 'Join as a student'               :
                                        'Enter your email to get a reset link'}
                </p>

                {/* Error / Success banners */}
                {error && (
                    <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                        <AlertCircle size={18} /> <span className="text-sm">{error}</span>
                    </div>
                )}
                {success && (
                    <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                        <CheckCircle size={18} /> <span className="text-sm">{success}</span>
                    </div>
                )}

                {/* ── Login Form ── */}
                {view === 'login' && (
                    <form onSubmit={handleSignIn} className="space-y-5">
                        <Field type="email"    value={email}    onChange={e => setEmail(e.target.value)}    placeholder="Email Address" required />
                        <Field type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"      required />
                        <div className="text-right">
                            <button type="button" onClick={() => reset('forgot')} className="text-sm text-blue-600 hover:underline">
                                Forgot password?
                            </button>
                        </div>
                        <SubmitBtn loading={loading} label="Sign In" />
                        <p className="text-center text-sm text-gray-500">
                            Don't have an account?{' '}
                            <button type="button" onClick={() => reset('signup')} className="font-semibold text-blue-600 hover:underline">Sign Up</button>
                        </p>
                    </form>
                )}

                {/* ── Sign Up Form ── */}
                {view === 'signup' && (
                    <form onSubmit={handleSignUp} className="space-y-5">
                        <Field type="text"     value={name}     onChange={e => setName(e.target.value)}     placeholder="Full Name"     required />
                        <Field type="email"    value={email}    onChange={e => setEmail(e.target.value)}    placeholder="Email Address" required />
                        <Field type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 6 chars)" required minLength={6} />
                        <p className="text-xs text-gray-400 -mt-2">
                            Students only. Teachers and admins are added by the administrator.
                        </p>
                        <SubmitBtn loading={loading} label="Create Account" />
                        <p className="text-center text-sm text-gray-500">
                            Already have an account?{' '}
                            <button type="button" onClick={() => reset('login')} className="font-semibold text-blue-600 hover:underline">Sign In</button>
                        </p>
                    </form>
                )}

                {/* ── Forgot Password Form ── */}
                {view === 'forgot' && (
                    <form onSubmit={handleForgotPassword} className="space-y-5">
                        <Field type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your Email Address" required />
                        <SubmitBtn loading={loading} label="Send Reset Link" />
                        <p className="text-center text-sm text-gray-500">
                            Remembered it?{' '}
                            <button type="button" onClick={() => reset('login')} className="font-semibold text-blue-600 hover:underline">Back to Sign In</button>
                        </p>
                    </form>
                )}

            </div>
        </div>
    );
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const Field = (props) => (
    <input {...props} className="w-full px-4 py-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
);

const SubmitBtn = ({ loading, label }) => (
    <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 flex justify-center items-center"
    >
        {loading ? <Spinner /> : label}
    </button>
);

const friendlyError = (code) => {
    const map = {
        'auth/user-not-found':       'No account found with this email.',
        'auth/wrong-password':       'Incorrect password. Please try again.',
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/weak-password':        'Password must be at least 6 characters.',
        'auth/invalid-email':        'Please enter a valid email address.',
        'auth/too-many-requests':    'Too many attempts. Please wait and try again.',
        'auth/invalid-credential':   'Invalid email or password.',
    };
    return map[code] || 'Something went wrong. Please try again.';
};

export default AuthComponent;
