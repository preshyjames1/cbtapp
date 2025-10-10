import React from 'react';
import { X } from 'lucide-react';

const ExamInstructions = ({ exam, onStartExam, onBackToDashboard }) => {
    return (
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto relative">
             <button 
                onClick={onBackToDashboard}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                title="Back to Dashboard"
            >
                <X size={24} />
            </button>
            <h1 className="text-3xl font-bold text-gray-800 mb-4">{exam.title}</h1>
            <div className="flex items-center text-gray-500 mb-6 space-x-4">
                <span>{exam.questionsToAnswer || exam.questions.length} Questions</span>
                <span>&bull;</span>
                <span>{exam.duration} Minutes</span>
            </div>
            <div className="prose max-w-none">
                <h2 className="text-xl font-bold text-gray-700 mb-2">Instructions</h2>
                <p className="whitespace-pre-wrap">{exam.instructions || "No specific instructions were provided for this exam."}</p>
            </div>
            <div className="mt-8 pt-6 border-t">
                <button 
                    onClick={onStartExam}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                    Start Test Now
                </button>
            </div>
        </div>
    );
};
export default ExamInstructions;