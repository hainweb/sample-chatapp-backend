var db = require('../config/connection')
var collection = require('../config/collection')
var bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

module.exports = {


  doSignup: (userData) => {
    return new Promise(async (resolve, reject) => {
      let response1 = {};
      try {
        let userExists = await db.get().collection(collection.USER_COLLECTION).findOne({ Mobile: userData.Mobile });
        let userNameExists = await db.get().collection(collection.USER_COLLECTION).findOne({ UserName: userData.UserName });

        if (!userExists && !userNameExists) {
          userData.Password = await bcrypt.hash(userData.Password, 10);  // Hash the password
          db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((data) => {
            response1.user = userData;  // Return user data
            response1.status = true;
            resolve(response1);
          }).catch(err => {
            response1.status = false;
            response1.message = "Error occurred during signup.";
            reject(response1);
          });
        } else if (userExists) {
          response1.status = false;
          response1.message = 'This mobile has already been taken';
          resolve(response1);
        } else if (userNameExists) {
          response1.status = false;
          response1.message = 'This username has already been taken';
          resolve(response1);
        }
      } catch (error) {
        response1.status = false;
        response1.message = 'An error occurred during signup.';
        reject(response1);
      }
    });
  },


  doLogin: (userData) => {
    return new Promise(async (resolve, reject) => {
      let loginStatus = false
      let response = {}
      let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Mobile: userData.Mobile })
      if (user) {
        bcrypt.compare(userData.Password, user.Password).then((status) => {
          if (status) {
            console.log('Login success');
            response.user = user
            response.status = true
            resolve(response)

          } else {
            console.log('Login failed pss error');
            resolve({ status: false })

          }
        })
      } else {
        console.log('No user found');
        resolve({ status: false })
      }
    })
  },

  findUser: (userName) => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('server find user', userName);

        // Find users whose usernames start with the given input (case-insensitive)
        const users = await db
          .get()
          .collection(collection.USER_COLLECTION)
          .find({ UserName: { $regex: `^${userName}`, $options: 'i' } })
          .limit(5) // Limit the results to 5 users
          .toArray();

        console.log('userdata', users);
        resolve(users);
      } catch (error) {
        reject("Error finding users");
      }
    });
  },
  getUser: (userId) => {
    console.log('userndnjnd',userId);
    
    return new Promise(async (resolve, reject) => {
      try {
        //   console.log('server find user');
        const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: new ObjectId(userId) })
        resolve(user)
      } catch (error) {
        reject("Error finding users");
      }
    });
  },

  addMessages: (messageId, senderId, receiverId, message, type) => {
    return new Promise(async (resolve, reject) => {
      try {
        const messageDoc = {
          messageId,
          senderId,
          receiverId,
          message,
          status: 'sent',
          date: new Date()
        };

        // First try to find an existing conversation between these participants
        const existingConversation = await db.get().collection(collection.MESSAGES_COLLECTION)
          .findOne({
            participants: {
              $all: [
                { userId: senderId },
                { userId: receiverId }
              ]
            }
          });

        if (existingConversation) {
          // If conversation exists, push the new message
          const result = await db.get().collection(collection.MESSAGES_COLLECTION)
            .updateOne(
              { _id: existingConversation._id },
              {
                $push: { messages: messageDoc }
              }
            );
          //  console.log('result', result);
          const dashboardUpdate = await db.get().collection(collection.DASHBOARD_COLLECTION).updateOne(
            {
              'userId': senderId,  // The user whose chat you want to update
              'chatLists.senderId': receiverId  // The sender whose message you want to update
            },
            {
              $set: {
                'chatLists.$.lastMessage':  messageDoc 
              }
            }
          );


          resolve({ status: true, message: messageDoc });
        } else {
          // If no conversation exists, create a new one
          const newConversation = {
            _id: new ObjectId(),
            type,
            participants: [
              { userId: senderId },
              { userId: receiverId }
            ],
            messages: [messageDoc]
          };

          chatLists = {
            senderId: receiverId,
            lastMessage: messageDoc
          }

          const newDashboard = {
            _id: new ObjectId(),
            userId: senderId,
            chatLists: [chatLists]
          }

          const dashBoadrdExist = await db.get().collection(collection.DASHBOARD_COLLECTION).findOne({ userId: senderId })
          if (dashBoadrdExist) {
            console.log('dashboard is exist');

            const dashboardUpdate = await db.get().collection(collection.DASHBOARD_COLLECTION).updateOne(
              { userId: senderId },
              {
                $push: {
                  chatLists: {
                    senderId: receiverId,
                    lastMessage: messageDoc
                  }
                }
              }
            )

          } 
            const result = await db.get().collection(collection.MESSAGES_COLLECTION)
              .insertOne(newConversation);
            //  console.log('new con result', result);

            const dashboard = await db.get().collection(collection.DASHBOARD_COLLECTION).insertOne(newDashboard)
            console.log('dash board', dashboard);

            resolve({ status: true, message: messageDoc });
          
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  getMessages: (senderId, receiverId) => {
    //  console.log('sender', senderId, 'reseiver', receiverId);

    return new Promise((resolve, reject) => {
      //  console.log('Fetching messages for participants:', { senderId, receiverId }); // Log inputs

      db.get()
        .collection(collection.MESSAGES_COLLECTION)
        .findOne(
          {
            participants: {
              $size: 2, // Ensure there are exactly two participants
            },
            "participants.userId": { $all: [senderId, receiverId] }, // Check both senderId and receiverId are in participants
          },
          {
            projection: { _id: 0, messages: 1 }, // Only retrieve the messages array
          }
        )
        .then((result) => {
          if (result) {
            // console.log('Messages found:', result.messages); // Log retrieved messages
            resolve(result.messages); // Return the messages array
          } else {
            console.log('No messages found for the given participants'); // Log when no result is found
            resolve([]); // Return an empty array if no conversation exists
          }
        })
        .catch((err) => {
          console.error('Error fetching messages:', err); // Log any error during the query
          reject(err);
        });
    });
  },

  getChatList: (userId) => {
    return new Promise(async (resolve, reject) => {


      try {
        const chatLists = await db.get().collection(collection.DASHBOARD_COLLECTION).findOne({ userId: userId })
        console.log('the chat list ', chatLists);
        resolve(chatLists.chatLists)
      } catch (error) {
        reject('Something went wrong')
      }

    })
  }






}