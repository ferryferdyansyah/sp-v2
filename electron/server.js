const express = require('express')
const app = express()
const cors = require('cors')
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

process.on('uncaughtException', (err) => {
    console.error("UNCAUGHT EXCEPTION =>", err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("UNHANDLED REJECTION =>", reason);
});


// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


const getChromePath = () => {
    const resourcesPath = process.resourcesPath;
    const chromePath = path.join(resourcesPath, "playwright", "chromium", "chrome.exe");

    if (!fs.existsSync(chromePath)) {
        console.error("[ERROR] Chromium tidak ditemukan di:", chromePath);
    } else {
        console.log("[OK] Chromium ditemukan di:", chromePath);
    }

    return chromePath;
};


let browser = null;

// Global object to store automation states
global.automationStates = {};

// Queue management
global.automationQueue = [];
global.isProcessingQueue = false;
global.currentJob = null;

app.use(express.json());
app.use(cors());

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });

    socket.on('pause-upload', (data) => {
        console.log('⏸ Pause requested for:', data.uploadId);
        // Extract sessionId from uploadId (format: sessionId-fileIndex)
        const sessionId = data.uploadId.split('-')[0];
        if (global.automationStates[sessionId]) {
            global.automationStates[sessionId].isPaused = true;
            socket.emit('upload-paused', { uploadId: data.uploadId });
        }
    });

    socket.on('resume-upload', (data) => {
        console.log('▶️ Resume requested for:', data.uploadId);
        const sessionId = data.uploadId.split('-')[0];
        if (global.automationStates[sessionId]) {
            global.automationStates[sessionId].isPaused = false;
            socket.emit('upload-resumed', { uploadId: data.uploadId });
        }
    });

    socket.on('cancel-upload', (data) => {
        console.log('⊗ Cancel requested for:', data.uploadId);
        const sessionId = data.uploadId.split('-')[0];
        if (global.automationStates[sessionId]) {
            global.automationStates[sessionId].isAborted = true;
            socket.emit('upload-cancelled', { uploadId: data.uploadId });
        }
    });
});

// SSE endpoint for progress updates (LEGACY - kept for backward compatibility)
app.get('/automation_progress/:sessionId', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sessionId = req.params.sessionId;
    if (!global.progressClients) {
        global.progressClients = {};
    }
    global.progressClients[sessionId] = res;

    req.on('close', () => {
        delete global.progressClients[sessionId];
    });
});

// Helper function to send progress updates via SSE (LEGACY)
function sendProgress(sessionId, data) {
    const client = global.progressClients?.[sessionId];
    if (client) {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

// Helper function to emit progress via Socket.IO
function emitProgress(socketId, eventName, data) {
    if (socketId && io.sockets.sockets.get(socketId)) {
        io.to(socketId).emit(eventName, data);
    }
}

// Queue status endpoint
app.get('/automation/queue/status', (req, res) => {
    const queueStatus = {
        queueLength: global.automationQueue.length,
        isProcessing: global.isProcessingQueue,
        currentJob: global.currentJob ? {
            sessionId: global.currentJob.sessionId,
            type: global.currentJob.type,
            status: global.currentJob.status,
            totalFiles: global.currentJob.data.filePaths?.length || 0
        } : null,
        queue: global.automationQueue.map(job => ({
            sessionId: job.sessionId,
            type: job.type,
            totalFiles: job.data.filePaths?.length || 0,
            addedAt: job.addedAt
        }))
    };
    res.json(queueStatus);
});

// Remove from queue endpoint
app.delete('/automation/queue/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const initialLength = global.automationQueue.length;

    global.automationQueue = global.automationQueue.filter(job => job.sessionId !== sessionId);

    if (global.automationQueue.length < initialLength) {
        res.json({ success: true, message: 'Job removed from queue' });
    } else {
        res.status(404).json({ success: false, error: 'Job not found in queue' });
    }
});

// Control endpoints
app.post('/automation/pause/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    if (global.automationStates[sessionId]) {
        global.automationStates[sessionId].isPaused = true;
        sendProgress(sessionId, {
            status: 'paused',
            message: 'Automation paused by user'
        });
        res.json({ success: true, message: 'Automation paused' });
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
});

app.post('/automation/resume/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    if (global.automationStates[sessionId]) {
        global.automationStates[sessionId].isPaused = false;
        sendProgress(sessionId, {
            status: 'resumed',
            message: 'Automation resumed'
        });
        res.json({ success: true, message: 'Automation resumed' });
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
});

