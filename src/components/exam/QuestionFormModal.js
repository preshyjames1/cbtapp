import React, { useState } from 'react';
import Modal from '../common/Modal';

const QuestionFormModal = ({ isOpen, onClose, onSave, questionData }) => {
    const [question, setQuestion] = useState(questionData);

    const handleChange = (field, value) => {
        setQuestion(prev => ({ ...prev, [field]: value }));
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...question.options];
        newOptions[index] = value;
        setQuestion(prev => ({ ...prev, options: newOptions }));
    };

    const handleSave = () => {
        // Basic validation
        if (!question.text || !question.subjectName) {
            alert("Please fill out the question text and subject.");
            return;
        }
        onSave(question);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={question.id ? "Edit Question" : "Create New Question"} size="2xl">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                    <textarea value={question.text} onChange={(e) => handleChange('text', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" rows="3" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                        <input type="text" value={question.subjectName} onChange={(e) => handleChange('subjectName', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                        <select value={question.type} onChange={(e) => handleChange('type', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="true-false">True / False</option>
                            <option value="short-answer">Short Answer</option>
                        </select>
                    </div>
                </div>
                {question.type === 'multiple-choice' && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Options</label>
                        {question.options.map((opt, index) => (
                             <div key={index} className="flex items-center space-x-2">
                                 <input type="radio" name="correctAnswer" checked={question.correctAnswerIndex === index} onChange={() => handleChange('correctAnswerIndex', index)} />
                                 <input type="text" value={opt} onChange={(e) => handleOptionChange(index, e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                             </div>
                        ))}
                    </div>
                )}
                {question.type === 'true-false' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                        <select value={question.correctAnswer} onChange={(e) => handleChange('correctAnswer', e.target.value === 'true')} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value={true}>True</option>
                            <option value={false}>False</option>
                        </select>
                    </div>
                )}
                {question.type === 'short-answer' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                        <input type="text" value={question.correctAnswer || ''} onChange={(e) => handleChange('correctAnswer', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                )}
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                    <input type="number" value={question.marks} onChange={(e) => handleChange('marks', parseInt(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div className="flex justify-end space-x-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
                </div>
            </div>
        </Modal>
    );
};

export default QuestionFormModal;