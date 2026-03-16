import { useAuth } from '../context/AuthContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db, addDoc, collection, doc, setDoc, updateDoc, query, where, getDocs } from '../services/firebase';
import { CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';

const TakeExam = ({ exam, setPage }) => {
    const { currentUser } = useAuth();

    // ── Core state ────────────────────────────────────────────────────────────
    const [shuffledExam,         setShuffledExam]         = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers,              setAnswers]              = useState([]);
    const [timeLeft,             setTimeLeft]             = useState(exam.duration * 60);
    const [sessionId,            setSessionId]            = useState(null);

    // ── UI state ──────────────────────────────────────────────────────────────
    const [isFinished,        setIsFinished]        = useState(false);
    const [isSubmitting,      setIsSubmitting]       = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [result,            setResult]            = useState(null);

    // ── Anti-cheat state ──────────────────────────────────────────────────────
    const maxTabSwitches   = exam.maxTabSwitches   ?? 3;
    const allowTabSwitch   = exam.allowTabSwitch   ?? false;
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [showWarning,    setShowWarning]    = useState(false);
    const [warningMessage, setWarningMessage] = useState('');

    // Stable refs
    const submitRef     = useRef(null);
    const answersRef    = useRef(answers);
    const timeLeftRef   = useRef(timeLeft);
    const tabCountRef   = useRef(tabSwitchCount);
    const sessionIdRef  = useRef(sessionId);

    useEffect(() => { answersRef.current  = answers;       }, [answers]);
    useEffect(() => { timeLeftRef.current = timeLeft;      }, [timeLeft]);
    useEffect(() => { tabCountRef.current = tabSwitchCount;}, [tabSwitchCount]);
    useEffect(() => { sessionIdRef.current = sessionId;    }, [sessionId]);

    // ── 1. Build / restore shuffled exam & session ────────────────────────────
    useEffect(() => {
        if (!exam || !currentUser) return;
        const init = async () => {
            const sessQ = query(
                collection(db, 'exam_sessions'),
                where('examId',    '==', exam.id),
                where('studentId', '==', currentUser.uid),
                where('completed', '==', false)
            );
            const sessSnap = await getDocs(sessQ);

            if (!sessSnap.empty) {
                const sesData = sessSnap.docs[0].data();
                // Check if saved time has elapsed since last save
                const savedAt   = sesData.savedAt?.toDate?.() || new Date();
                const elapsed   = Math.floor((Date.now() - savedAt.getTime()) / 1000);
                const remaining = Math.max(0, (sesData.timeLeft || 0) - elapsed);

                setSessionId(sessSnap.docs[0].id);
                setShuffledExam({ ...exam, questions: sesData.questions });
                setAnswers(sesData.answers);
                setTimeLeft(remaining);
                setTabSwitchCount(sesData.tabSwitchCount || 0);

                // If time ran out while they were away, submit immediately
                if (remaining === 0) {
                    setTimeout(() => submitRef.current?.(sesData.answers), 500);
                }
            } else {
                let qs = [...exam.questions];
                if (exam.shuffleQuestions) {
                    for (let i = qs.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [qs[i], qs[j]] = [qs[j], qs[i]];
                    }
                }
                if (exam.questionsToAnswer > 0 && exam.questionsToAnswer < qs.length) {
                    qs = qs.slice(0, exam.questionsToAnswer);
                }
                if (exam.shuffleOptions) {
                    qs = qs.map(q => {
                        if (q.type !== 'multiple-choice') return q;
                        const correctText = q.options[q.correctAnswerIndex];
                        const shuffled    = [...q.options].sort(() => Math.random() - 0.5);
                        return { ...q, options: shuffled, correctAnswerIndex: shuffled.indexOf(correctText) };
                    });
                }
                const freshAnswers = Array(qs.length).fill(null);
                const newExam      = { ...exam, questions: qs };
                const sesRef       = doc(collection(db, 'exam_sessions'));
                await setDoc(sesRef, {
                    examId: exam.id, studentId: currentUser.uid,
                    questions: qs, answers: freshAnswers,
                    timeLeft: exam.duration * 60, tabSwitchCount: 0,
                    completed: false, startedAt: new Date(), savedAt: new Date(),
                });
                setSessionId(sesRef.id);
                setShuffledExam(newExam);
                setAnswers(freshAnswers);
            }
        };
        init();
    }, [exam, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 2. Immediate save on tab hide (key fix for session persistence) ────────
    useEffect(() => {
        const saveNow = async () => {
            const sid = sessionIdRef.current;
            if (!sid || isFinished) return;
            try {
                await updateDoc(doc(db, 'exam_sessions', sid), {
                    answers:       answersRef.current,
                    timeLeft:      timeLeftRef.current,
                    tabSwitchCount: tabCountRef.current,
                    savedAt:       new Date(), // timestamp so we can deduct elapsed on restore
                });
            } catch (_) {}
        };

        // Save immediately when tab becomes hidden
        const handleVisibility = () => { if (document.hidden) saveNow(); };
        // Save on page unload (best effort)
        const handleUnload = () => {
            const sid = sessionIdRef.current;
            if (!sid) return;
            // Use sendBeacon for reliable unload saves
            const payload = JSON.stringify({
                answers: answersRef.current,
                timeLeft: timeLeftRef.current,
                tabSwitchCount: tabCountRef.current,
                savedAt: new Date().toISOString(),
            });
            navigator.sendBeacon?.(`/api/noop`, payload); // best-effort; Firestore update below
            saveNow();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', handleUnload);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [isFinished]);

    // ── 3. Periodic save every 10 s ──────────────────────────────────────────
    useEffect(() => {
        if (!sessionId || isFinished) return;
        const interval = setInterval(async () => {
            try {
                await updateDoc(doc(db, 'exam_sessions', sessionId), {
                    answers, timeLeft, tabSwitchCount, savedAt: new Date(),
                });
            } catch (_) {}
        }, 10000);
        return () => clearInterval(interval);
    }, [sessionId, answers, timeLeft, tabSwitchCount, isFinished]);

    // ── 4. Submit handler ─────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (forcedAnswers) => {
        if (isSubmitting || !shuffledExam) return;
        setIsSubmitting(true);
        setIsFinished(true);
        setIsSubmitModalOpen(false);

        const finalAnswers = forcedAnswers || answers;
        const totalMarks   = shuffledExam.questions.reduce((a, q) => a + (q.marks || 1), 0);
        let   score        = 0;

        const breakdown = shuffledExam.questions.map((q, i) => {
            const given     = finalAnswers[i];
            let   isCorrect = false;
            if      (q.type === 'multiple-choice') isCorrect = q.correctAnswerIndex === given;
            else if (q.type === 'true-false')      isCorrect = q.correctAnswer      === given;
            else if (q.type === 'short-answer')    isCorrect = typeof given === 'string' &&
                                                               given.trim().toLowerCase() ===
                                                               (q.correctAnswer || '').trim().toLowerCase();
            if (isCorrect) score += (q.marks || 1);
            return {
                question: q.text, type: q.type, marks: q.marks || 1, given, isCorrect,
                correctAnswer: q.type === 'multiple-choice' ? q.options[q.correctAnswerIndex] : q.correctAnswer,
                givenText: q.type === 'multiple-choice' && given !== null ? q.options[given] : given,
            };
        });

        const pct    = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
        const passed = pct >= (exam.passMarkPercentage || 50);

        try {
            await addDoc(collection(db, 'submissions'), {
                examId: exam.id, studentId: currentUser.uid,
                studentEmail: currentUser.email, studentName: currentUser.name || currentUser.email,
                answers: finalAnswers, score, totalMarks, pct, passed,
                tabSwitchCount, submittedAt: new Date(),
            });
            if (sessionId) {
                await updateDoc(doc(db, 'exam_sessions', sessionId), { completed: true });
            }
        } catch (err) { console.error('Error submitting exam:', err); }

        setResult({ score, totalMarks, pct, passed, breakdown });
    }, [answers, exam, currentUser, isSubmitting, sessionId, shuffledExam, tabSwitchCount]);

    useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);

    // ── 5. Countdown timer ────────────────────────────────────────────────────
    useEffect(() => {
        if (isFinished || !shuffledExam) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timer); submitRef.current?.(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isFinished, shuffledExam]);

    // ── 6. Anti-cheat ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (isFinished || allowTabSwitch) return;
        const handleVisibility = () => {
            if (document.hidden) {
                setTabSwitchCount(prev => {
                    const next = prev + 1;
                    if (next >= maxTabSwitches) {
                        setWarningMessage(`You have switched tabs ${next} time(s). Your exam is being auto-submitted.`);
                        setShowWarning(true);
                        setTimeout(() => submitRef.current?.(), 2500);
                    } else {
                        setWarningMessage(`⚠ Warning ${next}/${maxTabSwitches}: Do not leave this window. Auto-submit after ${maxTabSwitches} violations.`);
                        setShowWarning(true);
                    }
                    return next;
                });
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [isFinished, allowTabSwitch, maxTabSwitches]);

    // ── 7. Answer selection ───────────────────────────────────────────────────
    const handleAnswerSelect = (answer) => {
        const next = [...answers];
        next[currentQuestionIndex] = answer;
        setAnswers(next);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    if (!shuffledExam) return <div className="flex justify-center items-center h-64"><Spinner /></div>;

    if (isFinished && result) {
        return <ResultsScreen result={result} exam={exam} onBack={() => setPage('dashboard')} />;
    }
    if (isFinished) {
        return <div className="text-center p-8 bg-white rounded-lg shadow-md"><h2 className="text-2xl font-bold text-gray-800 mb-2">Submitting…</h2><Spinner /></div>;
    }

    const currentQuestion = shuffledExam.questions[currentQuestionIndex];
    const minutes         = Math.floor(timeLeft / 60);
    const seconds         = timeLeft % 60;
    const answeredCount   = answers.filter(a => a !== null).length;

    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-md max-w-4xl mx-auto">
            {showWarning && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                    <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm font-medium">{warningMessage}</div>
                    <button onClick={() => setShowWarning(false)} className="text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
                </div>
            )}

            <div className="flex justify-between items-center mb-5 border-b pb-4 gap-4">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-800 truncate">{shuffledExam.title}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {answeredCount} / {shuffledExam.questions.length} answered
                        {!allowTabSwitch && tabSwitchCount > 0 && (
                            <span className="ml-3 text-red-500">⚠ {tabSwitchCount} tab switch{tabSwitchCount > 1 ? 'es' : ''}</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className={`text-xl font-bold px-3 py-1.5 rounded-lg tabular-nums flex items-center gap-1 ${
                        timeLeft < 300 ? 'text-red-600 bg-red-100 animate-pulse' :
                        timeLeft < 600 ? 'text-yellow-600 bg-yellow-100' : 'text-gray-700 bg-gray-100'
                    }`}>
                        <Clock size={16} />
                        {String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}
                    </div>
                    <button onClick={() => setIsSubmitModalOpen(true)} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 text-sm">
                        Submit
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Question {currentQuestionIndex + 1} of {shuffledExam.questions.length}
                    {currentQuestion.marks > 1 && <span className="ml-2 text-blue-500">({currentQuestion.marks} marks)</span>}
                </p>
                <p className="text-lg text-gray-800 font-medium">{currentQuestion.text}</p>
            </div>

            <div className="space-y-3 min-h-[160px]">
                {currentQuestion.type === 'multiple-choice' && currentQuestion.options.map((opt, i) => (
                    <button key={i} onClick={() => handleAnswerSelect(i)}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                            answers[currentQuestionIndex] === i
                                ? 'bg-blue-50 border-blue-500 text-blue-800'
                                : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}>
                        <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                    </button>
                ))}
                {currentQuestion.type === 'true-false' && (
                    <div className="flex gap-4">
                        {[true, false].map(val => (
                            <button key={String(val)} onClick={() => handleAnswerSelect(val)}
                                className={`flex-1 py-4 rounded-lg border-2 font-semibold transition-all ${
                                    answers[currentQuestionIndex] === val
                                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                                        : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                                }`}>
                                {val ? 'True' : 'False'}
                            </button>
                        ))}
                    </div>
                )}
                {currentQuestion.type === 'short-answer' && (
                    <input type="text" value={answers[currentQuestionIndex] || ''}
                        onChange={e => handleAnswerSelect(e.target.value)}
                        placeholder="Type your answer here…"
                        className="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 text-sm" />
                )}
            </div>

            <div className="mt-8 pt-5 border-t">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentQuestionIndex(p => Math.max(0, p - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="flex items-center gap-1 px-4 py-2 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 text-sm font-medium">
                        <ChevronLeft size={16} /> Previous
                    </button>
                    <button onClick={() => setCurrentQuestionIndex(p => Math.min(shuffledExam.questions.length - 1, p + 1))}
                        disabled={currentQuestionIndex === shuffledExam.questions.length - 1}
                        className="flex items-center gap-1 px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm">
                        Next <ChevronRight size={16} />
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                    {shuffledExam.questions.map((_, i) => (
                        <button key={i} onClick={() => setCurrentQuestionIndex(i)}
                            className={`w-9 h-9 rounded-md text-xs font-bold transition-all ${
                                currentQuestionIndex === i ? 'ring-2 ring-blue-500 ring-offset-1 bg-blue-600 text-white' :
                                answers[i] !== null ? 'bg-green-500 text-white' :
                                'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}>
                            {i + 1}
                        </button>
                    ))}
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-500 mr-1" />Answered
                    <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 ml-3 mr-1" />Unanswered
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-600 ml-3 mr-1" />Current
                </p>
            </div>

            <Modal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} title="Confirm Submission">
                <p className="text-gray-700">
                    You have answered <strong>{answeredCount}</strong> of <strong>{shuffledExam.questions.length}</strong> questions.
                    {answeredCount < shuffledExam.questions.length && (
                        <span className="block mt-2 text-yellow-600 text-sm">⚠ {shuffledExam.questions.length - answeredCount} question(s) unanswered.</span>
                    )}
                </p>
                <p className="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setIsSubmitModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
                    <button onClick={() => handleSubmit()} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">Yes, Submit</button>
                </div>
            </Modal>
        </div>
    );
};

// ── Results Screen ─────────────────────────────────────────────────────────────
const ResultsScreen = ({ result, exam, onBack }) => {
    const { score, totalMarks, pct, passed, breakdown } = result;
    const passMark       = exam.passMarkPercentage || 50;
    const showScore      = exam.showScoreImmediately !== false; // default true

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-10">
            <div className={`bg-white rounded-xl shadow-md p-8 text-center border-t-4 ${passed ? 'border-green-500' : 'border-red-500'}`}>
                {passed ? <CheckCircle size={56} className="text-green-500 mx-auto mb-3" /> : <XCircle size={56} className="text-red-500 mx-auto mb-3" />}
                <h2 className="text-3xl font-bold text-gray-800">{passed ? 'Well done!' : 'Better luck next time'}</h2>
                <p className="text-gray-500 mt-1">{exam.title}</p>

                {showScore ? (
                    <div className="mt-6 flex justify-center gap-8">
                        <div>
                            <p className="text-4xl font-bold text-gray-800">{score}<span className="text-xl text-gray-400">/{totalMarks}</span></p>
                            <p className="text-sm text-gray-500 mt-1">Score</p>
                        </div>
                        <div>
                            <p className={`text-4xl font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>{pct}%</p>
                            <p className="text-sm text-gray-500 mt-1">Percentage</p>
                        </div>
                        <div>
                            <p className="text-4xl font-bold text-gray-800">{passMark}%</p>
                            <p className="text-sm text-gray-500 mt-1">Pass Mark</p>
                        </div>
                    </div>
                ) : (
                    <p className="mt-6 text-gray-500 text-sm">Your score will be released by your teacher.</p>
                )}

                <div className={`inline-block mt-4 px-4 py-1.5 rounded-full text-sm font-bold ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {passed ? 'PASSED' : 'FAILED'}
                </div>
            </div>

            {showScore && (
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Question Breakdown</h3>
                    <div className="space-y-3">
                        {breakdown.map((item, i) => (
                            <div key={i} className={`p-4 rounded-lg border ${item.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex items-start gap-2 min-w-0">
                                        {item.isCorrect ? <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" /> : <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                                        <p className="text-sm text-gray-800 font-medium">{i + 1}. {item.question}</p>
                                    </div>
                                    <span className={`text-xs font-bold shrink-0 ${item.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                        {item.isCorrect ? `+${item.marks}` : '0'}/{item.marks}
                                    </span>
                                </div>
                                {!item.isCorrect && (
                                    <div className="mt-2 ml-6 text-xs space-y-0.5">
                                        <p className="text-red-600">Your answer: <span className="font-medium">{item.givenText !== undefined ? String(item.givenText) : (item.given !== null ? String(item.given) : 'Not answered')}</span></p>
                                        <p className="text-green-700">Correct answer: <span className="font-medium">{String(item.correctAnswer)}</span></p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button onClick={onBack} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
                Back to Dashboard
            </button>
        </div>
    );
};

export default TakeExam;
