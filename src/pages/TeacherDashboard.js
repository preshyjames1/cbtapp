import { useAuth } from '../context/AuthContext'; // <-- ADD THIS LINE
import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, addDoc } from '../services/firebase';
import { Eye, Send, ShieldOff, Pencil, Trash2 } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';


const TeacherDashboard = ({setPage, setSelectedExam }) => {
    const { currentUser } = useAuth(); // <-- ADD THIS LINE
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [examToDelete, setExamToDelete] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
         if (!currentUser) return;
        const examsQuery = query(collection(db, "exams"), where("teacherId", "==", currentUser.uid));
        const unsubscribe = onSnapshot(examsQuery, (snapshot) => {
            const examList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            examList.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
            setExams(examList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser]);

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
    
    const handleUpdateStatus = async (exam, newStatus) => {
    const examRef = doc(db, "exams", exam.id);
    try {
        // Step 1: Update the exam's status
        await updateDoc(examRef, { status: newStatus });

        // Step 2: If submitted, create a notification for the admin
        if (newStatus === 'Submitted') {
            const notificationsColRef = collection(db, "notifications");
            await addDoc(notificationsColRef, {
                type: 'EXAM_SUBMITTED',
                message: `${currentUser.email} has submitted the exam "${exam.title}" for review.`,
                examId: exam.id,
                timestamp: new Date(),
                read: false // We'll use this to track if the admin has seen it
            });
        }

        toast.success(`Exam status updated to ${newStatus}!`);

    } catch (error) {
        console.error("Error updating status or creating notification:", error);
        toast.error("Failed to update status.");
    }
};

    const handleEdit = (exam) => {
        setSelectedExam(exam);
        setPage('edit-exam');
    };

    const handleViewResults = (exam) => {
        setSelectedExam(exam);
        setPage('view-results');
    };

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
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">My Exams</h2>
                <button 
                    onClick={() => setPage('create-exam')}
                    className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    Create New Exam
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Test Name</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Subject</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="4" className="text-center py-10"><Spinner /></td></tr>
                        ) : exams.map((exam) => (
                            <tr key={exam.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exam.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.subjectName || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><StatusPill status={exam.status || 'Draft'} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => handleViewResults(exam)} className="text-purple-600 hover:text-purple-900" title="View Results"><Eye size={18} /></button>
                                        {exam.status === 'Draft' && (
                                            <button onClick={() => handleUpdateStatus(exam, 'Submitted')} className="text-indigo-600 hover:text-indigo-900" title="Submit for Review"><Send size={18} /></button>
                                        )}
                                        {exam.status === 'Submitted' && (
                                             <button onClick={() => handleUpdateStatus(exam, 'Draft')} className="text-yellow-600 hover:text-yellow-900" title="Withdraw Submission"><ShieldOff size={18} /></button>
                                        )}
                                        <button onClick={() => handleEdit(exam)} className="text-blue-600 hover:text-blue-900 disabled:text-gray-300 disabled:cursor-not-allowed" title="Edit" disabled={exam.status !== 'Draft'}>
                                            <Pencil size={18} />
                                        </button>
                                        <button onClick={() => openDeleteModal(exam)} className="text-red-600 hover:text-red-900 disabled:text-gray-300 disabled:cursor-not-allowed" title="Delete" disabled={exam.status === 'Published'}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirm Deletion">
                <p>Are you sure you want to delete the exam "{examToDelete?.title}"? This action cannot be undone.</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={closeDeleteModal} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleDeleteExam} className="px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
                </div>
            </Modal>
        </div>
    );
};
export default TeacherDashboard;