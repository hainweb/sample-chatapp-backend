var express = require('express');
var router = express.Router();
var userHelpers = require('../helpers/userHelpers');

// Middleware to log req.session.user when the request comes in
router.use((req, res, next) => {
  console.log('Incoming request. req.session.user:', req.session.user);
  next();
});

// Middleware to log after the response is sent
router.use((req, res, next) => {
  res.on('finish', () => {
    console.log('Response sent. req.session.user:', req.session.user);
  });
  next();
});

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/get-user', (req, res) => {
  if (req.session.user) {
    let user = req.session.user;
    res.json({ status: true, user });
  } else {
    res.json({ status: false });
  }
});

router.post('/signup', (req, res) => {
  console.log('api call signup');
  userHelpers.doSignup(req.body).then((response1) => {
    console.log('response1', response1);
    if (response1.status) {
      req.session.user = { loggedIn: true, ...response1.user };
      res.json({ status: true, user: req.session.user });
    } else {
      req.session.signupErr = 'This number is already taken';
      res.json(response1);
    }
  });
});

router.post('/login', (req, res) => {
  userHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      // Regenerate session to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: 'Session regeneration failed' });
        }
        
        req.session.user = { 
          loggedIn: true, 
          ...response.user 
        };
        
        // Save session explicitly
        req.session.save((saveErr) => {
          if (saveErr) {
            return res.status(500).json({ error: 'Session save failed' });
          }
          res.json({ 
            loggedIn: true, 
            user: req.session.user 
          });
        });
      });
    } else {
      res.json({ 
        loggedIn: false, 
        message: "Invalid username or password" 
      });
    }
  }).catch((error) => {
    res.status(500).json({ error: 'Login process failed' });
  });
});

router.get('/logout', (req, res) => {
  console.log('api call');
  req.session.user = null;
  res.json({ logout: true });
});

router.post('/find-user', (req, res) => {
  console.log('api call to find user');
  userHelpers.findUser(req.body.username).then((response) => {
    res.json(response);
  });
});

router.post('/get-user-messages', async (req, res) => {
  console.log('api call to get user message');
  let user = await userHelpers.getUser(req.body.userId);
  let senderId = req.session.user._id;
  let messages = await userHelpers.getMessages(senderId, req.body.userId);
  res.json({ status: true, user, messages });
});

router.post('/send-message', (req, res) => {
  console.log('api call to send msg');
  let { receiverId, message, messageId } = req.body;
  const senderId = req.session.user._id;
  const type = 'private';
  userHelpers.addMessages(messageId, senderId, receiverId, message, type).then((response) => {
    res.json(response);
  });
});

router.get('/get-chat-list', async (req, res) => {
  console.log('api call to get chat list');
  const chatLists = await userHelpers.getChatList(req.session.user._id);
  console.log('chatLists:', chatLists);

  // Function to fetch details based on senderId
  const fetchUserDetails = async (chatLists) => {
    if (!chatLists || !Array.isArray(chatLists)) {
      console.log('chatLists is undefined or not an array');
      return;
    }
  
    const userDetailsPromises = chatLists.map(async (chat) => {
      // Fetch the user details using the senderId from chat
      const userDetail = await userHelpers.getUser(chat.senderId);
      console.log('chatlist user details', userDetail);
      return userDetail;
    });
  
    // Wait for all the user details to be fetched
    const userDetails = await Promise.all(userDetailsPromises);
    console.log('chatlist all user details', userDetails);
 
    const updatedUserDetails = userDetails.map((user) => {
      const chat = chatLists.find((chat) => chat.senderId === user._id.toString());
      return {
        ...user,
        lastMessage: chat ? chat.lastMessage : null,
      };
    });
    console.log('updated user details', updatedUserDetails);
    
    res.json(updatedUserDetails);
  };
  
  await fetchUserDetails(chatLists);
});

module.exports = router;
