#!/usr/bin/env node

var app = require('../app');
var debug = require('debug')('backend:server');
var http = require('http');
const socketIo = require('socket.io');

// Port normalization
var port = normalizePort(process.env.PORT || '5000');
app.set('port', port);

// Create HTTP server
var server = http.createServer(app);

// Create Socket.IO server with enhanced configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// Store active connections
const connectedUsers = new Map();

// Socket.IO connection handler

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Keep track of user's active rooms
  const userRooms = new Set();

  socket.on('sendMessage', (message) => {
    console.log('Message received:', message);
    console.log('Sender Rooms:', socket.rooms);
    
    // Send message to receiver's room
    socket.to(message.receiverId).emit('receiveMessage', message);
    console.log(`Message sent to room ${message.receiverId}`);
  });

  socket.on('joinRoom', (data) => {
    if (!data.userId) return;
    
    // Add to room without leaving others
    socket.join(data.userId);
    userRooms.add(data.userId);
    
    console.log(`User ${socket.id} joined room ${data.userId}`);
    console.log('Current rooms:', Array.from(socket.rooms));
  });

  socket.on('leaveRoom', (data) => {
    if (!data.userId) return;
    
    socket.leave(data.userId);
    userRooms.delete(data.userId);
    
    console.log(`User ${socket.id} left room ${data.userId}`);
    console.log('Current rooms:', Array.from(socket.rooms));
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up all rooms for this socket
    userRooms.forEach(roomId => {
      socket.leave(roomId);
    });
    userRooms.clear();
    
    console.log('Rooms cleared for socket:', socket.id);
  });
});

// Server error handling
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

// Handle process errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
