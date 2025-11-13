import React from 'react';
import { X, Check, AlertCircle, Loader2, Bell } from 'lucide-react';

const NotificationToast = ({ notifications, onClose }) => {
    if (notifications.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 w-96 space-y-2 z-50">
            {notifications.map((notif) => (
                <div
                    key={notif.id}
                    className={`bg-white rounded-lg shadow-lg border-l-4 p-4 flex items-start gap-3 animate-slideIn ${notif.type === 'success' ? 'border-green-500' :
                        notif.type === 'error' ? 'border-red-500' :
                            notif.type === 'progress' ? 'border-blue-500' :
                                'border-yellow-500'
                        }`}
                >
                    <div className={`flex-shrink-0 ${notif.type === 'success' ? 'text-green-500' :
                        notif.type === 'error' ? 'text-red-500' :
                            notif.type === 'progress' ? 'text-blue-500' :
                                'text-yellow-500'
                        }`}>
                        {notif.type === 'success' ? <Check className="w-5 h-5" /> :
                            notif.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                                notif.type === 'progress' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                                    <Bell className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-sm text-gray-900">{notif.title}</h4>
                        {notif.message && (
                            <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
                        )}
                        {notif.progress !== undefined && (
                            <div className="mt-2">
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>{notif.fileName}</span>
                                    <span>{notif.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${notif.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => onClose(notif.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default NotificationToast;