app.post('/automation/abort/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    if (global.automationStates[sessionId]) {
        global.automationStates[sessionId].isAborted = true;
        sendProgress(sessionId, {
            status: 'aborted',
            message: 'Automation aborted by user'
        });
        res.json({ success: true, message: 'Automation aborted' });
    } else {
        res.status(404).json({ success: false, error: 'Session not found' });
    }
});

// Helper function to wait while paused
async function checkPauseAndAbort(sessionId) {
    while (global.automationStates[sessionId]?.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (global.automationStates[sessionId]?.isAborted) {
        throw new Error('Automation aborted by user');
    }
}

// Core automation function for mbtiles
async function processAutomationMbtiles(sessionId, data, socketId) {
    const { resolusi, akurasi, tahunSurvey, sumberData, nomorHP, filePaths } = data;

    if (!browser) {
        throw new Error('Browser not initialized. Please login first or logout and re-login.');
    }

    // Initialize automation state
    global.automationStates[sessionId] = {
        isPaused: false,
        isAborted: false
    };

    const results = [];

    for (let i = 0; i < filePaths.length; i++) {
        try {
            const uploadId = `${sessionId}-${i}`;

            // Check pause/abort status
            await checkPauseAndAbort(sessionId);

            // Emit upload started
            emitProgress(socketId, 'upload-started', {
                uploadId: uploadId,
                fileName: path.basename(filePaths[i]),
                fileIndex: i,
                totalFiles: filePaths.length
            });

            const page = browser.pages()[0];
            await page.click('xpath=/html/body/div[1]/aside/div/nav/ul/li[4]/a')

            const iframe = page.frameLocator('iframe')
            const button_mbtiles = iframe.locator('input[value="Mbtiles Peta Foto Drones"]')
            await button_mbtiles.click()

            await checkPauseAndAbort(sessionId);

            await iframe.locator('input[type="file"]').setInputFiles(filePaths[i]);

            // Emit progress
            emitProgress(socketId, 'upload-progress', {
                uploadId: uploadId,
                progress: 30
            });

            await iframe.getByText(' Registrasi Metadata ').click({ timeout: 0 })
            await iframe.locator('xpath=//*[@id="f15"]/div[4]/input').waitFor({ timeout: 0 })

            await checkPauseAndAbort(sessionId);

            const alamat = await iframe.locator('xpath=//*[@id="f15"]/div[2]/input').inputValue();
            if (!alamat || alamat.trim() === '') {
                emitProgress(socketId, 'upload-failed', {
                    uploadId: uploadId,
                    error: 'Alamat is empty'
                });
                results.push({ file: filePaths[i], status: 'skipped', reason: 'Empty alamat' });
                continue;
            }

            await iframe.locator('xpath=//*[@id="f15"]/div[4]/input').fill(resolusi);
            await iframe.locator('xpath=//*[@id="f15"]/div[5]/input').fill(akurasi);
            await iframe.locator('xpath=//*[@id="f15"]/div[6]/input').fill(tahunSurvey);
            await iframe.locator('xpath=//*[@id="f15"]/div[7]/select').selectOption({ index: parseInt(sumberData) });
            await iframe.locator('xpath=//*[@id="f15"]/div[8]/input').fill(nomorHP);

            await checkPauseAndAbort(sessionId);

            // Emit progress
            emitProgress(socketId, 'upload-progress', {
                uploadId: uploadId,
                progress: 80
            });

            await iframe.locator('xpath=//*[@id="mslink2"]').click();
            await iframe.getByText('upload', { exact: true }).click();

            // Simulate upload completion
            emitProgress(socketId, 'upload-completed', {
                uploadId: uploadId
            });

            results.push({ file: filePaths[i], status: 'success' });
        } catch (error) {
            if (error.message === 'Automation aborted by user') {
                results.push({ file: filePaths[i], status: 'aborted' });
                break;
            }

            console.log(`Error mengunggah file ${i + 1}:`, error)

            emitProgress(socketId, 'upload-failed', {
                uploadId: `${sessionId}-${i}`,
                error: error.message
            });

            results.push({ file: filePaths[i], status: 'error', error: error.message });
        }
    }

    // Cleanup
    delete global.automationStates[sessionId];

    return results;
}

// Core automation function for xyztiles
async function processAutomationXyztiles(sessionId, data, socketId) {
    const { resolusi, akurasi, tahunSurvey, sumberData, nomorHP, filePaths } = data;

    if (!browser) {
        throw new Error('Browser not initialized. Please login first or logout and re-login.');
    }

    global.automationStates[sessionId] = {
        isPaused: false,
        isAborted: false
    };

    const results = [];

    for (let i = 0; i < filePaths.length; i++) {
        try {
            const uploadId = `${sessionId}-${i}`;

            await checkPauseAndAbort(sessionId);

            emitProgress(socketId, 'upload-started', {
                uploadId: uploadId,
                fileName: path.basename(filePaths[i]),
                fileIndex: i,
                totalFiles: filePaths.length
            });

            const page = browser.pages()[0];
            await page.click('xpath=/html/body/div[1]/aside/div/nav/ul/li[4]/a')

            const iframe = page.frameLocator('iframe')
            const button_xyztiles = iframe.locator('input[value="XYZ DTM"]')
            await button_xyztiles.click()

            await checkPauseAndAbort(sessionId);

            await iframe.locator('input[type="file"]').setInputFiles(filePaths[i]);

            emitProgress(socketId, 'upload-progress', {
                uploadId: uploadId,
                progress: 30
            });

            await iframe.getByText(' Registrasi XYZ').click({ timeout: 0 });
            await iframe.locator('xpath=//*[@id="f15"]/div[4]/input').waitFor({ timeout: 0 })

            await checkPauseAndAbort(sessionId);

            const alamat = await iframe.locator('xpath=//*[@id="f15"]/div[2]/input').inputValue();
            if (!alamat || alamat.trim() === '') {
                emitProgress(socketId, 'upload-failed', {
                    uploadId: uploadId,
                    error: 'Alamat is empty'
                });
                results.push({ file: filePaths[i], status: 'skipped', reason: 'Empty alamat' });
                continue;
            }

            await iframe.locator('xpath=//*[@id="f15"]/div[4]/input').fill(resolusi);
            await iframe.locator('xpath=//*[@id="f15"]/div[5]/input').fill(akurasi);
            await iframe.locator('xpath=//*[@id="f15"]/div[6]/input').fill(tahunSurvey);
            await iframe.locator('xpath=//*[@id="f15"]/div[7]/select').selectOption({ index: parseInt(sumberData) });
            await iframe.locator('xpath=//*[@id="f15"]/div[8]/input').fill(nomorHP);

            await checkPauseAndAbort(sessionId);

            emitProgress(socketId, 'upload-progress', {
                uploadId: uploadId,
                progress: 80
            });

            // await iframe.locator('xpath=//*[@id="mslink2"]').click();
            // await iframe.getByText('upload', { exact: true }).click();

            emitProgress(socketId, 'upload-completed', {
                uploadId: uploadId
            });

            results.push({ file: filePaths[i], status: 'success' });
        } catch (error) {
            if (error.message === 'Automation aborted by user') {
                results.push({ file: filePaths[i], status: 'aborted' });
                break;
            }

            console.log(`Error mengunggah file ${i + 1}:`, error)

            emitProgress(socketId, 'upload-failed', {
                uploadId: `${sessionId}-${i}`,
                error: error.message
            });

            results.push({ file: filePaths[i], status: 'error', error: error.message });
        }
    }

    delete global.automationStates[sessionId];
    return results;
}

// Queue processor
async function processQueue() {
    if (global.isProcessingQueue || global.automationQueue.length === 0) {
        return;
    }

    global.isProcessingQueue = true;

    while (global.automationQueue.length > 0) {
        const job = global.automationQueue.shift();
        global.currentJob = job;

        try {
            console.log(`Processing job: ${job.sessionId} (${job.type})`);

            let results;
            if (job.type === 'mbtiles') {
                results = await processAutomationMbtiles(job.sessionId, job.data, job.socketId);
            } else if (job.type === 'xyztiles') {
                results = await processAutomationXyztiles(job.sessionId, job.data, job.socketId);
            }

            job.resolve({ success: true, results, sessionId: job.sessionId });
        } catch (error) {
            console.log(`Error processing job ${job.sessionId}:`, error);
            job.reject(error);
        }

        global.currentJob = null;
    }

    global.isProcessingQueue = false;
}

// Add job to queue
function addToQueue(sessionId, type, data, socketId) {
    return new Promise((resolve, reject) => {
        const job = {
            sessionId,
            type,
            data,
            socketId,
            addedAt: new Date().toISOString(),
            resolve,
            reject,
            status: 'queued'
        };

        global.automationQueue.push(job);
        console.log(`Job ${sessionId} added to queue. Queue length: ${global.automationQueue.length}`);

        processQueue();
    });
}

app.post('/login', async (req, res) => {
    try {
        const { emailOrNip, password, loginType } = req.body; // ✅ Terima credentials dari frontend

        const chromePath = getChromePath();
        const userDataDir = './user-data';

        browser = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            executablePath: chromePath,
            args: ['--disable-blink-features=AutomationControlled']
        })

        const page = await browser.pages()[0];
        await page.goto('https://petadasar.atrbpn.go.id/');

        // Click login button
        await page.click('xpath=/html/body/div[1]/aside/div/nav/ul/li[5]/a');

        // Wait for login page to load
        await page.waitForTimeout(2000);

        // ✅ Auto-fill form jika credentials tersedia
        if (emailOrNip && password) {
            console.log(`🔑 Auto-filling login form for: ${emailOrNip} (${loginType})`);

            try {
                // Fill Email/NIP field
                const emailInput = await page.locator('input[placeholder*="Email"], input[placeholder*="NIP"]').first();
                await emailInput.fill(emailOrNip);
                console.log('✓ Email/NIP filled');

                // Fill Password field
                const passwordInput = await page.locator('input[type="password"]').first();
                await passwordInput.fill(password);
                console.log('✓ Password filled');

                // Click appropriate login button based on loginType
                if (loginType === 'email') {
                    // Click "Login [Email]" button
                    const emailButton = await page.getByText('Login [Email]', { exact: true });
                    if (await emailButton.count() > 0) {
                        await emailButton.click();
                        console.log('✓ Clicked Login [Email] button');
                    }
                } else if (loginType === 'nip') {
                    // Click "SSO Login [NIP]" button
                    const nipButton = await page.getByText('SSO Login [NIP]', { exact: true });
                    if (await nipButton.count() > 0) {
                        await nipButton.click();
                        console.log('✓ Clicked SSO Login [NIP] button');
                    }
                } else if (loginType === 'google') {
                    // Click "Login by Google" button
                    const googleButton = await page.getByText('Login by Google', { exact: true });
                    if (await googleButton.count() > 0) {
                        await googleButton.click();
                        console.log('✓ Clicked Login by Google button');
                    }
                }

                console.log('💡 Form auto-filled. User can now complete login manually if needed.');
            } catch (fillError) {
                console.warn('⚠️ Could not auto-fill form (maybe different page structure):', fillError.message);
                console.log('💡 User will need to login manually');
            }
        } else {
            console.log('💡 No credentials provided, user will login manually');
        }

        // Wait for successful login (check if user menu appears)
        const loginSuccess = await page.waitForSelector('xpath=/html/body/div[1]/aside/div/nav/ul/li[8]', { timeout: 0 })

        if (loginSuccess) {
            res.send('Login Success')
        } else {
            res.send('Login Failed')
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).send('Login error');
    }
})

