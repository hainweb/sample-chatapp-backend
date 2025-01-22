// This file manages the connected users
const connectedUsers = new Map();

// Set a user as online
function userOnline(userId, socketId) {
  connectedUsers.set(userId, socketId);
  console.log(`User online: ${userId} -> Socket ID: ${socketId}`);
}

// Remove a user when they disconnect
function userOffline(userId) {
  connectedUsers.delete(userId);
  console.log(`User offline: ${userId}`);
}

// Get a user's socket ID
function getSocketId(userId) {
  return connectedUsers.get(userId);
}  

module.exports = {
  connectedUsers,
  userOnline,
  userOffline,
  getSocketId,
};
