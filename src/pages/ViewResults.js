import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot } from '../services/firebase';
import { ArrowLeft } from 'lucide-react';
import Spinner from '../components/common/Spinner';

const ViewResults = ({ exam, setPage }) => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const subsQuery = query(collection(db, "submissions"), where("examId", "==", exam.id));
        const unsubscribe = onSnapshot(subsQuery, (snapshot) => {
            const subsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSubmissions(subsList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [exam.id]);

    return (
        <div>
            <button onClick={() => setPage('dashboard')} className="mb-6 text-blue-600 font-semibold flex items-center hover:underline">
                <ArrowLeft className="mr-2 h-5 w-5" /> Back to Dashboard
            </button>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">Results for: {exam.title}</h2>
            <p className="text-gray-500 mb-6">Total questions: {exam.questions.length}</p>

            {loading ? <Spinner /> : (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    {submissions.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {submissions.map(sub => (
                                    <tr key={sub.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.studentEmail}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.score} / {sub.totalMarks || exam.questions.length}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(sub.submittedAt.seconds * 1000).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center p-8 text-gray-500">No submissions for this exam yet.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ViewResults;