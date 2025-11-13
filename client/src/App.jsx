import React, { useState, useEffect } from 'react';
import { Loader2, Menu, X } from 'lucide-react';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import UploadPage from './pages/UploadPage';
import NotificationToast from './components/NotificationToast';
import { ApiProvider, useApi } from './contexts/ApiContext';

const AppContent = () => {
  const { apiBaseUrl, isConnected } = useApi();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notifIdCounter, setNotifIdCounter] = useState(0);

  // Mobile view state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState('login'); // 'login' or 'upload'

  // ============= SESSION MANAGEMENT =============
  useEffect(() => {
    if (apiBaseUrl && isConnected) {
      checkSavedSession();
    }
  }, [apiBaseUrl, isConnected]);

  const checkSavedSession = async () => {
    try {
      const savedUser = localStorage.getItem('serahPetaUser');

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        console.log('✅ Found saved session:', parsedUser);

        const response = await fetch(`${apiBaseUrl}/getCurrentUser`);
        const data = await response.json();

        if (data.success && data.user) {
          console.log('✅ Session verified, auto-login');
          setUserData(parsedUser);
          setIsLoggedIn(true);
          setActivePanel('upload'); // Switch to upload on mobile

          addNotification(
            'success',
            'Session Restored!',
            `Selamat datang kembali, ${parsedUser.name || parsedUser.email || parsedUser.nip}!`
          );
        } else {
          console.log('⚠️ Session expired, clearing localStorage');
          localStorage.removeItem('serahPetaUser');
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
      localStorage.removeItem('serahPetaUser');
    } finally {
      setIsCheckingSession(false);
    }
  };

  // ============= NOTIFICATION MANAGEMENT =============
  const addNotification = (type, title, message, progress, fileName) => {
    const id = notifIdCounter;
    setNotifIdCounter(id + 1);
    setNotifications(prev => [...prev, { id, type, title, message, progress, fileName }]);

    if (type !== 'progress') {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // ============= LOGIN HANDLER =============
  const handleLoginSuccess = (credentials) => {
    console.log('🎉 Login success handler called:', credentials);

    setIsLoggedIn(true);
    setUserData(credentials);
    setActivePanel('upload'); // Switch to upload panel on mobile

    let welcomeMessage = '';

    switch (credentials.loginMethod) {
      case 'browser':
        welcomeMessage = 'Selamat datang!';
        break;
      case 'google':
        welcomeMessage = `Selamat datang, ${credentials.name}!`;
        break;
      case 'nip':
        welcomeMessage = `Selamat datang, NIP: ${credentials.nip}`;
        break;
      case 'email':
        welcomeMessage = `Selamat datang, ${credentials.email}`;
        break;
      default:
        welcomeMessage = 'Selamat datang!';
    }

    addNotification('success', 'Login Berhasil!', welcomeMessage);
  };

  // ============= LOGOUT HANDLER =============
  const handleLogout = async () => {
    try {
      await fetch(`${apiBaseUrl}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    // ✅ Clear ALL localStorage data
    localStorage.removeItem('serahPetaUser');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loginTime');

    // Reset all state
    setIsLoggedIn(false);
    setUserData(null);
    setActivePanel('login'); // Switch back to login on mobile

    // ✅ TAMBAHKAN INI: Reset notifications
    setNotifications([]);

    addNotification('info', 'Logout Berhasil', 'Anda telah keluar dari sistem');
  };

  // ============= UPLOAD HANDLER =============
  const handleUploadSubmit = async (type, data) => {
    console.log('📤 Upload submitted:', type, data);

    try {
      const endpoint = type === 'mbtiles'
        ? '/automation_mbtiles'
        : '/automation_xyztiles';

      addNotification('info', 'Upload Started', `Processing ${data.fileCount} file(s)...`);

      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolusi: data.resolusi,
          akurasi: data.akurasi,
          tahunSurvey: data.tahunSurvei,
          sumberData: data.sumberData,
          nomorHP: data.nomorHP,
          filePaths: data.filePaths
        })
      });

      const result = await response.json();

      if (result.success) {
        addNotification(
          'success',
          'Upload Complete!',
          `Files added to queue successfully`
        );
      } else {
        addNotification('error', 'Upload Failed', result.error || 'Unknown error');
      }

    } catch (error) {
      console.error('Upload error:', error);
      addNotification('error', 'Upload Error', error.message);
    }
  };

  // ============= LOADING STATE =============
  if (isCheckingSession || !isConnected) {
    return (
      <div className="h-screen w-screen flex flex-col justify-center items-center bg-gray-50 font-poppins">
        <Loader2 className="w-12 h-12 text-[#143079] animate-spin mb-4" />
        <p className="text-gray-600 text-sm px-4 text-center">
          {!isConnected ? 'Menunggu koneksi backend...' : 'Memeriksa session...'}
        </p>
      </div>
    );
  }

  // ============= MAIN RENDER =============
  return (
    <div className="h-screen w-screen flex flex-col font-poppins overflow-hidden">
      <Header
        isLoggedIn={isLoggedIn}
        userData={userData}
        onLogout={handleLogout}
      />

      {/* Mobile Navigation Tabs */}
      {isLoggedIn && (
        <div className="lg:hidden flex bg-white border-b border-gray-200 sticky top-0 z-10">
          <button
            onClick={() => setActivePanel('login')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition ${activePanel === 'login'
              ? 'bg-[#143079] text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActivePanel('upload')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition ${activePanel === 'upload'
              ? 'bg-[#143079] text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            Upload
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop: Two Panels Side by Side */}
        {/* Mobile: Single Panel Based on activePanel */}

        {/* Left Side - Login/Profile */}
        <div className={`w-full lg:w-3/10 bg-white overflow-y-auto ${isLoggedIn && activePanel === 'upload' ? 'hidden lg:block' : ''
          }`}>
          {isLoggedIn ? (
            // Show user info after login
            <div className="flex items-center justify-center min-h-full p-4 sm:p-6 lg:p-8">
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full border border-gray-100">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#143079] mb-2">Login Berhasil!</h2>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {window.innerWidth < 1024
                      ? 'Tap "Upload" di atas untuk mulai upload'
                      : 'Silakan lanjutkan upload di panel sebelah kanan'
                    }
                  </p>
                </div>

                {userData?.picture && (
                  <div className="flex justify-center mb-6">
                    <img
                      src={userData.picture}
                      alt="Profile"
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-blue-100 shadow-md object-cover"
                    />
                  </div>
                )}

                <div className="bg-[#F0F4FF] rounded-lg p-4 sm:p-6 mb-6 space-y-2 sm:space-y-3">
                  {userData?.name && (
                    <div className="flex items-start">
                      <span className="text-xs sm:text-sm font-semibold text-[#143079] min-w-[80px] sm:min-w-[100px]">Nama:</span>
                      <span className="text-xs sm:text-sm text-gray-700 flex-1 break-words">{userData.name}</span>
                    </div>
                  )}

                  {userData?.email && (
                    <div className="flex items-start">
                      <span className="text-xs sm:text-sm font-semibold text-[#143079] min-w-[80px] sm:min-w-[100px]">Email:</span>
                      <span className="text-xs sm:text-sm text-gray-700 flex-1 break-all">{userData.email}</span>
                    </div>
                  )}

                  {userData?.nip && (
                    <div className="flex items-start">
                      <span className="text-xs sm:text-sm font-semibold text-[#143079] min-w-[80px] sm:min-w-[100px]">NIP:</span>
                      <span className="text-xs sm:text-sm text-gray-700 flex-1">{userData.nip}</span>
                    </div>
                  )}

                  <div className="flex items-start pt-2 border-t border-blue-200">
                    <span className="text-xs sm:text-sm font-semibold text-[#143079] min-w-[80px] sm:min-w-[100px]">Login Via:</span>
                    <span className="text-xs sm:text-sm text-gray-700 flex-1 capitalize">
                      {userData?.loginMethod === 'browser' && '🌐 Browser'}
                      {userData?.loginMethod === 'google' && '🔐 Google Account'}
                      {userData?.loginMethod === 'email' && '📧 Email & Password'}
                      {userData?.loginMethod === 'nip' && '🆔 NIP & Password'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full bg-[#143079] text-white py-2.5 sm:py-3 rounded-lg hover:bg-blue-800 transition font-semibold shadow-md hover:shadow-lg text-sm sm:text-base"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            // Show login form
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              isDisabled={false}
            />
          )}
        </div>

        {/* Right Side - Upload */}
        <div className={`w-full lg:w-7/10 bg-white overflow-y-auto border-l border-gray-200 ${isLoggedIn && activePanel === 'login' ? 'hidden lg:block' : ''
          } ${!isLoggedIn ? 'hidden lg:block' : ''}`}>
          <UploadPage
            isDisabled={!isLoggedIn}
            onUploadSubmit={handleUploadSubmit}
          />
        </div>
      </div>

      {/* <Footer /> */}

      <NotificationToast
        notifications={notifications}
        onClose={removeNotification}
      />

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        
        /* Smooth scrolling for mobile */
        @media (max-width: 1023px) {
          .overflow-y-auto {
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </div>
  );
};

const App = () => {
  return (
    <ApiProvider>
      <AppContent />
    </ApiProvider>
  );
};

export default App;