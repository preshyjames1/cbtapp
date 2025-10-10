import { useAuth } from '../context/AuthContext'; // <-- ADD THIS LINE
import React, { useState, useEffect, useCallback } from 'react';
import { db, addDoc, collection } from '../services/firebase';
import { CheckCircle } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';

const TakeExam = ({exam, setPage }) => {
    const { currentUser } = useAuth(); // <-- ADD THIS LINE
    const [shuffledExam, setShuffledExam] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [timeLeft, setTimeLeft] = useState(exam.duration * 60);
    const [isFinished, setIsFinished] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

    useEffect(() => {
        if (!exam) return;

        let questionsToProcess = [...exam.questions];

        if (exam.shuffleQuestions) {
            for (let i = questionsToProcess.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [questionsToProcess[i], questionsToProcess[j]] = [questionsToProcess[j], questionsToProcess[i]];
            }
        }

        if (exam.questionsToAnswer && exam.questionsToAnswer > 0 && exam.questionsToAnswer < questionsToProcess.length) {
            questionsToProcess = questionsToProcess.slice(0, exam.questionsToAnswer);
        }

        if (exam.shuffleOptions) {
            questionsToProcess = questionsToProcess.map(q => {
                if (q.type !== 'multiple-choice') return q;
                const originalCorrectAnswerText = q.options[q.correctAnswerIndex];
                const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
                const newCorrectAnswerIndex = shuffledOptions.indexOf(originalCorrectAnswerText);
                return {
                    ...q,
                    options: shuffledOptions,
                    correctAnswerIndex: newCorrectAnswerIndex,
                };
            });
        }
        
        setShuffledExam({ ...exam, questions: questionsToProcess });
        setAnswers(Array(questionsToProcess.length).fill(null));

    }, [exam]);

    const handleSubmit = useCallback(async () => {
        if (isSubmitting || !shuffledExam) return;
        setIsSubmitting(true);
        setIsFinished(true);
        
        let score = 0;
        shuffledExam.questions.forEach((q, index) => {
            const userAnswer = answers[index];
            let isCorrect = false;
            if (q.type === 'multiple-choice') {
                isCorrect = q.correctAnswerIndex === userAnswer;
            } else if (q.type === 'true-false') {
                isCorrect = q.correctAnswer === userAnswer;
            } else if (q.type === 'short-answer') {
                isCorrect = q.correctAnswer === userAnswer;
            }

            if (isCorrect) {
                score += (q.marks || 1);
            }
        });

        try {
            await addDoc(collection(db, "submissions"), {
                examId: exam.id,
                studentId: currentUser.uid,
                studentEmail: currentUser.email,
                answers,
                score,
                totalMarks: shuffledExam.questions.reduce((acc, q) => acc + (q.marks || 1), 0),
                submittedAt: new Date(),
            });
        } catch (error) {
            console.error("Error submitting exam:", error);
        }
        
        setTimeout(() => setPage('dashboard'), 3000);
    }, [answers, exam, currentUser, isSubmitting, setPage, shuffledExam]);

    useEffect(() => {
        if (isFinished) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isFinished, handleSubmit]);

    const handleAnswerSelect = (answer) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = answer;
        setAnswers(newAnswers);
    };

    if (!shuffledExam) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner />
            </div>
        );
    }

    if (isFinished) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-3xl font-bold text-gray-800">Exam Submitted!</h2>
                <p className="text-gray-600 mt-4">Your results have been recorded. You will be redirected to the dashboard shortly.</p>
                <CheckCircle className="w-24 h-24 text-green-500 mx-auto mt-6" />
            </div>
        );
    }

    const currentQuestion = shuffledExam.questions[currentQuestionIndex];
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">{shuffledExam.title}</h2>
                 <div className="flex items-center gap-4">
                    <div className={`text-xl font-bold p-2 rounded-lg ${timeLeft < 60 ? 'text-red-500 bg-red-100' : 'text-gray-700'}`}>
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>
                    <button 
                        onClick={() => setIsSubmitModalOpen(true)} 
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                    >
                        Submit Exam
                    </button>
                </div>
            </div>
            
            <div className="my-6">
                <p className="text-lg font-semibold text-gray-700 mb-2">Question {currentQuestionIndex + 1} of {shuffledExam.questions.length}</p>
                <p className="text-xl">{currentQuestion.text}</p>
            </div>

            <div className="space-y-4 min-h-[150px]">
                {currentQuestion.type === 'multiple-choice' && currentQuestion.options.map((option, index) => (
                    <button
                        key={index}
                        onClick={() => handleAnswerSelect(index)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${answers[currentQuestionIndex] === index ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}`}
                    >
                        {option}
                    </button>
                ))}
                {currentQuestion.type === 'true-false' && (
                    <div className="flex gap-4">
                         <button onClick={() => handleAnswerSelect(true)} className={`w-full p-4 rounded-lg border-2 ${answers[currentQuestionIndex] === true ? 'bg-blue-100 border-blue-500' : 'bg-gray-50'}`}>True</button>
                         <button onClick={() => handleAnswerSelect(false)} className={`w-full p-4 rounded-lg border-2 ${answers[currentQuestionIndex] === false ? 'bg-blue-100 border-blue-500' : 'bg-gray-50'}`}>False</button>
                    </div>
                )}
                 {currentQuestion.type === 'short-answer' && (
                    <input 
                        type="text"
                        value={answers[currentQuestionIndex] || ''}
                        onChange={(e) => handleAnswerSelect(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                    />
                )}
            </div>

            <div className="mt-8 pt-6 border-t">
                <div className="flex justify-between items-center mb-4">
                    <button 
                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button 
                        onClick={() => setCurrentQuestionIndex(prev => Math.min(shuffledExam.questions.length - 1, prev + 1))}
                        disabled={currentQuestionIndex === shuffledExam.questions.length - 1}
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                    {shuffledExam.questions.map((_, index) => (
                        <button 
                            key={index}
                            onClick={() => setCurrentQuestionIndex(index)}
                            className={`w-10 h-10 rounded-md flex items-center justify-center font-bold text-white ${
                                currentQuestionIndex === index 
                                ? 'bg-blue-600' 
                                : answers[index] !== null 
                                ? 'bg-green-500' 
                                : 'bg-gray-400'
                            }`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            </div>
            <Modal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} title="Confirm Submission">
                <p>Are you sure you want to submit your exam? This action cannot be undone.</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={() => setIsSubmitModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded-lg">Yes, Submit</button>
                </div>
            </Modal>
        </div>
    );
};
export default TakeExam;