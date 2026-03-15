import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot } from '../services/firebase';
import { ArrowLeft, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Spinner from '../components/common/Spinner';

const ViewResults = ({ exam, setPage }) => {
    const [submissions, setSubmissions] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [expanded,    setExpanded]    = useState(null); // submission id with breakdown open

    useEffect(() => {
        const q = query(collection(db, 'submissions'), where('examId', '==', exam.id));
        const unsub = onSnapshot(q, snap => {
            const list = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
            setSubmissions(list);
            setLoading(false);
        });
        return () => unsub();
    }, [exam.id]);

    const passMark    = exam.passMarkPercentage || 50;
    const totalQ      = exam.questions?.length || 0;
    const passed      = submissions.filter(s => s.passed || (s.pct ?? calcPct(s)) >= passMark).length;
    const avgPct      = submissions.length
        ? Math.round(submissions.reduce((a, s) => a + (s.pct ?? calcPct(s)), 0) / submissions.length)
        : 0;

    return (
        <div className="space-y-6 pb-10">
            {/* Back button — returns to wherever the admin/teacher came from */}
            <button
                onClick={() => setPage('exam-management')}
                className="text-blue-600 font-semibold flex items-center hover:underline"
            >
                <ArrowLeft className="mr-2 h-5 w-5" /> Back to Exam Management
            </button>

            {/* Exam header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-2xl font-bold text-gray-800">{exam.title}</h2>
                <p className="text-gray-500 text-sm mt-1">
                    {exam.subjectName || ''} · {totalQ} questions · Pass mark: {passMark}%
                </p>

                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                    {[
                        { label: 'Submissions', value: submissions.length, color: 'text-blue-600'  },
                        { label: 'Passed',       value: passed,             color: 'text-green-600' },
                        { label: 'Failed',        value: submissions.length - passed, color: 'text-red-500' },
                        { label: 'Average Score', value: `${avgPct}%`,      color: avgPct >= passMark ? 'text-green-600' : 'text-red-500' },
                    ].map(s => (
                        <div key={s.label} className="bg-gray-50 rounded-lg p-4 text-center">
                            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Results table */}
            {loading ? <div className="flex justify-center py-10"><Spinner /></div> : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {submissions.length === 0 ? (
                        <p className="text-center p-10 text-gray-400">No submissions yet.</p>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Student', 'Email', 'Score', '%', 'Result', 'Submitted', 'Details'].map(h => (
                                        <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {submissions.map(sub => {
                                    const pct        = sub.pct ?? calcPct(sub);
                                    const subPassed  = sub.passed ?? (pct >= passMark);
                                    const isOpen     = expanded === sub.id;
                                    return (
                                        <React.Fragment key={sub.id}>
                                            <tr className="hover:bg-gray-50">
                                                <td className="px-5 py-3 text-sm font-semibold text-gray-800">{sub.studentName || '—'}</td>
                                                <td className="px-5 py-3 text-sm text-gray-500">{sub.studentEmail}</td>
                                                <td className="px-5 py-3 text-sm text-gray-700 font-medium">{sub.score} / {sub.totalMarks}</td>
                                                <td className="px-5 py-3 text-sm font-bold">
                                                    <span className={pct >= passMark ? 'text-green-600' : 'text-red-500'}>{pct}%</span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${subPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                        {subPassed ? 'PASS' : 'FAIL'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                                                    {sub.submittedAt?.seconds
                                                        ? new Date(sub.submittedAt.seconds * 1000).toLocaleString()
                                                        : '—'}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {sub.answers && (
                                                        <button
                                                            onClick={() => setExpanded(isOpen ? null : sub.id)}
                                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs font-semibold"
                                                        >
                                                            {isOpen ? <><ChevronUp size={14}/> Hide</> : <><ChevronDown size={14}/> View</>}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Per-question breakdown row */}
                                            {isOpen && sub.answers && (
                                                <tr>
                                                    <td colSpan={7} className="bg-gray-50 px-8 py-4">
                                                        <p className="text-xs font-bold text-gray-500 uppercase mb-3">Question Breakdown</p>
                                                        <div className="space-y-2">
                                                            {(exam.questions || []).map((q, qi) => {
                                                                const given     = sub.answers[qi];
                                                                let isCorrect   = false;
                                                                let givenText   = given !== null && given !== undefined ? String(given) : 'Not answered';
                                                                let correctText = '';

                                                                if (q.type === 'multiple-choice') {
                                                                    isCorrect   = q.correctAnswerIndex === given;
                                                                    givenText   = given !== null && given !== undefined ? (q.options[given] || String(given)) : 'Not answered';
                                                                    correctText = q.options[q.correctAnswerIndex];
                                                                } else if (q.type === 'true-false') {
                                                                    isCorrect   = q.correctAnswer === given;
                                                                    givenText   = given !== null ? String(given) : 'Not answered';
                                                                    correctText = String(q.correctAnswer);
                                                                } else if (q.type === 'short-answer') {
                                                                    isCorrect   = typeof given === 'string' &&
                                                                                  given.trim().toLowerCase() === (q.correctAnswer||'').trim().toLowerCase();
                                                                    correctText = q.correctAnswer;
                                                                }

                                                                return (
                                                                    <div key={qi} className={`flex items-start gap-3 p-3 rounded-lg text-xs ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                                                                        {isCorrect
                                                                            ? <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5"/>
                                                                            : <XCircle    size={14} className="text-red-500 shrink-0 mt-0.5"/>}
                                                                        <div className="min-w-0">
                                                                            <p className="font-medium text-gray-800">{qi + 1}. {q.text}</p>
                                                                            {!isCorrect && (
                                                                                <p className="text-red-600 mt-0.5">
                                                                                    Given: <strong>{givenText}</strong> · Correct: <strong>{correctText}</strong>
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <span className={`ml-auto shrink-0 font-bold ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                                                            {isCorrect ? `+${q.marks||1}` : '0'}/{q.marks||1}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

const calcPct = (sub) => sub.totalMarks > 0 ? Math.round((sub.score / sub.totalMarks) * 100) : 0;

export default ViewResults;

