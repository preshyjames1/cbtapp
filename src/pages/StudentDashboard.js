import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { BookOpen, CheckCircle } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';

const StudentDashboard = ({ setPage, setSelectedExam }) => {
    const { currentUser } = useAuth();
    const [exams, setExams] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [isAccessCodeModalOpen, setIsAccessCodeModalOpen] = useState(false);
    const [examToStart, setExamToStart] = useState(null);
    const [enteredCode, setEnteredCode] = useState('');
    const [accessCodeError, setAccessCodeError] = useState('');
    const [activeSessions, setActiveSessions] = useState({});

    useEffect(() => {
        if (!currentUser || !currentUser.className) {
            setLoading(false);
            return; // Don't fetch exams if user has no class
        }

        // --- UPDATED QUERY ---
        // Now fetches exams where the exam's class matches the student's class.
        const examsQuery = query(
            collection(db, "exams"), 
            where("status", "==", "Published"),
            where("className", "==", currentUser.className)
        );
        
        const unsubscribeExams = onSnapshot(examsQuery, (snapshot) => {
            const examList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setExams(examList);
            setLoading(false);
        });
        
        const submissionsQuery = query(collection(db, "submissions"), where("studentId", "==", currentUser.uid));
        const unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
            const subs = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                subs[data.examId] = data;
            });
            setSubmissions(subs);
        });
        
        const sessionsQuery = query(collection(db, "exam_sessions"), where("studentId", "==", currentUser.uid), where("completed", "==", false));
        const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
            const sessions = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                sessions[data.examId] = { id: doc.id, ...data };
            });
            setActiveSessions(sessions);
        });

        return () => {
            unsubscribeExams();
            unsubscribeSubmissions();
            unsubscribeSessions();
        };
    }, [currentUser]);

    const handleStartExamClick = async (exam) => {
        if (activeSessions[exam.id]) {
            setSelectedExam(exam);
            setPage('take-exam');
            return;
        }

        if (exam.useAccessCode) {
            setExamToStart(exam);
            setIsAccessCodeModalOpen(true);
        } else {
            setSelectedExam(exam);
            setPage('instructions');
        }
    };

    const handleAccessCodeSubmit = () => {
        if (enteredCode === examToStart.accessCode) {
            setSelectedExam(examToStart);
            setPage('instructions');
            setIsAccessCodeModalOpen(false);
            setEnteredCode('');
            setAccessCodeError('');
        } else {
            setAccessCodeError('Invalid access code. Please try again.');
        }
    };

    const sortedExams = [...exams].sort((a, b) => {
        const aHasBeenTaken = !!submissions[a.id];
        const bHasBeenTaken = !!submissions[b.id];
        if (aHasBeenTaken === bHasBeenTaken) {
            return (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0);
        }
        return aHasBeenTaken ? 1 : -1;
    });

    // Returns null if exam is open, or a string reason if not
    const getExamWindowStatus = (exam) => {
        // Support both old startDateTime and new windowStart/windowEnd fields
        const start = exam.windowStart?.toDate?.() || exam.startDateTime?.toDate?.() || null;
        const end   = exam.windowEnd?.toDate?.()   || null;
        const now   = new Date();

        if (!start && !end) return null; // no window — always open

        if (start && now < start) {
            return `Opens ${start.toLocaleString()}`;
        }
        if (end && now > end) {
            return 'This exam window has closed';
        }
        return null; // within window — student gets their full duration
    };

    const getWindowLabel = (exam) => {
        const start = exam.windowStart?.toDate?.() || exam.startDateTime?.toDate?.() || null;
        const end   = exam.windowEnd?.toDate?.() || null;
        if (!start && !end) return null;
        const fmt = (d) => d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        if (start && end) return `Window: ${fmt(start)} – ${fmt(end)}`;
        if (start) return `Opens: ${fmt(start)}`;
        if (end)   return `Closes: ${fmt(end)}`;
        return null;
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center"><BookOpen className="mr-3" /> Available Exams for {currentUser.className}</h2>
            {loading ? <Spinner /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedExams.length > 0 ? sortedExams.map(exam => {
                        const submission   = submissions[exam.id];
                        const hasTaken     = !!submission;
                        const windowStatus = getExamWindowStatus(exam);
                        const inProgress   = !!activeSessions[exam.id];
                        return (
                             <div key={exam.id} className={`bg-white p-6 rounded-lg shadow-md ${hasTaken ? 'bg-gray-50 opacity-80' : 'hover:shadow-lg transition-shadow'}`}>
                                <h3 className="text-xl font-bold text-gray-800">{exam.title}</h3>
                                <p className="text-gray-500 mt-1 text-sm">{exam.subjectName || ''}</p>
                                <p className="text-gray-500 mt-1">{exam.questionsToAnswer || exam.questions?.length || 0} Questions · {exam.duration} mins</p>
                                {exam.startDateTime && (
                                    <p className="text-xs text-blue-600 mt-1">
                                        {getWindowLabel(exam) || `Starts: ${(exam.windowStart?.toDate?.() || exam.startDateTime?.toDate?.()).toLocaleString()}`}
                                    </p>
                                )}
                                {hasTaken ? (
                                    <div className="mt-4">
                                        <p className="font-semibold text-green-600 flex items-center"><CheckCircle className="mr-2"/> Completed</p>
                                        <p className="text-gray-600 text-sm">Score: {submission.score} / {submission.totalMarks}
                                            {submission.pct !== undefined && <span className={`ml-2 font-bold ${submission.passed ? 'text-green-600' : 'text-red-500'}`}>({submission.pct}% — {submission.passed ? 'Pass' : 'Fail'})</span>}
                                        </p>
                                    </div>
                                ) : windowStatus ? (
                                    <div className="mt-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 font-medium">
                                        {windowStatus}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleStartExamClick(exam)}
                                        className={`mt-4 w-full text-white font-semibold px-4 py-2 rounded-lg transition duration-300 ${inProgress ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}
                                    >
                                        {inProgress ? 'Resume Exam' : 'Start Exam'}
                                    </button>
                                )}
                            </div>
                        )
                    }) : (
                        <p className="text-gray-500 col-span-full">No exams are currently available for your class.</p>
                    )}
                </div>
            )}
            <Modal isOpen={isAccessCodeModalOpen} onClose={() => setIsAccessCodeModalOpen(false)} title="Enter Access Code">
                <p>This exam requires an access code to begin.</p>
                <input 
                    type="text"
                    value={enteredCode}
                    onChange={(e) => setEnteredCode(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md mt-4"
                    placeholder="Access Code"
                />
                {accessCodeError && <p className="text-red-500 text-sm mt-2">{accessCodeError}</p>}
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={() => setIsAccessCodeModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleAccessCodeSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Submit</button>
                </div>
            </Modal>
        </div>
    );
};

export default StudentDashboard;
