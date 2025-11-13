import React, { useState, useEffect } from 'react';
import { Lock, Mail, Chrome, Hash, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useApi } from '../contexts/ApiContext';

const LoginPage = ({ onLoginSuccess, isDisabled }) => {
    const { apiBaseUrl, isConnected } = useApi();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [inputType, setInputType] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [formData, setFormData] = useState({
        emailOrNip: '',
        password: ''
    });

    // ❌ REMOVED: Auto-login check yang menyebabkan login loop
    // useEffect yang lama sudah dihapus

    const showMessage = (text, type) => {
        setMessage({ text, type });
        if (type !== 'loading') {
            setTimeout(() => {
                setMessage({ text: '', type: '' });
            }, 5000);
        }
    };

    const detectInputType = (value) => {
        if (!value) return null;
        const isAllNumbers = /^\d+$/.test(value);
        if (isAllNumbers) return 'nip';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(value)) return 'email';
        if (value.includes('@')) return 'email-partial';
        return null;
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setFormData({ ...formData, emailOrNip: value });
        setInputType(detectInputType(value));
        setMessage({ text: '', type: '' });
    };

    const handlePasswordChange = (e) => {
        setFormData({ ...formData, password: e.target.value });
        setMessage({ text: '', type: '' });
    };

    // ✅ Login handler with auto-fill support
    const handleLogin = async (loginType = 'google') => {
        if (!apiBaseUrl) {
            showMessage('Backend belum terhubung. Tunggu sebentar...', 'error');
            return;
        }

        setIsLoading(true);
        showMessage('Opening browser for login... Form will be auto-filled.', 'loading');

        try {
            const response = await fetch(`${apiBaseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emailOrNip: formData.emailOrNip,
                    password: formData.password,
                    loginType: loginType // 'email', 'nip', or 'google'
                })
            });

            const result = await response.text();

            if (result === 'Login Success') {
                showMessage('✓ Login successful! Redirecting...', 'success');

                const userData = {
                    loginMethod: loginType,
                    emailOrNip: formData.emailOrNip,
                    timestamp: Date.now()
                };

                // ✅ Save to localStorage ONLY after successful login
                localStorage.setItem('serahPetaUser', JSON.stringify(userData));

                // Redirect after 1 second
                setTimeout(() => {
                    onLoginSuccess(userData);
                }, 1000);
            } else {
                throw new Error('Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('✗ Login failed. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailLogin = () => handleLogin('email');
    const handleNIPLogin = () => handleLogin('nip');
    const handleGoogleLogin = () => handleLogin('google');

    const isEmailButtonEnabled = inputType === 'email' && formData.password;
    const isNIPButtonEnabled = inputType === 'nip' && formData.password;

    return (
        <div className={`flex flex-col items-center justify-center min-h-full py-4 sm:py-6 lg:py-8 px-4 transition-opacity ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="w-full max-w-[400px]">
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#143079] mb-2">
                        Selamat Datang
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-600">Silakan login untuk melanjutkan</p>
                </div>

                {message.text && (
                    <div className={`mb-4 p-3 sm:p-4 rounded-lg flex items-center gap-3 ${message.type === 'success'
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : message.type === 'loading'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                        {message.type === 'success' ? (
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                        ) : message.type === 'loading' ? (
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 animate-spin" />
                        ) : (
                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                        )}
                        <p className="text-xs sm:text-sm flex-1" dangerouslySetInnerHTML={{ __html: message.text }} />
                    </div>
                )}

                <div className="bg-[#F0F4FF] py-4 sm:py-6 px-4 sm:px-6 rounded-lg shadow-sm">
                    <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-[#143079] mb-2">
                                Email / NIP
                            </label>
                            <div className="relative">
                                {inputType === 'nip' ? (
                                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#143079]" />
                                ) : (
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#143079]" />
                                )}
                                <input
                                    type="text"
                                    name="emailOrNip"
                                    value={formData.emailOrNip}
                                    onChange={handleInputChange}
                                    placeholder="Masukkan email atau NIP"
                                    className="w-full border border-[#143079] rounded-md pl-9 sm:pl-10 pr-4 py-2 h-[44px] sm:h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
                                    disabled={isLoading}
                                />
                                {inputType && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <span className={`text-xs px-2 py-1 rounded ${inputType === 'email' ? 'bg-blue-100 text-blue-700' :
                                            inputType === 'nip' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                            {inputType === 'email' ? 'Email' : inputType === 'nip' ? 'NIP' : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {inputType === 'email' && '✓ Format email terdeteksi'}
                                {inputType === 'nip' && '✓ Format NIP terdeteksi'}
                                {inputType === 'email-partial' && 'Lengkapi format email Anda'}
                                {!inputType && formData.emailOrNip && 'Format tidak dikenali'}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-[#143079] mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#143079]" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handlePasswordChange}
                                    placeholder="Masukkan password"
                                    className="w-full border border-[#143079] rounded-md pl-9 sm:pl-10 pr-10 sm:pr-12 py-2 h-[44px] sm:h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
                                    disabled={isLoading}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            if (isEmailButtonEnabled || isNIPButtonEnabled) {
                                                handleLogin();
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#143079] hover:text-blue-600"
                                    disabled={isLoading}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center my-4">
                        <div className="flex-1 border-t border-gray-300"></div>
                        <span className="px-3 text-xs text-gray-500">atau</span>
                        <div className="flex-1 border-t border-gray-300"></div>
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full flex items-center justify-center gap-2 sm:gap-3 border-2 border-[#143079] rounded-md py-2.5 sm:py-3 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#143079] animate-spin" />
                            ) : (
                                <Chrome className="w-4 h-4 sm:w-5 sm:h-5 text-[#143079]" />
                            )}
                            <span className="text-xs sm:text-sm font-semibold text-[#143079]">
                                {isLoading ? 'Opening browser...' : 'Login with Google'}
                            </span>
                        </button>

                        <button
                            onClick={handleNIPLogin}
                            disabled={!isNIPButtonEnabled || isLoading}
                            className={`w-full flex items-center justify-center gap-2 sm:gap-3 rounded-md py-2.5 sm:py-3 transition ${isNIPButtonEnabled
                                ? 'bg-[#143079] text-white hover:bg-blue-800'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isLoading && inputType === 'nip' ? (
                                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            ) : (
                                <Hash className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                            <span className="text-xs sm:text-sm font-semibold">
                                {isLoading && inputType === 'nip' ? 'Opening browser...' : 'Login with NIP'}
                            </span>
                        </button>

                        <button
                            onClick={handleEmailLogin}
                            disabled={!isEmailButtonEnabled || isLoading}
                            className={`w-full flex items-center justify-center gap-2 sm:gap-3 rounded-md py-2.5 sm:py-3 transition ${isEmailButtonEnabled
                                ? 'bg-[#143079] text-white hover:bg-blue-800'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isLoading && inputType === 'email' ? (
                                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            ) : (
                                <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                            <span className="text-xs sm:text-sm font-semibold">
                                {isLoading && inputType === 'email' ? 'Opening browser...' : 'Login with Email'}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500">
                        💡 Form login akan diisi otomatis di browser
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        Anda hanya perlu klik tombol login jika diperlukan
                    </p>
                    {!apiBaseUrl && (
                        <p className="text-xs text-orange-500 mt-2">
                            ⏳ Menunggu koneksi backend...
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;