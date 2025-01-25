var express = require('express');
var router = express.Router();
var userHelpers = require('../helpers/userHelpers')
/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});


router.get('/get-user', (req, res) => {
  // console.log('sess', req.session.user);

  if (req.session.user) {
    let user = req.session.user
    // console.log('user session', user);
    res.json({ status: true, user })

  } else {
    res.json({ status: false })
  }
})


router.post('/signup', (req, res) => {
  console.log('api call signup');

  userHelpers.doSignup(req.body).then((response1) => {
    console.log('resoponse1', response1)
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

  req.session.user = null
  res.json({ logout: true })
})



router.post('/find-user', (req, res) => {
  console.log('api call to find user');
  userHelpers.findUser(req.body.username).then((response) => {
    res.json(response)
  })

})

router.post('/get-user-messages', async (req, res) => {
  console.log('api call to get user message');
  let user = await userHelpers.getUser(req.body.userId)
  // console.log('user ', user); 

  let senderId = req.session.user._id

  let messages = await userHelpers.getMessages(senderId, req.body.userId)



  res.json({ status: true, user, messages })

})

router.post('/send-message', (req, res) => {
  console.log('api call to send msg');
  let { receiverId, message, messageId } = req.body;
  const senderId = req.session.user._id
  const type = 'private'
  //console.log('datas sender:', senderId, 'receiver', receiverId, 'message', message);



  userHelpers.addMessages(messageId, senderId, receiverId, message, type).then((response) => {
    res.json(response)
  })

 
})

router.get('/get-chat-list',async (req, res) => {
  console.log('api call to get chat list');

  const chatLists = await userHelpers.getChatList(req.session.user._id); // Fetch chat lists based on session user's _id
console.log('chatlstgvsbbhs',chatLists);

 
  // Function to fetch details based on senderId
  const fetchUserDetails = async (chatLists) => {
    if (!chatLists || !Array.isArray(chatLists)) {
      console.log('chatLists is undefined or not an array');
      return;
    }
  
    const userDetailsPromises = chatLists.map(async (chat) => {
      // Fetch the user details using the senderId from chat
      const userDetail = await userHelpers.getUser( chat.senderId );
      console.log('chatlist user details', userDetail);
      return userDetail; // Ensure to return the userDetail for Promise.all
    });
  
    // Wait for all the user details to be fetched
    const userDetails = await Promise.all(userDetailsPromises);
    console.log('chatlist all user details', userDetails);
 
    const updatedUserDetails = userDetails.map((user) => {
      const chat = chatLists.find((chat) => chat.senderId === user._id.toString());
      return {
        ...user,
        lastMessage: chat ? chat.lastMessage : null, // Attach lastMessage or null if no match
      };
    });
    console.log('upda',updatedUserDetails);
    
    // Send the updated userDetails array
    res.json( updatedUserDetails );
    
  };
  
  // Example usage
  await fetchUserDetails(chatLists);

  


 
  

})  

module.exports = router;
