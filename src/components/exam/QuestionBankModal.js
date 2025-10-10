import React, { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot } from '../../services/firebase';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';

const QuestionBankModal = ({ isOpen, onClose, onAddQuestions }) => {
    const [allQuestions, setAllQuestions] = useState([]);
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('all');

    // Fetch all questions from the question bank
    useEffect(() => {
        if (!isOpen) return; // Don't fetch if the modal isn't open

        setLoading(true);
        const q = query(collection(db, "questions"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const questionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllQuestions(questionsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen]);

    // Handle checkbox changes
    const handleSelectQuestion = (question, isChecked) => {
        if (isChecked) {
            setSelectedQuestions(prev => [...prev, question]);
        } else {
            setSelectedQuestions(prev => prev.filter(q => q.id !== question.id));
        }
    };

    // Handle the final "Add" button click
    const handleAddSelected = () => {
        onAddQuestions(selectedQuestions);
        setSelectedQuestions([]); // Reset for next time
        onClose();
    };
    
    // Create a list of unique subjects for the filter dropdown
    const subjects = ['all', ...new Set(allQuestions.map(q => q.subjectName))];

    // Apply filters
    const filteredQuestions = allQuestions.filter(q => {
        const matchesSearch = q.text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSubject = subjectFilter === 'all' || q.subjectName === subjectFilter;
        return matchesSearch && matchesSubject;
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Select Questions from Bank" size="2xl">
            <div className="space-y-4">
                {/* Filter Controls */}
                <div className="flex flex-col md:flex-row gap-4">
                    <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                    />
                    <select
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                        className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md bg-white"
                    >
                        {subjects.map(subject => (
                            <option key={subject} value={subject} className="capitalize">{subject}</option>
                        ))}
                    </select>
                </div>

                {/* Questions List */}
                <div className="max-h-96 overflow-y-auto border rounded-md p-2 space-y-2">
                    {loading ? (
                        <div className="flex justify-center items-center h-48"><Spinner /></div>
                    ) : (
                        filteredQuestions.map(question => (
                            <div key={question.id} className="flex items-start p-2 rounded-md hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 mt-1 mr-3"
                                    checked={selectedQuestions.some(q => q.id === question.id)}
                                    onChange={(e) => handleSelectQuestion(question, e.target.checked)}
                                />
                                <div>
                                    <p className="font-medium text-gray-800">{question.text}</p>
                                    <p className="text-xs text-gray-500">
                                        Subject: {question.subjectName} | Type: {question.type} | Marks: {question.marks}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button
                        onClick={handleAddSelected}
                        disabled={selectedQuestions.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
                    >
                        Add {selectedQuestions.length > 0 ? selectedQuestions.length : ''} Question(s)
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default QuestionBankModal;
