import React from 'react';
import { Bell } from 'lucide-react';

const Notifications = ({ notifications, onMarkAllAsRead, onClose }) => {
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="absolute top-16 right-6 w-80 bg-white rounded-lg shadow-xl border z-50">
            <div className="p-3 flex justify-between items-center border-b">
                <h3 className="font-bold text-gray-800">Notifications</h3>
                {unreadCount > 0 && (
                    <button 
                        onClick={onMarkAllAsRead}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                    >
                        Mark all as read
                    </button>
                )}
            </div>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                    <p className="text-center text-gray-500 p-6">You have no notifications.</p>
                ) : (
                    notifications.map(notification => (
                        <div key={notification.id} className={`p-3 border-b hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''}`}>
                            <div className="flex items-start">
                                <div className="pt-1 mr-3">
                                    {notification.type === 'EXAM_SUBMITTED' && <Bell size={16} className="text-blue-500" />}
                                </div>
                                <div>
                                    <p className="text-sm text-gray-700">{notification.message}</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {new Date(notification.timestamp.seconds * 1000).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Notifications;
