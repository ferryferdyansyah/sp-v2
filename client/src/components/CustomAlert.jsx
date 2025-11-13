import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

const CustomAlert = ({ type, title, message, onClose, onConfirm, onCancel, autoClose = true, duration = 3000 }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        setIsAnimating(true);

        if (autoClose && type !== 'confirm') {
            const timer = setTimeout(() => {
                handleClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(() => {
            setIsVisible(false);
            if (onClose) onClose();
        }, 300);
    };

    if (!isVisible) return null;

    const alertStyles = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-500',
            text: 'text-green-800',
            icon: <CheckCircle className="w-6 h-6 text-green-500" />,
            buttonBg: 'bg-green-500 hover:bg-green-600'
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-500',
            text: 'text-red-800',
            icon: <XCircle className="w-6 h-6 text-red-500" />,
            buttonBg: 'bg-red-500 hover:bg-red-600'
        },
        warning: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-500',
            text: 'text-yellow-800',
            icon: <AlertCircle className="w-6 h-6 text-yellow-500" />,
            buttonBg: 'bg-yellow-500 hover:bg-yellow-600'
        },
        confirm: {
            bg: 'bg-blue-50',
            border: 'border-[#143079]',
            text: 'text-[#143079]',
            icon: <CheckCircle className="w-6 h-6 text-[#143079]" />,
            buttonBg: 'bg-[#143079] hover:bg-blue-700'
        }
    };

    const style = alertStyles[type] || alertStyles.success;

    return (
        <>
            {type === 'confirm' && (
                <div
                    className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${isAnimating ? 'opacity-50' : 'opacity-0'
                        }`}
                    onClick={handleClose}
                />
            )}

            <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${isAnimating ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
                }`}>
                <div className={`${style.bg} ${style.border} border-l-4 rounded-lg shadow-2xl p-4 min-w-[400px] max-w-[500px]`}>
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            {style.icon}
                        </div>

                        <div className="flex-1">
                            {title && (
                                <h3 className={`font-bold text-lg mb-1 ${style.text}`}>
                                    {title}
                                </h3>
                            )}
                            <p className={`text-sm ${style.text}`}>
                                {message}
                            </p>

                            {type === 'confirm' && (
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => {
                                            if (onConfirm) onConfirm();
                                            handleClose();
                                        }}
                                        className={`flex-1 px-4 py-2 ${style.buttonBg} text-white rounded-md font-medium transition text-sm`}
                                    >
                                        Ya, Lanjutkan
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (onCancel) onCancel();
                                            handleClose();
                                        }}
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-400 transition text-sm"
                                    >
                                        Batal
                                    </button>
                                </div>
                            )}
                        </div>

                        {type !== 'confirm' && (
                            <button
                                onClick={handleClose}
                                className={`flex-shrink-0 ${style.text} hover:opacity-70 transition`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {autoClose && type !== 'confirm' && (
                        <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${style.buttonBg}`}
                                style={{
                                    animation: `shrink ${duration}ms linear`
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </>
    );
};

export const useAlert = () => {
    const [alert, setAlert] = useState(null);

    const showAlert = ({ type, title, message, onConfirm, onCancel, autoClose = true, duration = 3000 }) => {
        setAlert({ type, title, message, onConfirm, onCancel, autoClose, duration });
    };

    const closeAlert = () => {
        setAlert(null);
    };

    const AlertComponent = alert ? (
        <CustomAlert {...alert} onClose={closeAlert} />
    ) : null;

    return { showAlert, AlertComponent };
};

export default CustomAlert;