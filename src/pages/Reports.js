import React, { useState, useEffect } from 'react';
import { db, collection, getDocs } from '../services/firebase';
import Spinner from '../components/common/Spinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, ClipboardList, BarChart2, Percent } from 'lucide-react';

// --- Helper Component for Stat Cards ---
const StatCard = ({ icon, title, value, color }) => {
    const IconComponent = icon;
    return (
        <div className={`bg-white p-6 rounded-lg shadow-md flex items-center border-l-4 ${color}`}>
            <div className="mr-4">
                <IconComponent size={32} className="text-gray-600" />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
            </div>
        </div>
    );
};


// --- Main Reports Component ---
const Reports = () => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReportData = async () => {
            try {
                // Fetch all exams and all submissions in parallel
                const examsQuery = collection(db, "exams");
                const submissionsQuery = collection(db, "submissions");

                const [examsSnapshot, submissionsSnapshot] = await Promise.all([
                    getDocs(examsQuery),
                    getDocs(submissionsQuery)
                ]);

                const exams = examsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const submissions = submissionsSnapshot.docs.map(doc => doc.data());

                // --- Process Data ---
                const totalExams = exams.length;
                const totalSubmissions = submissions.length;

                let totalScore = 0;
                let totalPossibleMarks = 0;
                submissions.forEach(sub => {
                    totalScore += sub.score;
                    totalPossibleMarks += sub.totalMarks;
                });

                const averageScorePercentage = totalPossibleMarks > 0 
                    ? ((totalScore / totalPossibleMarks) * 100).toFixed(1) 
                    : 0;

                // Calculate average score for each exam
                const examPerformance = exams.map(exam => {
                    const relevantSubmissions = submissions.filter(s => s.examId === exam.id);
                    if (relevantSubmissions.length === 0) {
                        return { name: exam.title, "Average Score (%)": 0 };
                    }
                    const examTotalScore = relevantSubmissions.reduce((acc, sub) => acc + sub.score, 0);
                    const examTotalMarks = relevantSubmissions.reduce((acc, sub) => acc + sub.totalMarks, 0);
                    const avgPercentage = examTotalMarks > 0 ? ((examTotalScore / examTotalMarks) * 100) : 0;
                    return {
                        name: exam.title.length > 20 ? exam.title.substring(0, 20) + '...' : exam.title,
                        "Average Score (%)": parseFloat(avgPercentage.toFixed(1))
                    };
                });

                setReportData({
                    totalExams,
                    totalSubmissions,
                    averageScorePercentage,
                    examPerformance
                });

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    if (!reportData) {
        return <p>Could not load report data.</p>;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={FileText} title="Total Exams" value={reportData.totalExams} color="border-blue-500" />
                <StatCard icon={ClipboardList} title="Total Submissions" value={reportData.totalSubmissions} color="border-green-500" />
                <StatCard icon={Percent} title="Overall Average Score" value={`${reportData.averageScorePercentage}%`} color="border-yellow-500" />
                <StatCard icon={BarChart2} title="Top Performing Exam" value="N/A" color="border-purple-500" />
            </div>

            {/* Exam Performance Chart */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Average Score by Exam</h2>
                <div style={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer>
                        <BarChart
                            data={reportData.examPerformance}
                            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis unit="%" />
                            <Tooltip formatter={(value) => `${value}%`} />
                            <Legend />
                            <Bar dataKey="Average Score (%)" fill="#3b82f6" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Reports;
