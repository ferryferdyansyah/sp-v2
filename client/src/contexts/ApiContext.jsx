// src/contexts/ApiContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const ApiContext = createContext();

export const useApi = () => {
    const context = useContext(ApiContext);
    if (!context) {
        throw new Error('useApi must be used within ApiProvider');
    }
    return context;
};

export const ApiProvider = ({ children }) => {
    const [apiBaseUrl, setApiBaseUrl] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // ✅ Terima port dari Electron
        if (window.api && window.api.onServerPort) {
            window.api.onServerPort((port) => {
                const url = `http://localhost:${port}`;
                setApiBaseUrl(url);
                setIsConnected(true);
                console.log('✅ Backend connected on', url);
            });
        } else {
            // Fallback untuk development tanpa Electron
            setApiBaseUrl('http://localhost:3000');
            setIsConnected(true);
            console.log('⚠️ Running without Electron, using fallback URL');
        }
    }, []);

    return (
        <ApiContext.Provider value={{ apiBaseUrl, isConnected }}>
            {children}
        </ApiContext.Provider>
    );
};