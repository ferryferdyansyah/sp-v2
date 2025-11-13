import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import { File, ChevronDown, ChevronUp, Map, Send, Plus, Trash2, X, CheckCircle, AlertCircle, Clock, Pause, Play } from "lucide-react";
import { useAlert } from '../components/CustomAlert';

const UploadPage = ({ isDisabled, onUploadSubmit, onLogout }) => {
    // Firebase will be initialized from CDN
    const [db, setDb] = useState(null);
    const [firebaseInitialized, setFirebaseInitialized] = useState(false);
    const { showAlert, AlertComponent } = useAlert();

    // Refs untuk file input
    const mbFileInputRef = useRef(null);
    const xyzFileInputRef = useRef(null);

    // Initialize Firebase
    useEffect(() => {
        const initFirebase = async () => {
            try {
                const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
                const { getFirestore, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

                const firebaseConfig = {
                    apiKey: "AIzaSyB7m8i38i_X-IbVKAIJeLUrzLA-7dxjb1k",
                    authDomain: "serahpeta-56e9f.firebaseapp.com",
                    projectId: "serahpeta-56e9f",
                    storageBucket: "serahpeta-56e9f.firebasestorage.app",
                    messagingSenderId: "734805036031",
                    appId: "1:734805036031:web:fd8b3d1c9c66a5da04f5ca"
                };

                const app = initializeApp(firebaseConfig);
                const firestore = getFirestore(app);

                setDb({ firestore, collection, query, where, getDocs });
                setFirebaseInitialized(true);
                console.log('✅ Firebase initialized');
            } catch (error) {
                console.error('❌ Firebase initialization error:', error);
            }
        };

        initFirebase();
    }, []);

    // Reset semua data saat logout
    useEffect(() => {
        if (isDisabled) {
            // Reset semua form
            setMbForm({
                resolusi: '',
                akurasi: '',
                tahunSurvei: '',
                sumberData: '',
                nomorHP: '',
                files: [],
                uploadKey: Date.now()
            });

            setXyzForm({
                resolusi: '',
                akurasi: '',
                tahunSurvei: '',
                sumberData: '',
                nomorHP: '',
                files: [],
                uploadKey: Date.now()
            });

            // Reset upload logs
            setUploadLogs([]);

            // Reset phone verification
            setPhoneVerificationStatus({});

            // Reset batch counter
            setBatchCounter(1);

            console.log('✅ All upload data cleared on logout');
        }
    }, [isDisabled]);

    // Single form state for MB Tiles
    const [mbForm, setMbForm] = useState({
        resolusi: '',
        akurasi: '',
        tahunSurvei: '',
        sumberData: '',
        nomorHP: '',
        files: [],
        uploadKey: Date.now()
    });

    // Single form state for XYZ Tiles
    const [xyzForm, setXyzForm] = useState({
        resolusi: '',
        akurasi: '',
        tahunSurvei: '',
        sumberData: '',
        nomorHP: '',
        files: [],
        uploadKey: Date.now()
    });

    const [activeTab, setActiveTab] = useState('mb');
    const [uploadLogs, setUploadLogs] = useState([]);
    const [socket, setSocket] = useState(null);
    const [phoneVerificationStatus, setPhoneVerificationStatus] = useState({});
    const [batchCounter, setBatchCounter] = useState(1);

    // === ADD THIS: helper untuk update file status immutably ===
    const updateFileInLog = (log, fileIndex, updates) => {
        const fileStatuses = Array.isArray(log.fileStatuses) ? [...log.fileStatuses] : [];
        const current = fileStatuses[fileIndex] || {};
        fileStatuses[fileIndex] = { ...current, ...updates };

        // overall progress = rata-rata progress file
        const overallProgress = Math.round(
            (fileStatuses.reduce((sum, f) => sum + (f.progress || 0), 0) / Math.max(fileStatuses.length, 1))
        );

        const allCompleted = fileStatuses.length > 0 && fileStatuses.every(f => f.status === 'completed');
        const anyUploading = fileStatuses.some(f => f.status === 'uploading');

        const batchStatus = allCompleted ? 'completed' : (anyUploading ? 'uploading' : log.status);

        return { ...log, fileStatuses, progress: overallProgress, status: batchStatus };
    };


    // Initialize WebSocket connection
    useEffect(() => {
        const initSocket = async () => {
            try {
                const newSocket = io('http://localhost:3001');

                newSocket.on('connect', () => {
                    console.log('🔌 Connected to WebSocket');
                });

                setSocket(newSocket);

                return () => {
                    newSocket.disconnect();
                };
            } catch (error) {
                console.error('Socket initialization error:', error);
            }
        };

        initSocket();
    }, []);

    // WebSocket event listeners
    useEffect(() => {
        if (!socket) return;

        // upload-started: set file status -> uploading
        socket.on('upload-started', (data) => {
            const sessionId = String(data.uploadId || '').split('-')[0];
            const fileIndex = parseInt(String(data.uploadId).split('-')[1], 10) || 0;

            setUploadLogs(prev => prev.map(log => {
                if (log.id !== sessionId) return log;
                return updateFileInLog(log, fileIndex, {
                    status: 'uploading',
                    progress: 0,
                    startTime: new Date().toLocaleTimeString()
                });
            }));
        });

        // upload-progress: update progress per file
        socket.on('upload-progress', (data) => {
            const sessionId = String(data.uploadId || '').split('-')[0];
            const fileIndex = parseInt(String(data.uploadId).split('-')[1], 10) || 0;
            // backend diharapkan mengirim progress 0..100
            const progressValue = typeof data.progress === 'number' ? data.progress : (Number(data.progress) || 0);

            setUploadLogs(prev => prev.map(log => {
                if (log.id !== sessionId) return log;
                return updateFileInLog(log, fileIndex, { progress: progressValue });
            }));
        });

        // upload-completed: set file completed, dan jika semua selesai mark batch completed
        socket.on('upload-completed', (data) => {
            const sessionId = String(data.uploadId || '').split('-')[0];
            const fileIndex = parseInt(String(data.uploadId).split('-')[1], 10) || 0;

            setUploadLogs(prev => prev.map(log => {
                if (log.id !== sessionId) return log;

                let updated = updateFileInLog(log, fileIndex, {
                    status: 'completed',
                    progress: 100,
                    endTime: new Date().toLocaleTimeString()
                });

                if (updated.fileStatuses.every(f => f.status === 'completed')) {
                    updated = { ...updated, status: 'completed', endTime: new Date().toLocaleTimeString(), progress: 100 };
                }

                return updated;
            }));
        });

        // upload-failed: set file failed and mark batch failed (policy: whole batch failed)
        socket.on('upload-failed', (data) => {
            const sessionId = String(data.uploadId || '').split('-')[0];
            const fileIndex = parseInt(String(data.uploadId).split('-')[1], 10) || 0;
            const error = data.error || 'Gagal';

            setUploadLogs(prev => prev.map(log => {
                if (log.id !== sessionId) return log;

                const updated = updateFileInLog(log, fileIndex, {
                    status: 'failed',
                    error,
                    endTime: new Date().toLocaleTimeString()
                });

                // tandai batch gagal (opsional: Anda bisa ubah policy)
                return { ...updated, status: 'failed', endTime: new Date().toLocaleTimeString(), error };
            }));
        });

        // upload-cancelled / paused / resumed: update batch-level status only
        socket.on('upload-cancelled', (data) => {
            const sessionId = String(data.uploadId || '').split('-')[0];
            setUploadLogs(prev => prev.map(log => log.id === sessionId ? { ...log, status: 'cancelled', endTime: new Date().toLocaleTimeString() } : log));
        });

        socket.on('upload-paused', (data) => {
            const sessionId = String(data.uploadId || '').split('-')[0];
            setUploadLogs(prev => prev.map(log => log.id === sessionId ? { ...log, status: 'paused' } : log));
        });

        socket.on('upload-resumed', (data) => {
            const sessionId = String(data.uploadId || '').split('-')[0];
            setUploadLogs(prev => prev.map(log => log.id === sessionId ? { ...log, status: 'uploading' } : log));
        });

        return () => {
            socket.off('upload-started');
            socket.off('upload-progress');
            socket.off('upload-completed');
            socket.off('upload-failed');
            socket.off('upload-cancelled');
            socket.off('upload-paused');
            socket.off('upload-resumed');
        };
    }, [socket]);


    const sumberDataOptions = [
        { value: '0', label: 'BPN MB Tiles' },
        { value: '1', label: 'BPN XYZ Tiles' }
    ];

    // Phone Verification Function
    const verifyPhoneNumber = async (phoneNumber) => {
        if (!db || !firebaseInitialized) {
            return {
                isValid: false,
                message: 'Firebase belum terhubung'
            };
        }

        try {
            const normalizedPhone = phoneNumber.replace(/[\s\-\+]/g, '');
            console.log('Verifying phone:', normalizedPhone);

            const q = db.query(
                db.collection(db.firestore, 'authorized_users'),
                db.where('phoneNumber', '==', normalizedPhone),
                db.where('isActive', '==', true)
            );

            const querySnapshot = await db.getDocs(q);

            if (querySnapshot.empty) {
                console.log('Phone not found or inactive');
                return {
                    isValid: false,
                    message: 'Nomor HP tidak terdaftar atau tidak aktif'
                };
            }

            console.log('Phone verified successfully');
            return {
                isValid: true,
                message: 'Nomor HP terverifikasi',
                userData: querySnapshot.docs[0].data()
            };
        } catch (error) {
            console.error('Error verifying phone number:', error);

            if (error.code === 'permission-denied') {
                return {
                    isValid: false,
                    message: 'Akses ditolak. Silakan hubungi administrator.'
                };
            } else if (error.code === 'unavailable') {
                return {
                    isValid: false,
                    message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'
                };
            } else {
                return {
                    isValid: false,
                    message: 'Terjadi kesalahan saat verifikasi: ' + error.message
                };
            }
        }
    };

    // Real-time Phone Verification with debounce
    const handlePhoneInputChange = async (phoneNumber, formType) => {
        const key = formType;

        if (phoneNumber.length === 0) {
            setPhoneVerificationStatus(prev => ({
                ...prev,
                [key]: { status: 'idle', message: '' }
            }));
            return;
        }

        if (phoneNumber.length < 10) {
            setPhoneVerificationStatus(prev => ({
                ...prev,
                [key]: { status: 'error', message: 'Nomor HP minimal 10 digit' }
            }));
            return;
        }

        if (!/^[0-9+\s\-]+$/.test(phoneNumber)) {
            setPhoneVerificationStatus(prev => ({
                ...prev,
                [key]: { status: 'error', message: 'Nomor HP hanya boleh berisi angka' }
            }));
            return;
        }

        setPhoneVerificationStatus(prev => ({
            ...prev,
            [key]: { status: 'checking', message: 'Memverifikasi nomor HP...' }
        }));

        await new Promise(resolve => setTimeout(resolve, 500));

        const result = await verifyPhoneNumber(phoneNumber);

        setPhoneVerificationStatus(prev => ({
            ...prev,
            [key]: {
                status: result.isValid ? 'valid' : 'error',
                message: result.message,
                userData: result.userData
            }
        }));
    };

    // Fungsi untuk membuka file dialog menggunakan window.api (Electron)
    const selectMbFiles = async () => {
        if (window.api && window.api.invoke) {
            // Menggunakan Electron API
            const files = await window.api.invoke('select-mbtiles');
            if (files && files.length > 0) {
                const selectedFiles = files.map(file => ({
                    name: file.name,
                    path: file.path
                }));
                setMbForm(prev => ({ ...prev, files: selectedFiles }));
            }
        } else {
            // Fallback ke input HTML biasa untuk web
            mbFileInputRef.current?.click();
        }
    };

    const selectXyzFiles = async () => {
        if (window.api && window.api.invoke) {
            // Menggunakan Electron API
            const files = await window.api.invoke('select-xyz');
            if (files && files.length > 0) {
                const selectedFiles = files.map(file => ({
                    name: file.name,
                    path: file.path
                }));
                setXyzForm(prev => ({ ...prev, files: selectedFiles }));
            }
        } else {
            // Fallback ke input HTML biasa untuk web
            xyzFileInputRef.current?.click();
        }
    };

    // Pause/Resume Upload
    const togglePauseUpload = (logId) => {
        if (!socket) return;

        const log = uploadLogs.find(l => l.id === logId);
        if (!log) return;

        if (log.status === 'paused') {
            socket.emit('resume-upload', { uploadId: logId });
        } else {
            socket.emit('pause-upload', { uploadId: logId });
        }
    };

    // Cancel Upload
    const cancelUpload = (logId) => {
        if (!socket) return;
        socket.emit('cancel-upload', { uploadId: logId });
    };

    // MB TILES HANDLERS
    const handleMbInputChange = (field, value) => {
        setMbForm(prev => ({ ...prev, [field]: value }));

        if (field === 'nomorHP') {
            handlePhoneInputChange(value, 'mb');
        }
    };

    const handleMbFileChange = async (e) => {
        const files = Array.from(e.target.files);

        // Langsung simpan file object dengan path dari system
        const selectedFiles = files.map(file => ({
            name: file.name,
            path: file.path || file.webkitRelativePath || file.name
        }));

        setMbForm(prev => ({ ...prev, files: selectedFiles }));
    };

    const handleMbSubmit = async () => {
        if (mbForm.files.length === 0) {
            showAlert({
                type: 'warning',
                title: 'Perhatian',
                message: 'Silakan pilih file yang akan diunggah.'
            });
            return;
        }

        // Verify phone number before submitting
        const verification = await verifyPhoneNumber(mbForm.nomorHP);
        if (!verification.isValid) {
            showAlert({
                type: 'error',
                title: 'Verifikasi Gagal',
                message: verification.message
            });
            return;
        }

        if (!socket || !socket.connected) {
            showAlert({
                type: 'warning',
                title: 'Koneksi Terputus',
                message: 'WebSocket tidak terhubung. Silakan refresh halaman.'
            });
            return;
        }

        const sessionId = `mb_session_${Date.now()}`;
        const currentBatch = batchCounter;

        // membuat fileStatuses sebelum membuat newLog
        const fileStatuses = mbForm.files.map(f => ({
            name: f.name,
            path: f.path,
            status: 'queued',   // queued | uploading | completed | failed | cancelled
            progress: 0,
            startTime: null,
            endTime: null,
            error: null
        }));

        const newLog = {
            id: sessionId,
            batchNumber: currentBatch,
            type: 'MB Tiles',
            totalFiles: mbForm.files.length,
            currentFile: 0,
            currentFileName: '',
            status: 'queued',
            startTime: new Date().toLocaleTimeString(),
            progress: 0,
            files: mbForm.files,     // optional: simpan file list as-is
            fileStatuses,            // <-- important
            metadata: {
                resolusi: mbForm.resolusi,
                akurasi: mbForm.akurasi,
                tahunSurvei: mbForm.tahunSurvei,
                sumberData: mbForm.sumberData,
                nomorHP: mbForm.nomorHP
            }
        };


        setUploadLogs(prev => [newLog, ...prev]);
        setBatchCounter(prev => prev + 1);

        console.log('🚀 Starting MB upload for batch:', currentBatch);
        showAlert({
            type: 'success',
            title: 'Berhasil!',
            message: `Batch #${currentBatch} ditambahkan ke antrian`
        });

        const metadata = {
            resolusi: mbForm.resolusi,
            akurasi: mbForm.akurasi,
            tahunSurvey: mbForm.tahunSurvei,
            sumberData: mbForm.sumberData,
            nomorHP: mbForm.nomorHP
        };

        const filePaths = mbForm.files.map(file => file.path);

        try {
            const response = await fetch('http://localhost:3001/automationMBTiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...metadata,
                    filePaths: filePaths,
                    socketId: socket.id,
                    sessionId: sessionId
                }),
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Upload job started');

                // Reset form
                setMbForm({
                    resolusi: '',
                    akurasi: '',
                    tahunSurvei: '',
                    sumberData: '',
                    nomorHP: '',
                    files: [],
                    uploadKey: Date.now()
                });

                // Reset phone verification
                setPhoneVerificationStatus(prev => ({
                    ...prev,
                    mb: { status: 'idle', message: '' }
                }));
            }

        } catch (error) {
            console.error('❌ Upload error:', error);
            showAlert({
                type: 'error',
                title: 'Upload Gagal',
                message: error.message
            });
        }
    };

    // XYZ TILES HANDLERS
    const handleXyzInputChange = (field, value) => {
        setXyzForm(prev => ({ ...prev, [field]: value }));

        if (field === 'nomorHP') {
            handlePhoneInputChange(value, 'xyz');
        }
    };

    const handleXyzFileChange = async (e) => {
        const files = Array.from(e.target.files);

        // Langsung simpan file object dengan path dari system
        const selectedFiles = files.map(file => ({
            name: file.name,
            path: file.path || file.webkitRelativePath || file.name
        }));

        setXyzForm(prev => ({ ...prev, files: selectedFiles }));
    };

    const handleXyzSubmit = async () => {
        if (xyzForm.files.length === 0) {
            showAlert({
                type: 'warning',
                title: 'Perhatian',
                message: 'Silakan pilih file yang akan diunggah.'
            });
            return;
        }

        // Verify phone number before submitting
        const verification = await verifyPhoneNumber(xyzForm.nomorHP);
        if (!verification.isValid) {
            showAlert({
                type: 'error',
                title: 'Verifikasi Gagal',
                message: verification.message
            });
            return;
        }

        if (!socket || !socket.connected) {
            showAlert({
                type: 'warning',
                title: 'Koneksi Terputus',
                message: 'WebSocket tidak terhubung. Silakan refresh halaman.'
            });
            return;
        }

        const sessionId = `xyz_session_${Date.now()}`;
        const currentBatch = batchCounter;

        // membuat fileStatuses sebelum membuat newLog
        const fileStatuses = xyzForm.files.map(f => ({
            name: f.name,
            path: f.path,
            status: 'queued',   // queued | uploading | completed | failed | cancelled
            progress: 0,
            startTime: null,
            endTime: null,
            error: null
        }));

        const newLog = {
            id: sessionId,
            batchNumber: currentBatch,
            type: 'MB Tiles',
            totalFiles: xyzForm.files.length,
            currentFile: 0,
            currentFileName: '',
            status: 'queued',
            startTime: new Date().toLocaleTimeString(),
            progress: 0,
            files: xyzForm.files,     // optional: simpan file list as-is
            fileStatuses,            // <-- important
            metadata: {
                resolusi: xyzForm.resolusi,
                akurasi: xyzForm.akurasi,
                tahunSurvei: xyzForm.tahunSurvei,
                sumberData: xyzForm.sumberData,
                nomorHP: xyzForm.nomorHP
            }
        };

        setUploadLogs(prev => [newLog, ...prev]);
        setBatchCounter(prev => prev + 1);

        console.log('🚀 Starting MB upload for batch:', currentBatch);
        showAlert({
            type: 'success',
            title: 'Berhasil!',
            message: `Batch #${currentBatch} ditambahkan ke antrian`
        });

        const metadata = {
            resolusi: xyzForm.resolusi,
            akurasi: xyzForm.akurasi,
            tahunSurvey: xyzForm.tahunSurvei,
            sumberData: xyzForm.sumberData,
            nomorHP: xyzForm.nomorHP
        };

        const filePaths = xyzForm.files.map(file => file.path);

        try {
            const response = await fetch('http://localhost:3001/automationMBTiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...metadata,
                    filePaths: filePaths,
                    socketId: socket.id,
                    sessionId: sessionId
                }),
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Upload job started');

                // Reset form
                setXyzForm({
                    resolusi: '',
                    akurasi: '',
                    tahunSurvei: '',
                    sumberData: '',
                    nomorHP: '',
                    files: [],
                    uploadKey: Date.now()
                });

                // Reset phone verification
                setPhoneVerificationStatus(prev => ({
                    ...prev,
                    mb: { status: 'idle', message: '' }
                }));
            }

        } catch (error) {
            console.error('❌ Upload error:', error);
            showAlert({
                type: 'error',
                title: 'Upload Gagal',
                message: error.message
            });
        }
    };

    return (
        <div className={`flex h-full transition-opacity ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {AlertComponent}
            {/* Left Side - Forms */}
            <div className="flex-1 overflow-y-auto py-8 px-6">
                <div className="max-w-7/10 mx-auto">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-[#143079] mb-2">Batch Upload</h1>
                        {!firebaseInitialized && (
                            <p className="text-xs text-yellow-600 mt-2">⏳ Menghubungkan ke Firebase...</p>
                        )}
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setActiveTab('mb')}
                            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${activeTab === 'mb'
                                ? 'bg-[#143079] text-white shadow-md'
                                : 'bg-white text-[#143079] border-2 border-[#143079] hover:bg-blue-50'
                                }`}
                        >
                            MB Tiles
                        </button>
                        <button
                            onClick={() => setActiveTab('xyz')}
                            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${activeTab === 'xyz'
                                ? 'bg-[#143079] text-white shadow-md'
                                : 'bg-white text-[#143079] border-2 border-[#143079] hover:bg-blue-50'
                                }`}
                        >
                            XYZ Tiles
                        </button>
                    </div>

                    {/* MB TILES TAB */}
                    {activeTab === 'mb' && (
                        <div className="space-y-4">
                            <div className="bg-[#E8F0FE] p-4 rounded-lg">
                                <div className="space-y-3 bg-white p-4 rounded-md">
                                    <div>
                                        <label className="block text-[#143079] font-medium mb-2 text-sm">
                                            Select MBTiles Files
                                        </label>
                                        {/* Hidden file input untuk fallback */}
                                        <input
                                            ref={mbFileInputRef}
                                            type="file"
                                            multiple
                                            accept=".mbtiles"
                                            onChange={handleMbFileChange}
                                            style={{ display: 'none' }}
                                        />
                                        {/* Button untuk trigger file selection */}
                                        <button
                                            type="button"
                                            onClick={selectMbFiles}
                                            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-md hover:border-blue-500 hover:bg-blue-50 transition text-sm text-gray-600 flex items-center justify-center gap-2"
                                        >
                                            <File className="w-4 h-4" />
                                            Choose MBTiles files
                                        </button>
                                        {mbForm.files.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <p className="text-xs text-gray-600 font-medium">
                                                    Selected files ({mbForm.files.length}):
                                                </p>
                                                <div className="max-h-32 overflow-y-auto space-y-1">
                                                    {mbForm.files.map((f, idx) => (
                                                        <div key={idx} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded flex items-center justify-between">
                                                            <span className="truncate">📄 {f.name}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setMbForm(prev => ({
                                                                        ...prev,
                                                                        files: prev.files.filter((_, i) => i !== idx)
                                                                    }));
                                                                }}
                                                                className="ml-2 text-red-500 hover:text-red-700"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Resolusi</label>
                                        <input
                                            type="text"
                                            value={mbForm.resolusi}
                                            onChange={(e) => handleMbInputChange('resolusi', e.target.value)}
                                            placeholder="Contoh: 10"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#143079] text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Akurasi</label>
                                        <input
                                            type="text"
                                            value={mbForm.akurasi}
                                            onChange={(e) => handleMbInputChange('akurasi', e.target.value)}
                                            placeholder="Contoh: 1"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#143079] text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Tahun Survei</label>
                                        <input
                                            type="text"
                                            value={mbForm.tahunSurvei}
                                            onChange={(e) => handleMbInputChange('tahunSurvei', e.target.value)}
                                            placeholder="Contoh: 2025"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#143079] text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Sumber Data</label>
                                        <select
                                            value="0" // nilai tetap
                                            disabled // agar user tidak bisa mengubah
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-sm"
                                        >
                                            <option value="0">BPN</option>
                                        </select>

                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Nomor HP</label>
                                        <div className="relative">
                                            <input
                                                type="tel"
                                                value={mbForm.nomorHP}
                                                onChange={(e) => handleMbInputChange('nomorHP', e.target.value)}
                                                placeholder="Contoh: 08123456789"
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:border-[#143079] text-sm pr-10 ${phoneVerificationStatus['mb']?.status === 'valid' ? 'border-green-500' :
                                                    phoneVerificationStatus['mb']?.status === 'error' ? 'border-red-500' :
                                                        'border-gray-300'
                                                    }`}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {phoneVerificationStatus['mb']?.status === 'checking' && '⏳'}
                                                {phoneVerificationStatus['mb']?.status === 'valid' && <span className="text-green-500">✓</span>}
                                                {phoneVerificationStatus['mb']?.status === 'error' && <span className="text-red-500">✗</span>}
                                            </span>
                                        </div>
                                        {phoneVerificationStatus['mb']?.message && (
                                            <p className={`text-xs mt-1 ${phoneVerificationStatus['mb']?.status === 'valid' ? 'text-green-600' :
                                                phoneVerificationStatus['mb']?.status === 'error' ? 'text-red-600' :
                                                    'text-yellow-600'
                                                }`}>
                                                {phoneVerificationStatus['mb']?.message}
                                                {phoneVerificationStatus['mb']?.userData?.name &&
                                                    ` (${phoneVerificationStatus['mb'].userData.name})`
                                                }
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleMbSubmit}
                                        className="flex items-center justify-center gap-2 w-full bg-[#143079] text-white py-2 rounded-md hover:bg-blue-700 transition font-medium text-sm"
                                    >
                                        <Send className="w-4 h-4" />
                                        Submit Batch
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* XYZ TILES TAB */}
                    {activeTab === 'xyz' && (
                        <div className="space-y-4">
                            <div className="bg-[#E8F0FE] p-4 rounded-lg">
                                <div className="space-y-3 bg-white p-4 rounded-md">
                                    <div>
                                        <label className="block text-[#143079] font-medium mb-2 text-sm">
                                            Select XYZTiles Files
                                        </label>
                                        {/* Hidden file input untuk fallback */}
                                        <input
                                            ref={xyzFileInputRef}
                                            type="file"
                                            multiple
                                            accept=".xyz"
                                            onChange={handleXyzFileChange}
                                            style={{ display: 'none' }}
                                        />
                                        {/* Button untuk trigger file selection */}
                                        <button
                                            type="button"
                                            onClick={selectXyzFiles}
                                            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-md hover:border-blue-500 hover:bg-blue-50 transition text-sm text-gray-600 flex items-center justify-center gap-2"
                                        >
                                            <File className="w-4 h-4" />
                                            Choose XYZTiles files
                                        </button>
                                        {xyzForm.files.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <p className="text-xs text-gray-600 font-medium">
                                                    Selected files ({xyzForm.files.length}):
                                                </p>
                                                <div className="max-h-32 overflow-y-auto space-y-1">
                                                    {xyzForm.files.map((f, idx) => (
                                                        <div key={idx} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded flex items-center justify-between">
                                                            <span className="truncate">📄 {f.name}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setXyzForm(prev => ({
                                                                        ...prev,
                                                                        files: prev.files.filter((_, i) => i !== idx)
                                                                    }));
                                                                }}
                                                                className="ml-2 text-red-500 hover:text-red-700"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Resolusi</label>
                                        <input
                                            type="text"
                                            value={xyzForm.resolusi}
                                            onChange={(e) => handleXyzInputChange('resolusi', e.target.value)}
                                            placeholder="Contoh: 10"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#143079] text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Akurasi</label>
                                        <input
                                            type="text"
                                            value={xyzForm.akurasi}
                                            onChange={(e) => handleXyzInputChange('akurasi', e.target.value)}
                                            placeholder="Contoh: 1"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#143079] text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Tahun Survei</label>
                                        <input
                                            type="text"
                                            value={xyzForm.tahunSurvei}
                                            onChange={(e) => handleXyzInputChange('tahunSurvei', e.target.value)}
                                            placeholder="Contoh: 2025"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-[#143079] text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Sumber Data</label>
                                        <select
                                            value="0" // nilai tetap
                                            disabled // agar user tidak bisa mengubah
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-sm"
                                        >
                                            <option value="1">BPN</option>
                                        </select>

                                    </div>

                                    <div>
                                        <label className="block text-[#143079] font-medium mb-1 text-sm">Nomor HP</label>
                                        <div className="relative">
                                            <input
                                                type="tel"
                                                value={xyzForm.nomorHP}
                                                onChange={(e) => handleXyzInputChange('nomorHP', e.target.value)}
                                                placeholder="Contoh: 08123456789"
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:border-[#143079] text-sm pr-10 ${phoneVerificationStatus['xyz']?.status === 'valid' ? 'border-green-500' :
                                                    phoneVerificationStatus['xyz']?.status === 'error' ? 'border-red-500' :
                                                        'border-gray-300'
                                                    }`}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {phoneVerificationStatus['xyz']?.status === 'checking' && '⏳'}
                                                {phoneVerificationStatus['xyz']?.status === 'valid' && <span className="text-green-500">✓</span>}
                                                {phoneVerificationStatus['xyz']?.status === 'error' && <span className="text-red-500">✗</span>}
                                            </span>
                                        </div>
                                        {phoneVerificationStatus['xyz']?.message && (
                                            <p className={`text-xs mt-1 ${phoneVerificationStatus['xyz']?.status === 'valid' ? 'text-green-600' :
                                                phoneVerificationStatus['xyz']?.status === 'error' ? 'text-red-600' :
                                                    'text-yellow-600'
                                                }`}>
                                                {phoneVerificationStatus['xyz']?.message}
                                                {phoneVerificationStatus['xyz']?.userData?.name &&
                                                    ` (${phoneVerificationStatus['xyz'].userData.name})`
                                                }
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleXyzSubmit}
                                        className="flex items-center justify-center gap-2 w-full bg-[#143079] text-white py-2 rounded-md hover:bg-blue-700 transition font-medium text-sm"
                                    >
                                        <Send className="w-4 h-4" />
                                        Submit Batch
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Side - Upload Logs */}
            <div className='h-full w-4/10'>
                {/* PER BATCH UNGGAHAN */}
                <div className="h-1/2 border-l border-gray-200 bg-[#E8F0FE] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
                        <h2 className="text-xl font-bold text-[#143079] mb-1">Daftar Antrian Batch</h2>
                        <p className="text-xs text-gray-500">
                            Total: {uploadLogs.length} |
                            Berhasil: {uploadLogs.filter(l => l.status === 'completed').length} |
                            Gagal: {uploadLogs.filter(l => l.status === 'failed').length}
                        </p>
                    </div>

                    <div className="p-4 space-y-3">
                        {uploadLogs.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="text-sm">Belum ada antrian batch</p>
                                <p className="text-xs mt-1">Kirim formulir untuk mulai mengunggah</p>
                            </div>
                        ) : (
                            uploadLogs.map(log => (
                                <div
                                    key={log.id}
                                    className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${log.status === 'completed' ? 'border-green-500' :
                                        log.status === 'failed' ? 'border-red-500' :
                                            log.status === 'paused' ? 'border-yellow-500' :
                                                log.status === 'cancelled' ? 'border-gray-400' :
                                                    log.status === 'queued' ? 'border-purple-500' :
                                                        'border-blue-500'
                                        }`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                    BATCH #{log.batchNumber}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {log.type}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {log.currentFileName || `${log.totalFiles} file(s)`}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                File {log.currentFile}/{log.totalFiles}
                                            </p>
                                        </div>

                                        {/* Status Icon */}
                                        <div className="ml-2">
                                            {log.status === 'completed' && (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            )}
                                            {log.status === 'failed' && (
                                                <AlertCircle className="w-5 h-5 text-red-500" />
                                            )}
                                            {log.status === 'paused' && (
                                                <Pause className="w-5 h-5 text-yellow-500" />
                                            )}
                                            {log.status === 'queued' && (
                                                <Clock className="w-5 h-5 text-purple-500" />
                                            )}
                                            {log.status === 'uploading' && (
                                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    {(log.status === 'uploading' || log.status === 'paused') && (
                                        <div className="mb-3">
                                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                <span>Progress</span>
                                                <span className="font-semibold">{Math.round(log.progress)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ${log.status === 'paused' ? 'bg-yellow-500' : 'bg-blue-500'
                                                        }`}
                                                    style={{ width: `${log.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Status Message */}
                                    <div className="text-xs text-gray-500 mb-2">
                                        {log.status === 'completed' && (
                                            <span className="text-green-600 font-medium">✓ Upload berhasil!</span>
                                        )}
                                        {log.status === 'paused' && (
                                            <span className="text-yellow-600 font-medium">⏸ Upload dijeda</span>
                                        )}
                                        {log.status === 'queued' && (
                                            <span className="text-purple-600 font-medium">⏳ Menunggu antrian...</span>
                                        )}
                                        {log.status === 'uploading' && (
                                            <span className="text-blue-600 font-medium">⬆ Sedang mengupload...</span>
                                        )}
                                        {log.status === 'cancelled' && (
                                            <span className="text-gray-600 font-medium">⊗ Upload dibatalkan</span>
                                        )}
                                    </div>

                                    {/* Time Info */}
                                    <div className="text-xs text-gray-400 mb-2">
                                        Mulai: {log.startTime}
                                        {log.endTime && ` • Selesai: ${log.endTime}`}
                                    </div>

                                    {/* Control Buttons */}
                                    {(log.status === 'uploading' || log.status === 'paused') && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => togglePauseUpload(log.id)}
                                                className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition ${log.status === 'paused'
                                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                                                    }`}
                                            >
                                                {log.status === 'paused' ? (
                                                    <>
                                                        <Play className="w-3 h-3" />
                                                        Lanjutkan
                                                    </>
                                                ) : (
                                                    <>
                                                        <Pause className="w-3 h-3" />
                                                        Jeda
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => cancelUpload(log.id)}
                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition"
                                            >
                                                <X className="w-3 h-3" />
                                                Batalkan
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
                {/* PER FILE UNGGAHAN */}
                {/* PER FILE UNGGAHAN */}
                <div className="h-1/2 border-l border-gray-200 bg-[#E8F0FE] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
                        <h2 className="text-xl font-bold text-[#143079] mb-1">Progress Unggahan Per File</h2>
                        <p className="text-xs text-gray-500">
                            {(() => {
                                const allFiles = uploadLogs.flatMap(log =>
                                    (log.fileStatuses || []).map(f => ({ ...f, batchNumber: log.batchNumber, batchType: log.type }))
                                );
                                const completed = allFiles.filter(f => f.status === 'completed').length;
                                const failed = allFiles.filter(f => f.status === 'failed').length;
                                return `Total File: ${allFiles.length} | Berhasil: ${completed} | Gagal: ${failed}`;
                            })()}
                        </p>
                    </div>

                    <div className="p-4 space-y-2">
                        {(() => {
                            // Flatten semua file dari semua batch
                            const allFiles = uploadLogs.flatMap(log =>
                                (log.fileStatuses || []).map((f, idx) => ({
                                    ...f,
                                    batchNumber: log.batchNumber,
                                    batchType: log.type,
                                    batchId: log.id,
                                    fileIndex: idx
                                }))
                            );

                            if (allFiles.length === 0) {
                                return (
                                    <div className="text-center py-12 text-gray-400">
                                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-sm">Belum ada file yang diunggah</p>
                                        <p className="text-xs mt-1">Kirim formulir untuk mulai mengunggah</p>
                                    </div>
                                );
                            }

                            return allFiles.map((file, globalIdx) => (
                                <div
                                    key={`${file.batchId}-${file.fileIndex}`}
                                    className={`bg-white rounded-lg p-3 shadow-sm border-l-4 ${file.status === 'completed' ? 'border-green-500' :
                                        file.status === 'failed' ? 'border-red-500' :
                                            file.status === 'uploading' ? 'border-blue-500' :
                                                file.status === 'cancelled' ? 'border-gray-400' :
                                                    'border-purple-500'
                                        }`}
                                >
                                    {/* Header File */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                    BATCH #{file.batchNumber}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {file.batchType}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-800 truncate">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">
                                                {file.path}
                                            </p>
                                        </div>

                                        {/* Status Icon */}
                                        <div className="ml-2">
                                            {file.status === 'completed' && (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            )}
                                            {file.status === 'failed' && (
                                                <AlertCircle className="w-5 h-5 text-red-500" />
                                            )}
                                            {file.status === 'cancelled' && (
                                                <X className="w-5 h-5 text-gray-400" />
                                            )}
                                            {file.status === 'queued' && (
                                                <Clock className="w-5 h-5 text-purple-500" />
                                            )}
                                            {file.status === 'uploading' && (
                                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    {(file.status === 'uploading' || file.status === 'queued') && (
                                        <div className="mb-2">
                                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                                                <span>Progress</span>
                                                <span className="font-semibold">{Math.round(file.progress || 0)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="h-full transition-all duration-300 bg-blue-500"
                                                    style={{ width: `${file.progress || 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Status Message */}
                                    <div className="text-xs mb-1">
                                        {file.status === 'completed' && (
                                            <span className="text-green-600 font-medium">✓ Upload berhasil!</span>
                                        )}
                                        {file.status === 'uploading' && (
                                            <span className="text-blue-600 font-medium">⬆ Sedang mengupload...</span>
                                        )}
                                        {file.status === 'queued' && (
                                            <span className="text-purple-600 font-medium">⏳ Menunggu antrian...</span>
                                        )}
                                        {file.status === 'failed' && (
                                            <span className="text-red-600 font-medium">✗ Upload gagal</span>
                                        )}
                                        {file.status === 'cancelled' && (
                                            <span className="text-gray-600 font-medium">⊗ Upload dibatalkan</span>
                                        )}
                                    </div>

                                    {/* Time Info */}
                                    {(file.startTime || file.endTime) && (
                                        <div className="text-xs text-gray-400">
                                            {file.startTime && `Mulai: ${file.startTime}`}
                                            {file.endTime && ` • Selesai: ${file.endTime}`}
                                        </div>
                                    )}
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadPage;