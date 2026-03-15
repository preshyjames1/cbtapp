import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, query, orderBy } from '../services/firebase';
import Spinner from '../components/common/Spinner';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    Users, FileText, ClipboardList, TrendingUp,
    GraduationCap, BookOpen, CheckCircle, Clock,
    AlertTriangle, ChevronRight
} from 'lucide-react';

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, title, value, sub, color, bg }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
        <div className={`${bg} p-3 rounded-lg`}>
            <Icon size={22} className={color} />
        </div>
        <div className="min-w-0">
            <p className="text-sm text-gray-500 font-medium truncate">{title}</p>
            <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        Published:  { cls: 'bg-green-100 text-green-700',  label: 'Published'  },
        Draft:      { cls: 'bg-gray-100 text-gray-600',    label: 'Draft'      },
        Withdrawn:  { cls: 'bg-red-100 text-red-600',      label: 'Withdrawn'  },
        Submitted:  { cls: 'bg-blue-100 text-blue-600',    label: 'Submitted'  },
    };
    const s = map[status] || { cls: 'bg-yellow-100 text-yellow-700', label: status };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
            {s.label}
        </span>
    );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, action, onAction }) => (
    <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        {action && (
            <button
                onClick={onAction}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
                {action} <ChevronRight size={14} />
            </button>
        )}
    </div>
);

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
        <Users size={28} className="text-gray-300" />
        {message}
    </div>
);

