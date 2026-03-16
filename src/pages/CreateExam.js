import React, { useState, useEffect } from 'react';
import { db, addDoc, collection, Timestamp } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, UploadCloud, Book, Trash2 } from 'lucide-react';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import QuestionBankModal from '../components/exam/QuestionBankModal';
import { CLASS_OPTIONS, SUBJECT_OPTIONS } from '../config/constants';
import toast from 'react-hot-toast';

const CreateExam = ({ setPage }) => {
    const { currentUser } = useAuth();
    const [title, setTitle] = useState('');
    const [className, setClassName] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [testDate, setTestDate] = useState('');
    const [testTime, setTestTime] = useState('09:00');
    const [windowEndDate, setWindowEndDate] = useState('');
    const [windowEndTime, setWindowEndTime] = useState('23:59');
    const [durationHr, setDurationHr] = useState(0);
    const [durationMin, setDurationMin] = useState(30);
    const [useAccessCode, setUseAccessCode] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [shuffleQuestions, setShuffleQuestions] = useState(false);
    const [shuffleOptions, setShuffleOptions] = useState(false);
    const [showScoreImmediately, setShowScoreImmediately] = useState(true);
    const [allowTabSwitch, setAllowTabSwitch] = useState(false);
    const [maxTabSwitches, setMaxTabSwitches] = useState(3);
    const [instructions, setInstructions] = useState('');
    const [questions, setQuestions] = useState([]);
    const [questionsToAnswer, setQuestionsToAnswer] = useState(1);
    const [passMarkPercentage, setPassMarkPercentage] = useState(50);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);

    useEffect(() => {
        setQuestionsToAnswer(questions.length);
    }, [questions.length]);

    const handleAddQuestionsFromBank = (bankQuestions) => {
        const questionsToAdd = bankQuestions.map(({ id, ...rest }) => rest);
        setQuestions(prev => [...prev, ...questionsToAdd]);
    };

    const handleAddQuestion = () => {
        setQuestions([...questions, { type: 'multiple-choice', text: '', options: ['', '', '', ''], correctAnswerIndex: 0, marks: 1 }]);
    };
    
    const handleRemoveQuestion = (index) => {
        const newQuestions = questions.filter((_, qIndex) => qIndex !== index);
        setQuestions(newQuestions);
    };

    const handleAddOption = (qIndex) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options.push('');
        setQuestions(newQuestions);
    };

    const handleRemoveOption = (qIndex, oIndex) => {
        const newQuestions = [...questions];
        if (newQuestions[qIndex].options.length <= 2) return; // min 2 options
        newQuestions[qIndex].options.splice(oIndex, 1);
        // Adjust correctAnswerIndex if needed
        if (newQuestions[qIndex].correctAnswerIndex >= newQuestions[qIndex].options.length) {
            newQuestions[qIndex].correctAnswerIndex = 0;
        }
        setQuestions(newQuestions);
    };

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...questions];
        if (field === 'marks') {
            newQuestions[index][field] = parseInt(value) || 1;
        } else if (field === 'type') {
            newQuestions[index].type = value;
            if (value === 'multiple-choice') {
                newQuestions[index].options = ['', '', '', ''];
                newQuestions[index].correctAnswerIndex = 0;
            } else if (value === 'true-false') {
                newQuestions[index].correctAnswer = true;
            } else if (value === 'short-answer') {
                newQuestions[index].correctAnswer = '';
            }
        }
        else {
            newQuestions[index][field] = value;
        }
        setQuestions(newQuestions);
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!title.trim() || (durationHr === 0 && durationMin === 0) || questionsToAnswer > questions.length) {
            setError('Please fill out all required fields and ensure questions to answer is not more than total questions.');
            setLoading(false);
            return;
        }

        const windowStart = testDate && testTime ? Timestamp.fromDate(new Date(`${testDate}T${testTime}`)) : null;
        const windowEnd   = windowEndDate && windowEndTime ? Timestamp.fromDate(new Date(`${windowEndDate}T${windowEndTime}`)) : null;

        try {
            await addDoc(collection(db, "exams"), {
                title, duration: (durationHr * 60) + durationMin, className, subjectName,
                startDateTime: windowStart, // keep for backwards compat
                windowStart, windowEnd,
                useAccessCode, accessCode, shuffleQuestions, shuffleOptions,
                showScoreImmediately, allowTabSwitch, maxTabSwitches: Number(maxTabSwitches),
                instructions, questionsToAnswer: Number(questionsToAnswer), questions,
                passMarkPercentage: Number(passMarkPercentage),
                status: 'Draft', teacherId: currentUser.uid, createdAt: new Date(),
            });
            setPage('exam-management');
        } catch (err) {
            setError('Failed to create exam. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    const generateAccessCode = () => {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        setAccessCode(code);
    };
    
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split('\n').filter(line => line.trim() !== '');
                const newQuestions = lines.map(line => {
                    const parts = line.split(',').map(part => part.trim().replace(/"/g, ''));
                    const type = parts[0], text = parts[1], marks = parseInt(parts[2]);
                    if (type === 'multiple-choice' && parts.length >= 8) return { type, text, marks, options: [parts[3], parts[4], parts[5], parts[6]], correctAnswerIndex: parseInt(parts[7]) - 1 };
                    if (type === 'true-false' && parts.length >= 4) return { type, text, marks, correctAnswer: parts[3].toLowerCase() === 'true' };
                    if (type === 'short-answer' && parts.length >= 4) return { type, text, marks, correctAnswer: parts[3] };
                    return null;
                }).filter(q => q !== null);
                if (newQuestions.length > 0) setQuestions(prev => [...prev, ...newQuestions]);
                else toast.error("Could not parse any valid questions from the file. Please check the format.");
                setIsUploadModalOpen(false);
            };
            reader.readAsText(file);
        }
    };

    const handleDownloadSample = () => {
        const sampleData = `type,text,marks,optionA,optionB,optionC,optionD,correctAnswerIndex\nmultiple-choice,"What is the capital of Nigeria?",1,"Lagos","Abuja","Kano","Ibadan",2\ntrue-false,"Is React a JavaScript library?",1,true\nshort-answer,"What is the chemical symbol for water?",2,H2O`;
        const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "sample_questions.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Add New Test</h1>
            {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border p-6 rounded-md">
                   <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Test / Examination Name</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Questions Added</label>
                        <input type="number" value={questions.length} readOnly className="w-full p-2 border border-gray-300 rounded-md bg-gray-100" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Questions to Answer *</label>
                        <input type="number" value={questionsToAnswer} onChange={(e) => setQuestionsToAnswer(e.target.value)} max={questions.length} min="1" className="w-full p-2 border border-gray-300 rounded-md" required/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CLASSES *</label>
                        <select value={className} onChange={(e) => setClassName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                            <option value="">Select Class</option>
                            {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end gap-2 lg:col-span-3">
                        <div className="flex-grow">
                            <label className="block text-sm font-medium text-gray-700 mb-1">SUBJECTS *</label>
                            <select value={subjectName} onChange={(e) => setSubjectName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                                <option value="">Select Subject</option>
                                {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <button type="button" className="bg-blue-500 text-white p-2 rounded-md h-10"><PlusCircle size={20}/></button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Window Start Date</label>
                        <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input type="time" value={testTime} onChange={(e) => setTestTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Window End Date</label>
                        <input type="date" value={windowEndDate} onChange={(e) => setWindowEndDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                        <input type="time" value={windowEndTime} onChange={(e) => setWindowEndTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                        <div className="flex gap-4">
                            <select value={durationHr} onChange={(e) => setDurationHr(parseInt(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                                {[...Array(6).keys()].map(h => <option key={h} value={h}>{h} Hr</option>)}
                            </select>
                             <select value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                                {[...Array(60).keys()].map(m => <option key={m} value={m}>{m} Min</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pass Mark (%)</label>
                        <input type="number" value={passMarkPercentage} onChange={(e) => setPassMarkPercentage(e.target.value)} min="1" max="100" className="w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-4">
                        <div className="flex items-center">
                            <input type="checkbox" id="shuffleQuestions" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            <label htmlFor="shuffleQuestions" className="ml-2 block text-sm text-gray-900">Shuffle Questions</label>
                        </div>
                         <div className="flex items-center">
                            <input type="checkbox" id="shuffleOptions" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            <label htmlFor="shuffleOptions" className="ml-2 block text-sm text-gray-900">Shuffle Options</label>
                        </div>
                        <div className="flex items-center">
                            <input type="checkbox" id="useAccessCode" checked={useAccessCode} onChange={(e) => setUseAccessCode(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            <label htmlFor="useAccessCode" className="ml-2 block text-sm text-gray-900">Use Access Code</label>
                        </div>
                        <div className="flex items-center">
                            <input type="checkbox" id="showScoreImmediately" checked={showScoreImmediately} onChange={(e) => setShowScoreImmediately(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            <label htmlFor="showScoreImmediately" className="ml-2 block text-sm text-gray-900">Show Score Immediately</label>
                        </div>
                        <div className="flex items-center">
                            <input type="checkbox" id="allowTabSwitch" checked={allowTabSwitch} onChange={(e) => setAllowTabSwitch(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                            <label htmlFor="allowTabSwitch" className="ml-2 block text-sm text-gray-900">Allow Tab Switching</label>
                        </div>
                    </div>
                    {!allowTabSwitch && (
                        <div className="lg:col-span-4 flex items-center gap-3">
                            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Auto-submit after</label>
                            <input type="number" value={maxTabSwitches} min={1} max={10} onChange={e => setMaxTabSwitches(e.target.value)} className="w-20 p-2 border border-gray-300 rounded-md" />
                            <label className="text-sm text-gray-500">tab switch violation(s)</label>
                        </div>
                    )}
                    {useAccessCode && (
                         <div className="lg:col-span-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Access Code</label>
                            <div className="flex items-center gap-2">
                                <input type="text" value={accessCode} readOnly className="w-full p-2 border border-gray-300 rounded-md bg-gray-100" />
                                <button type="button" onClick={generateAccessCode} className="bg-gray-200 px-4 py-2 rounded-md">Generate</button>
                            </div>
                        </div>
                    )}
                     <div className="lg:col-span-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" rows="4"></textarea>
                    </div>
                </div>
                
                <div className="flex justify-between items-center bg-blue-50 border-l-4 border-blue-500 p-4 text-blue-800">
                    <p className="hidden md:block">Manually add questions, select from bank, or bulk upload.</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setIsBankModalOpen(true)} className="bg-green-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2">
                            <Book size={18} /> Select from Bank
                        </button>
                        <button type="button" onClick={() => setIsUploadModalOpen(true)} className="bg-blue-500 text-white font-semibold px-4 py-2 rounded-md hover:bg-blue-600 flex items-center gap-2">
                            <UploadCloud size={18} /> Bulk Upload
                        </button>
                    </div>
                </div>

                {questions.map((q, qIndex) => (
                    <div key={qIndex} className="p-4 border rounded-md space-y-4 bg-red-50 border-red-200">
                         <div className="flex justify-between items-center bg-red-200 p-2 rounded-t-md -m-4 mb-4">
                            <label className="block font-bold text-red-800">No. {qIndex + 1}</label>
                            <button type="button" onClick={() => handleRemoveQuestion(qIndex)} className="text-red-600 font-semibold hover:text-red-800">
                                Remove Question
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                                <textarea placeholder="Enter question here..." value={q.text} onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" rows="3" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                                <select value={q.type} onChange={(e) => handleQuestionChange(qIndex, 'type', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white">
                                    <option value="multiple-choice">Multiple Choice</option>
                                    <option value="true-false">True / False</option>
                                    <option value="short-answer">Short Answer</option>
                                </select>
                            </div>
                        </div>
                        {q.type === 'multiple-choice' && q.options.map((opt, oIndex) => (
                            <div key={oIndex} className="flex items-start space-x-2">
                                <div className="flex flex-col items-center pt-1 shrink-0">
                                    <span className="font-bold text-gray-600">{String.fromCharCode(97 + oIndex)})</span>
                                    <input type="radio" name={`correctAnswer_${qIndex}`} checked={q.correctAnswerIndex === oIndex} onChange={() => handleQuestionChange(qIndex, 'correctAnswerIndex', oIndex)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"/>
                                    <label className="text-xs text-gray-500">Correct</label>
                                </div>
                                <textarea placeholder={`Option ${String.fromCharCode(97 + oIndex)}`} value={opt} onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" required />
                                {q.options.length > 2 && (
                                    <button type="button" onClick={() => handleRemoveOption(qIndex, oIndex)} className="mt-1 text-red-400 hover:text-red-600 shrink-0" title="Remove option">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {q.type === 'true-false' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                                <div className="flex gap-4">
                                    <label><input type="radio" name={`correctAnswer_${qIndex}`} checked={q.correctAnswer === true} onChange={() => handleQuestionChange(qIndex, 'correctAnswer', true)} /> True</label>
                                    <label><input type="radio" name={`correctAnswer_${qIndex}`} checked={q.correctAnswer === false} onChange={() => handleQuestionChange(qIndex, 'correctAnswer', false)} /> False</label>
                                </div>
                            </div>
                        )}
                        {q.type === 'short-answer' && (
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer (Case-sensitive)</label>
                                <input type="text" value={q.correctAnswer || ''} onChange={(e) => handleQuestionChange(qIndex, 'correctAnswer', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" required />
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-4">
                            {q.type === 'multiple-choice' && (
                                <button type="button" onClick={() => handleAddOption(qIndex)} className="text-blue-600 font-semibold text-sm hover:underline flex items-center gap-1">
                                    <PlusCircle size={15} /> Add Option
                                </button>
                            )}
                            <div className="ml-auto">
                                <label className="text-sm font-medium text-gray-700 mr-2">Marks</label>
                                <input type="number" value={q.marks} onChange={(e) => handleQuestionChange(qIndex, 'marks', e.target.value)} className="p-1 border border-gray-300 rounded-md w-20" />
                            </div>
                        </div>
                    </div>
                ))}

                <button type="button" onClick={handleAddQuestion} className="text-blue-600 font-semibold flex items-center hover:underline">
                    <PlusCircle className="mr-2 h-5 w-5" /> Add Another Question
                </button>

                <div className="flex justify-start space-x-4 pt-6 border-t">
                    <button type="submit" disabled={loading} className="bg-red-500 text-white font-semibold px-6 py-2 rounded-md hover:bg-red-600 transition duration-300 disabled:bg-red-300">
                        {loading ? <Spinner /> : 'Save'}
                    </button>
                    <button type="button" onClick={() => setPage('exam-management')} className="bg-gray-200 text-gray-700 font-semibold px-6 py-2 rounded-md hover:bg-gray-300">
                        Cancel
                    </button>
                </div>
            </form>

            <QuestionBankModal
                isOpen={isBankModalOpen}
                onClose={() => setIsBankModalOpen(false)}
                onAddQuestions={handleAddQuestionsFromBank}
            />

            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Bulk Upload Questions">
                 <div className="prose max-w-none">
                    <p>Upload a CSV file with questions. The file must follow a specific format:</p>
                    <ul>
                        <li>The first column must be the question type: <code>multiple-choice</code>, <code>true-false</code>, or <code>short-answer</code>.</li>
                        <li>Each row must have the correct number of columns for its question type.</li>
                    </ul>
                    <p><strong>Examples:</strong></p>
                    <pre className="bg-gray-100 p-2 rounded-md"><code>
                        multiple-choice,"What is 2+2?",1,"3","4","5","6",2<br/>
                        true-false,"The sky is blue.",1,true<br/>
                        short-answer,"What is the capital of France?",2,Paris
                    </code></pre>
                     <div className="mt-4 flex items-center gap-4">
                        <input type="file" accept=".csv" onChange={handleFileUpload} />
                        <button onClick={handleDownloadSample} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md">Download Sample</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CreateExam;
