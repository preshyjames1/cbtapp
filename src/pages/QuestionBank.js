import { useAuth } from '../context/AuthContext'; // <-- ADD THIS LINE
import React, { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from '../services/firebase';
import { Pencil, Trash2 } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import QuestionFormModal from '../components/exam/QuestionFormModal';
const QuestionBank = ( ) => {
    const { currentUser } = useAuth(); // <-- ADD THIS LINE
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [questionToDelete, setQuestionToDelete] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "questions"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const questionsData = [];
            querySnapshot.forEach((doc) => {
                questionsData.push({ id: doc.id, ...doc.data() });
            });
            setQuestions(questionsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleCreateNew = () => {
        setCurrentQuestion({
            text: '',
            subjectName: '',
            type: 'multiple-choice',
            options: ['', '', '', ''],
            correctAnswerIndex: 0,
            marks: 1,
        });
        setIsModalOpen(true);
    };

    const handleEdit = (question) => {
        setCurrentQuestion(question);
        setIsModalOpen(true);
    };

    const handleDelete = (question) => {
        setQuestionToDelete(question);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (questionToDelete) {
            await deleteDoc(doc(db, "questions", questionToDelete.id));
            setIsDeleteModalOpen(false);
            setQuestionToDelete(null);
        }
    };

    const handleSaveQuestion = async (questionData) => {
        if (questionData.id) {
            const questionRef = doc(db, "questions", questionData.id);
            await updateDoc(questionRef, questionData);
        } else {
            await addDoc(collection(db, "questions"), {
                ...questionData,
                createdBy: currentUser.uid,
                createdAt: Timestamp.now(),
            });
        }
        setIsModalOpen(false);
        setCurrentQuestion(null);
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Question Bank</h1>
                <button 
                    onClick={handleCreateNew}
                    className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    Create New Question
                </button>
            </div>

            {loading ? <Spinner /> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Question Text</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Subject</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {questions.map(q => (
                                <tr key={q.id}>
                                    <td className="px-6 py-4 whitespace-pre-wrap text-sm font-medium text-gray-900">{q.text}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{q.subjectName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{q.type.replace('-', ' ')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center space-x-4">
                                            <button onClick={() => handleEdit(q)} className="text-blue-600 hover:text-blue-900" title="Edit"><Pencil size={18} /></button>
                                            <button onClick={() => handleDelete(q)} className="text-red-600 hover:text-red-900" title="Delete"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <QuestionFormModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveQuestion}
                    questionData={currentQuestion}
                />
            )}
            
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion" size="sm">
                <p>Are you sure you want to delete this question? This action cannot be undone.</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
                </div>
            </Modal>
        </div>
    );
};
export default QuestionBank;