// ✅ Logout endpoint - close browser
app.post('/logout', async (req, res) => {
    try {
        if (browser) {
            await browser.close();
            browser = null;
            console.log('🔴 Browser closed on logout');
        }
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
})

// ✅ Get current user endpoint - check if browser is still active
app.get('/getCurrentUser', async (req, res) => {
    try {
        if (browser && browser.pages) {
            const pages = await browser.pages();
            if (pages.length > 0) {
                return res.json({
                    success: true,
                    user: { loggedIn: true }
                });
            }
        }
        res.json({ success: false, user: null });
    } catch (error) {
        res.json({ success: false, user: null });
    }
})

app.post('/automationMBTiles', async (req, res) => {
    const sessionId = req.body.sessionId || `session_${Date.now()}`;

    try {
        const { resolusi, akurasi, tahunSurvey, sumberData, nomorHP, filePaths, socketId } = req.body;

        if (!browser) {
            return res.status(400).json({
                success: false,
                error: 'Browser not initialized. Please login first.'
            });
        }

        addToQueue(sessionId, 'mbtiles', { resolusi, akurasi, tahunSurvey, sumberData, nomorHP, filePaths }, socketId)
            .then(result => {
                console.log(`Job ${sessionId} completed`);
            })
            .catch(error => {
                console.log(`Job ${sessionId} failed:`, error);
            });

        res.json({
            success: true,
            sessionId,
            message: 'Job added to queue',
            queuePosition: global.automationQueue.length
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error: error.message });
    }
})

app.post('/automationXYZTiles', async (req, res) => {
    const sessionId = req.body.sessionId || `session_${Date.now()}`;

    try {
        const { resolusi, akurasi, tahunSurvey, sumberData, nomorHP, filePaths, socketId } = req.body;

        if (!browser) {
            return res.status(400).json({
                success: false,
                error: 'Browser not initialized. Please login first.'
            });
        }

        addToQueue(sessionId, 'xyztiles', { resolusi, akurasi, tahunSurvey, sumberData, nomorHP, filePaths }, socketId)
            .then(result => {
                console.log(`Job ${sessionId} completed`);
            })
            .catch(error => {
                console.log(`Job ${sessionId} failed:`, error);
            });

        res.json({
            success: true,
            sessionId,
            message: 'Job added to queue',
            queuePosition: global.automationQueue.length
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error: error.message });
    }
})

// Export both app and server
module.exports = { app, server };