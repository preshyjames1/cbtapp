import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// Firebase services, now including notification-related functions
import { db, collection, query, onSnapshot, orderBy, writeBatch, doc } from './services/firebase';

// Icons used in the main layout (Header and Sidebar)
import { LogOut, LayoutDashboard, FileText, ClipboardList, Users, BarChart2, Bell } from 'lucide-react';

// Your reusable common components
import Modal from './components/common/Modal';
import Notifications from './components/common/Notifications'; // New component

// All of your page components
import AuthComponent from './pages/AuthComponent';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ExamManagement from './pages/ExamManagement';
import QuestionBank from './pages/QuestionBank';
import UserManagement from './pages/UserManagement';
import Reports from './pages/Reports';
import CreateExam from './pages/CreateExam';
import EditExam from './pages/EditExam';
import ExamInstructions from './pages/ExamInstructions';
import TakeExam from './pages/TakeExam';
import ViewResults from './pages/ViewResults';

// The main export just sets up the providers
export default function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}

// This component contains all your app's layout and logic
function AppLayout() {
  const { currentUser, logout } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [selectedExam, setSelectedExam] = useState(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // State for Notifications
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Effect to set the initial page based on user role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
        setPage('exam-management');
      } else {
        setPage('dashboard');
      }
    }
  }, [currentUser]);

  // Effect to fetch notifications for admins
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      const q = query(collection(db, "notifications"), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNotifications(notifs);
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  // Handler to mark all notifications as read
  const handleMarkAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read);
    if (unreadNotifs.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifs.forEach(notif => {
      const notifRef = doc(db, "notifications", notif.id);
      batch.update(notifRef, { read: true });
    });
    await batch.commit();
  };

  const handleSignOut = async () => {
    await logout();
    setIsLogoutModalOpen(false);
  };

  if (!currentUser) {
    return <AuthComponent />;
  }
  
  const unreadCount = notifications.filter(n => !n.read).length;

  const Sidebar = () => {
    const navItems = {
      admin: [
        { name: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
        { name: 'Exam Management', icon: FileText, page: 'exam-management' },
        { name: 'Question Bank', icon: ClipboardList, page: 'question-bank' },
        { name: 'User Management', icon: Users, page: 'user-management' },
        { name: 'Reports', icon: BarChart2, page: 'reports' },
      ],
      teacher: [
        { name: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
        { name: 'Exam Management', icon: FileText, page: 'exam-management' },
        { name: 'Question Bank', icon: ClipboardList, page: 'question-bank' },
      ],
    };
    const items = navItems[currentUser.role] || [];
    
    return (
      <div className="w-64 bg-gray-800 text-white flex flex-col min-h-screen">
        <div className="p-4 text-2xl font-bold border-b border-gray-700">Exam Platform</div>
        <nav className="flex-grow p-2">
          {items.map((item) => (
            <button
              key={item.name}
              onClick={() => setPage(item.page)}
              className={`w-full flex items-center p-3 my-1 rounded-lg transition-colors ${page === item.page ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            >
              <item.icon className="mr-3" size={20} />
              {item.name}
            </button>
          ))}
        </nav>
      </div>
    );
  };

  const renderContent = () => {
    switch (page) {
      case 'create-exam':
        return <CreateExam setPage={setPage} />;
      case 'edit-exam':
        return <EditExam setPage={setPage} examToEdit={selectedExam} />;
      case 'instructions':
        return <ExamInstructions exam={selectedExam} onStartExam={() => setPage('take-exam')} onBackToDashboard={() => setPage('dashboard')} />;
      case 'take-exam':
        return <TakeExam exam={selectedExam} setPage={setPage} />;
      case 'view-results':
        return <ViewResults exam={selectedExam} setPage={setPage} />;
      case 'dashboard':
        if (currentUser.role === 'admin') return <AdminDashboard setPage={setPage} />;
        if (currentUser.role === 'teacher') return <TeacherDashboard setPage={setPage} setSelectedExam={setSelectedExam} />;
        return <StudentDashboard setPage={setPage} setSelectedExam={setSelectedExam} />;
      case 'exam-management':
        if (currentUser.role === 'admin') return <ExamManagement setPage={setPage} setSelectedExam={setSelectedExam} />;
        if (currentUser.role === 'teacher') return <TeacherDashboard setPage={setPage} setSelectedExam={setSelectedExam} />;
        break;
      case 'question-bank':
        return <QuestionBank />;
      case 'user-management':
        return <UserManagement />;
      case 'reports':
        return <Reports />;
      default:
        return <StudentDashboard setPage={setPage} setSelectedExam={setSelectedExam} />;
    }
  };

  const isAdminOrTeacher = currentUser.role === 'admin' || currentUser.role === 'teacher';

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <Toaster position="top-center" reverseOrder={false} />
      <header className="bg-white shadow-md">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-600">Exam Platform by P</div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700 hidden sm:block">
              Welcome, <span className="font-semibold">{currentUser.name || currentUser.email}</span> (<span className="capitalize">{currentUser.role}</span>)
            </span>
            
            {currentUser.role === 'admin' && (
              <div className="relative">
                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative text-gray-600 hover:text-blue-600">
                  <Bell size={24} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-xs items-center justify-center">{unreadCount}</span>
                    </span>
                  )}
                </button>
                {isNotificationsOpen && (
                  <Notifications 
                    notifications={notifications}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onClose={() => setIsNotificationsOpen(false)}
                  />
                )}
              </div>
            )}

            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className="bg-red-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition duration-300 flex items-center"
            >
              <LogOut className="mr-2 h-5 w-5" /> Logout
            </button>
          </div>
        </nav>
      </header>
      <div className="flex">
        {isAdminOrTeacher && <Sidebar />}
        <main className="flex-grow p-6">
          {renderContent()}
        </main>
      </div>
      <Modal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} title="Confirm Logout">
        <p>Are you sure you want to log out?</p>
        <div className="flex justify-end space-x-4 mt-6">
          <button onClick={() => setIsLogoutModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
          <button onClick={handleSignOut} className="px-4 py-2 bg-red-600 text-white rounded-lg">Logout</button>
        </div>
      </Modal>
    </div>
  );
}
