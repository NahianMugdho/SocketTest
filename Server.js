require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// ✅ Express app তৈরি করুন
const app = express();

// ✅ Test endpoints
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'Socket.IO Gateway Server',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        connections: io.engine.clientsCount || 0
    });
});

// ✅ HTTP server তৈরি করুন Express app দিয়ে
const server = http.createServer(app);

// ✅ Socket.IO initialize করুন
const io = new Server(server, {
    cors: {
        origin: "*",  // Testing এর জন্য, production এ specific domains দিন
        methods: ["GET", "POST"],
        credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
});

// ✅ JWT middleware
// io.use((socket, next) => {
//     const token = socket.handshake.auth?.token;
//     if (!token) return next(new Error("Unauthorized"));

//     try {
//         socket.user = jwt.verify(token, process.env.JWT_SECRET);
//         next();
//     } catch {
//         next(new Error("Invalid token"));
//     }
// });
// ✅ Testing mode - No JWT required
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    
    if (!token) {
        // ✅ Mock user for testing
        socket.user = { 
            id: 999, 
            username: 'test_user',
            role: 'user'
        };
        console.log('⚠️  No token provided, using mock user');
        return next();
    }

    try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token verified for user:', socket.user.username);
        next();
    } catch (error) {
        console.error('❌ Invalid token:', error.message);
        socket.user = { 
            id: 999, 
            username: 'test_user',
            role: 'user'
        };
        next(); // ✅ Allow connection anyway for testing
    }
});
// ✅ Connection handler
io.on("connection", (socket) => {
    const userId = socket.user.id;
    const username = socket.user.username;
    
    console.log(`✅ User ${userId} (${username}) connected`);
    socket.join(`user_${userId}`);
    
    // ============================================
    // SOCKET EVENTS - এখানে আপনার events add করুন
    // ============================================
    
    // Ping test
    socket.on("ping", (callback) => {
        console.log(`📡 Ping from user ${userId}`);
        if (typeof callback === "function") {
            callback({ status: 'pong', timestamp: new Date() });
        }
    });
    
    // Fan speed control (example)
    socket.on("setFanSpeed", (data) => {
        console.log(`🌀 Fan speed request from ${username}:`, data);
        
        // Broadcast to room
        io.to(`room_${data.roomCode}`).emit('fanSpeedUpdated', {
            ...data,
            updatedBy: username,
            timestamp: new Date()
        });
        
        // Send success response
        socket.emit('fanSpeedSuccess', {
            success: true,
            ...data,
            timestamp: new Date()
        });
    });
    
    // Join location/room
    socket.on("joinLocation", (location) => {
        socket.join(`room_${location}`);
        console.log(`📍 User ${userId} joined room: ${location}`);
    });
    
    // Leave location/room
    socket.on("leaveLocation", (location) => {
        socket.leave(`room_${location}`);
        console.log(`📤 User ${userId} left room: ${location}`);
    });
    
    // Disconnect
    socket.on("disconnect", () => {
        console.log(`❌ User ${userId} (${username}) disconnected`);
    });
});

// ✅ Server start করুন
// const PORT = process.env.PORT || 3002;
// ✅ For Render deployment compatibility
const PORT = parseInt(process.env.PORT) || 3002;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Socket Gateway running on port ${PORT}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`🔗 Network: http://192.168.88.60:${PORT}`);
    console.log(`📡 Socket.IO ready at ws://192.168.88.60:${PORT}`);
});

module.exports = { app, server, io };