const truncate = (str, n) => str?.length > n ? str.substring(0, n) + '…' : str;

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminDashboard = ({ setPage }) => {
    const [stats, setStats]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [usersSnap, examsSnap, submissionsSnap] = await Promise.all([
                    getDocs(collection(db, 'users')),
                    getDocs(query(collection(db, 'exams'), orderBy('createdAt', 'desc'))),
                    getDocs(collection(db, 'submissions')),
                ]);

                const users       = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const exams       = examsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const submissions = submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // User counts
                const students = users.filter(u => u.role === 'student').length;
                const teachers = users.filter(u => u.role === 'teacher').length;
                const admins   = users.filter(u => u.role === 'admin').length;

                // Exam counts
                const publishedExams = exams.filter(e => e.status === 'Published').length;
                const draftExams     = exams.filter(e => e.status === 'Draft' || !e.status).length;
                const withdrawnExams = exams.filter(e => e.status === 'Withdrawn').length;

                // Score stats
                let totalScore = 0, totalPossible = 0;
                submissions.forEach(s => {
                    totalScore    += (s.score      || 0);
                    totalPossible += (s.totalMarks || 0);
                });
                const avgScore = totalPossible > 0
                    ? ((totalScore / totalPossible) * 100).toFixed(1)
                    : '0.0';

                // Per-exam performance for bar chart
                const examPerformance = exams
                    .filter(e => e.status === 'Published')
                    .map(exam => {
                        const subs   = submissions.filter(s => s.examId === exam.id);
                        if (!subs.length) return { name: truncate(exam.title, 18), avg: 0, attempts: 0 };
                        const eScore = subs.reduce((a, s) => a + (s.score      || 0), 0);
                        const eTotal = subs.reduce((a, s) => a + (s.totalMarks || 0), 0);
                        return {
                            name:     truncate(exam.title, 18),
                            avg:      eTotal > 0 ? parseFloat(((eScore / eTotal) * 100).toFixed(1)) : 0,
                            attempts: subs.length,
                        };
                    })
                    .sort((a, b) => b.avg - a.avg)
                    .slice(0, 8);

                // Pie chart data
                const rolePie = [
                    { name: 'Students', value: students },
                    { name: 'Teachers', value: teachers },
                    { name: 'Admins',   value: admins   },
                ].filter(d => d.value > 0);

                // Recent exams (already sorted desc by createdAt)
                const recentExams = exams.slice(0, 5);

                // Recent submissions
                const recentSubmissions = [...submissions]
                    .sort((a, b) => {
                        const ta = a.submittedAt?.toDate?.() || 0;
                        const tb = b.submittedAt?.toDate?.() || 0;
                        return tb - ta;
                    })
                    .slice(0, 5)
                    .map(s => {
                        const exam = exams.find(e => e.id === s.examId);
                        const pct  = s.totalMarks > 0
                            ? Math.round((s.score / s.totalMarks) * 100)
                            : 0;
                        return { ...s, examTitle: exam?.title || 'Unknown Exam', pct };
                    });

                setStats({
                    students, teachers, admins,
                    totalUsers: users.length,
                    totalExams: exams.length,
                    publishedExams, draftExams, withdrawnExams,
                    totalSubmissions: submissions.length,
                    avgScore,
                    examPerformance,
                    rolePie,
                    recentExams,
                    recentSubmissions,
                });
            } catch (err) {
                console.error(err);
                setError('Failed to load dashboard data. Please refresh.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                <AlertTriangle size={40} className="text-red-400" />
                <p className="text-gray-600">{error}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                    Retry
                </button>
            </div>
        );
    }

    const nav = setPage || (() => {});

    return (
        <div className="space-y-6 pb-8">

            {/* Page Title */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">Overview of your exam platform</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard icon={GraduationCap} title="Students"     value={stats.students}          sub={`of ${stats.totalUsers} users`} color="text-blue-600"   bg="bg-blue-50"   />
                <StatCard icon={BookOpen}       title="Teachers"     value={stats.teachers}                                               color="text-emerald-600" bg="bg-emerald-50" />
                <StatCard icon={FileText}       title="Total Exams"  value={stats.totalExams}        sub={`${stats.publishedExams} published`} color="text-violet-600" bg="bg-violet-50" />
                <StatCard icon={ClipboardList}  title="Submissions"  value={stats.totalSubmissions}                                       color="text-orange-600" bg="bg-orange-50" />
                <StatCard icon={TrendingUp}     title="Avg. Score"   value={`${stats.avgScore}%`}    sub="across all exams"               color="text-pink-600"   bg="bg-pink-50"   />
            </div>

            {/* Exam Status Pills */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Published', count: stats.publishedExams, icon: CheckCircle,   color: 'text-green-600 bg-green-50 border-green-200' },
                    { label: 'Draft',     count: stats.draftExams,     icon: Clock,         color: 'text-gray-600 bg-gray-50 border-gray-200'   },
                    { label: 'Withdrawn', count: stats.withdrawnExams, icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200'      },
                ].map(({ label, count, icon: Icon, color }) => (
                    <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${color}`}>
                        <Icon size={20} />
                        <div>
                            <p className="text-xl font-bold">{count}</p>
                            <p className="text-xs font-medium">{label} Exams</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Bar chart */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <SectionHeader title="Average Score by Exam (%)" action="View Reports" onAction={() => nav('reports')} />
                    {stats.examPerformance.length === 0 ? (
                        <EmptyState message="No published exams with submissions yet." />
                    ) : (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={stats.examPerformance} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
                                <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                <Bar dataKey="avg" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Pie chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <SectionHeader title="User Distribution" action="Manage Users" onAction={() => nav('user-management')} />
                    {stats.rolePie.length === 0 ? (
                        <EmptyState message="No users found." />
                    ) : (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={stats.rolePie} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                                    {stats.rolePie.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Recent Exams */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <SectionHeader title="Recent Exams" action="View All" onAction={() => nav('exam-management')} />
                    {stats.recentExams.length === 0 ? (
                        <EmptyState message="No exams created yet." />
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {stats.recentExams.map(exam => (
                                <div key={exam.id} className="py-3 flex justify-between items-center">
                                    <div className="min-w-0 mr-3">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{exam.title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {exam.subjectName || '—'} · {exam.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                        </p>
                                    </div>
                                    <StatusBadge status={exam.status || 'Draft'} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Submissions */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <SectionHeader title="Recent Submissions" action="View Reports" onAction={() => nav('reports')} />
                    {stats.recentSubmissions.length === 0 ? (
                        <EmptyState message="No submissions yet." />
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {stats.recentSubmissions.map(sub => (
                                <div key={sub.id} className="py-3 flex justify-between items-center">
                                    <div className="min-w-0 mr-3">
                                        <p className="text-sm font-semibold text-gray-800 truncate">
                                            {sub.studentName || sub.studentEmail || 'Student'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{sub.examTitle}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`text-sm font-bold ${sub.pct >= 70 ? 'text-green-600' : sub.pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                            {sub.score}/{sub.totalMarks}
                                        </span>
                                        <p className="text-xs text-gray-400">{sub.pct}%</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-base font-bold text-gray-800 mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                    {[
                        { label: '+ New Exam',      page: 'create-exam',     cls: 'bg-blue-600 text-white hover:bg-blue-700'    },
                        { label: 'Manage Users',    page: 'user-management', cls: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
                        { label: 'Question Bank',   page: 'question-bank',   cls: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
                        { label: 'View Reports',    page: 'reports',         cls: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
                        { label: 'Exam Management', page: 'exam-management', cls: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
                    ].map(({ label, page, cls }) => (
                        <button key={page} onClick={() => nav(page)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${cls}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default AdminDashboard;