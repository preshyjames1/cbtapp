import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, writeBatch, doc, deleteDoc, where, getDocs, updateDoc } from '../services/firebase';
import { Eye, ShieldCheck, ShieldOff, Pencil, Trash2, Filter, RefreshCw } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';

const ExamManagement = ({ setPage, setSelectedExam }) => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedExams, setSelectedExams] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [examToDelete, setExamToDelete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const examsPerPage = 8;

    useEffect(() => {
        const examsColRef = collection(db, "exams");
        const unsubscribe = onSnapshot(query(examsColRef), (snapshot) => {
            const examList = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                date: doc.data().createdAt?.toDate() 
            }));
            examList.sort((a, b) => (b.date || 0) - (a.date || 0));
            setExams(examList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handlePublishSelected = async () => {
        if (selectedExams.length === 0) {
            alert("Please select exams to publish.");
            return;
        }
        const batch = writeBatch(db);
        selectedExams.forEach(examId => {
            const examRef = doc(db, "exams", examId);
            batch.update(examRef, { status: "Published" });
        });
        await batch.commit();
        setSelectedExams([]);
    };
    
    const handleDeleteSelected = async () => {
        if (selectedExams.length === 0) {
            return;
        }
        try {
            const deletePromises = selectedExams.map(async (examId) => {
                await deleteDoc(doc(db, "exams", examId));
                const subsQuery = query(collection(db, "submissions"), where("examId", "==", examId));
                const subsSnapshot = await getDocs(subsQuery);
                const subDeletePromises = subsSnapshot.docs.map(subDoc => deleteDoc(subDoc.ref));
                await Promise.all(subDeletePromises);
            });
            await Promise.all(deletePromises);
            setSelectedExams([]);
        } catch (error) {
            console.error("Error deleting selected exams:", error);
            alert("An error occurred while deleting the selected exams.");
        } finally {
            setIsBulkDeleteModalOpen(false);
        }
    };

    const handleSelectExam = (examId) => {
        setSelectedExams(prev => 
            prev.includes(examId) 
                ? prev.filter(id => id !== examId) 
                : [...prev, examId]
        );
    };
    
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedExams(filteredExams.map(exam => exam.id));
        } else {
            setSelectedExams([]);
        }
    };

    const openDeleteModal = (exam) => {
        setExamToDelete(exam);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setExamToDelete(null);
        setIsDeleteModalOpen(false);
    };

    const handleDeleteExam = async () => {
        if (!examToDelete) return;
        try {
            await deleteDoc(doc(db, "exams", examToDelete.id));
            const subsQuery = query(collection(db, "submissions"), where("examId", "==", examToDelete.id));
            const subsSnapshot = await getDocs(subsQuery);
            const deletePromises = subsSnapshot.docs.map(subDoc => deleteDoc(subDoc.ref));
            await Promise.all(deletePromises);
        } catch (error) {
            console.error("Error deleting exam:", error);
        } finally {
            closeDeleteModal();
        }
    };

    const handleUpdateStatus = async (examId, newStatus) => {
        const examRef = doc(db, "exams", examId);
        await updateDoc(examRef, { status: newStatus });
    };

    const handleEdit = (exam) => {
        setSelectedExam(exam);
        setPage('edit-exam');
    };

    const handleViewResults = (exam) => {
        setSelectedExam(exam);
        setPage('view-results');
    };

    const filteredExams = exams.filter(exam => 
        exam.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastExam = currentPage * examsPerPage;
    const indexOfFirstExam = indexOfLastExam - examsPerPage;
    const currentExams = filteredExams.slice(indexOfFirstExam, indexOfLastExam);
    const totalPages = Math.ceil(filteredExams.length / examsPerPage);

    const StatusPill = ({ status }) => {
        const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full text-white";
        let colorClass = "";
        switch (status) {
            case "Published": colorClass = "bg-green-500"; break;
            case "Draft": colorClass = "bg-gray-500"; break;
            case "Withdrawn": colorClass = "bg-red-500"; break;
            case "Submitted": colorClass = "bg-blue-500"; break;
            default: colorClass = "bg-yellow-400";
        }
        return <span className={`${baseClasses} ${colorClass}`}>{status}</span>;
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Manage Test</h1>
                    <p className="text-sm text-gray-500">Dashboard &gt; Manage CBT</p>
                </div>
                <button 
                    onClick={() => setPage('create-exam')}
                    className="bg-red-500 text-white font-bold px-4 py-2 rounded-md hover:bg-red-600 transition"
                >
                    New Test
                </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-md mb-6 border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="w-full p-2 border rounded-md lg:col-span-2"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select className="w-full p-2 border rounded-md bg-white">
                        <option>All Sessions</option>
                    </select>
                    <select className="w-full p-2 border rounded-md bg-white">
                        <option>Select Class</option>
                    </select>
                    <div className="flex gap-2">
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center gap-2">
                            <Filter size={16} /> Filter
                        </button>
                        <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md w-full flex items-center justify-center gap-2">
                            <RefreshCw size={16} /> Reset
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-end mb-4 space-x-2">
                 <button 
                    onClick={() => setIsBulkDeleteModalOpen(true)}
                    className="bg-red-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-red-700 transition disabled:bg-gray-300"
                    disabled={selectedExams.length === 0}
                >
                    Delete Selected
                </button>
                <button 
                    onClick={handlePublishSelected}
                    className="bg-orange-400 text-white font-semibold px-4 py-2 rounded-md hover:bg-orange-500 transition disabled:bg-gray-300"
                    disabled={selectedExams.length === 0}
                >
                    Publish Selected
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} checked={selectedExams.length === filteredExams.length && filteredExams.length > 0} /></th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">S.No</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Test Name</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Subject</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Start Time</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="8" className="text-center py-10"><Spinner /></td></tr>
                        ) : currentExams.map((exam, index) => (
                            <tr key={exam.id} className="hover:bg-gray-50">
                                <td className="px-4 py-4"><input type="checkbox" checked={selectedExams.includes(exam.id)} onChange={() => handleSelectExam(exam.id)} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{indexOfFirstExam + index + 1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exam.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.subjectName || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.startDateTime ? exam.startDateTime.toDate().toLocaleString() : 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><StatusPill status={exam.status || 'Draft'} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => handleViewResults(exam)} className="text-purple-600 hover:text-purple-900" title="View Results"><Eye size={18} /></button>
                                        {exam.status === 'Submitted' || exam.status === 'Withdrawn' ? (
                                            <button onClick={() => handleUpdateStatus(exam.id, 'Published')} className="text-green-600 hover:text-green-900" title="Publish"><ShieldCheck size={18} /></button>
                                        ) : null}
                                        {exam.status === 'Published' && (
                                            <button onClick={() => handleUpdateStatus(exam.id, 'Withdrawn')} className="text-yellow-600 hover:text-yellow-900" title="Withdraw"><ShieldOff size={18} /></button>
                                        )}
                                        <button onClick={() => handleEdit(exam)} className="text-blue-600 hover:text-blue-900 disabled:text-gray-300 disabled:cursor-not-allowed" title="Edit" disabled={exam.status === 'Published'}>
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => openDeleteModal(exam)} className="text-red-600 hover:text-red-900" title="Delete"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="flex justify-between items-center mt-4">
                <p className="text-sm text-gray-700">
                    Showing {indexOfFirstExam + 1} to {Math.min(indexOfLastExam, filteredExams.length)} of {filteredExams.length} entries
                </p>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md disabled:opacity-50">Previous</button>
                    <span>{currentPage}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-md disabled:opacity-50">Next</button>
                </div>
            </div>
             <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirm Deletion">
                <p>Are you sure you want to delete the exam "{examToDelete?.title}"? This action also deletes all student submissions for this exam and cannot be undone.</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={closeDeleteModal} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleDeleteExam} className="px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
                </div>
            </Modal>
             <Modal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} title="Confirm Bulk Deletion">
                <p>Are you sure you want to delete the selected {selectedExams.length} exam(s)? This action also deletes all student submissions for these exams and cannot be undone.</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={() => setIsBulkDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleDeleteSelected} className="px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
                </div>
            </Modal>
        </div>
    );
};
export default ExamManagement;