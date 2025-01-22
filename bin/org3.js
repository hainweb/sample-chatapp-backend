#!/usr/bin/env node

var app = require('../app');
var debug = require('debug')('backend:server');
var http = require('http');
const socketIo = require('socket.io');

var db = require('../config/connection')
var collection = require('../config/collection')
const { ObjectId } = require('mongodb');

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
const messageStatuses = new Map(); // Track message statuses

// Socket.IO connection handler

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Keep track of the user's active rooms
  const userRooms = new Set();

  // Handle user coming online
  socket.on('userOnline', (data) => {
    if (data.userId) {
      connectedUsers.set(data.userId, socket.id);
      console.log(`User online: ${data.userId} -> Socket ID: ${socket.id}`);
    }
  });

  // Handle sending messages
  socket.on('sendMessage', (message) => {
    console.log('Message received:', message);
    console.log('Sender Rooms:', socket.rooms);
    
 

    // Send the message to the receiver's room
    socket.to(message.receiverId).emit('receiveMessage', message);
    console.log(`Message sent to room ${message.receiverId}`);
  });



socket.on('markAsSeen', async (data) => {
  const { messageId, senderId, receiverId } = data;

  try {
    // First, emit the socket event to notify the sender immediately
    const senderSocketId = connectedUsers.get(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit('messageSeen', {
        messageId,
        receiverId,
        status: 'seen',
      });
    }

    // Then, update the database
    const result = await db.get().collection(collection.MESSAGES_COLLECTION)
      .updateOne(
        {
          $or: [
            {
              participants: [
                { userId: senderId },
                { userId: receiverId }
              ]
            },
            {
              participants: [
                { userId: receiverId },
                { userId: senderId }
              ]
            }
          ],
          "messages.messageId": messageId
        },
        {
          $set: { "messages.$[element].status": "seen" }
        },
        {
          arrayFilters: [{ "element.messageId": messageId }]
        }
      );

    console.log('Update result:', result);

    if (result.modifiedCount > 0) {
      console.log(`Successfully marked message ${messageId} as seen by ${receiverId}.`);
    } else {
      console.log(`Message ${messageId} not found or already marked as seen.`);
    }
  } catch (err) {
    console.error(`Error updating seen status for message ${messageId}:`, err);
    console.error('Full error:', err);
    
    // If database update fails, emit an error event to the sender
    if (senderSocketId) {
      io.to(senderSocketId).emit('messageSeenError', {
        messageId,
        receiverId,
        error: 'Failed to mark message as seen'
      });
    }
  }
});
  

/*
   // Handle marking a message as seen
   socket.on('markAsSeen', (data) => {
    try {
      const { messageId, senderId, receiverId } = data;

      // Check if the message exists and is currently unseen
      const messageStatus = messageStatuses.get(messageId);
      if (messageStatus && messageStatus.status === 'unseen') {
        // Update the message status to "seen"
        messageStatuses.set(messageId, { status: 'seen' });

        // Notify the sender that the message was seen
        const senderSocketId = connectedUsers.get(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messageSeen', {
            messageId,
            receiverId,
            status: 'seen',
          });
          console.log(`Message ${messageId} marked as seen by ${receiverId}`);
        }
      } else {
        console.log(`Message ${messageId} is already marked as seen or does not exist.`);
      }
    } catch (err) {
      console.error('Error sending seen status:', err);
    }
  });
*/

/*
socket.on('markAsSeen', async (data) => {
  try {
    const { messageId, senderId, receiverId } = data;
    
    // Update message status to 'seen' in database
    await Message.findByIdAndUpdate(messageId, { status: 'seen' });
    
    // Notify sender that message was seen
    const senderSocketId = connectedUsers.get(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit('messageSeen', {
        messageId,
        receiverId
      });
    }
  } catch (err) {
    console.error('Error marking message as seen:', err);
  }
});
*/

  // Handle joining a room
  socket.on('joinRoom', (data) => {
    if (!data.userId) return;

    // Add to room without leaving others
    socket.join(data.userId);
    userRooms.add(data.userId);

    console.log(`User ${socket.id} joined room ${data.userId}`);
    console.log('Current rooms:', Array.from(socket.rooms));
  });

  // Handle leaving a room
  socket.on('leaveRoom', (data) => {
    if (!data.userId) return;

    socket.leave(data.userId);
    userRooms.delete(data.userId);

    console.log(`User ${socket.id} left room ${data.userId}`);
    console.log('Current rooms:', Array.from(socket.rooms));
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Clean up all rooms for this socket
    userRooms.forEach((roomId) => {
      socket.leave(roomId);
    });
    userRooms.clear();

    // Remove the user from the connected users map
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`User ${userId} removed from connected users`);
        break;
      }
    }

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
