const router = require('express').Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// Add middleware for CSRF protection
router.use(cookieParser());
// router.use(csrf({ cookie: true }));

// creating user
router.post('/', async (req, res) => {
  try {
      const { name, email, password, picture } = req.body;
      console.log(req.body);
      const user = await User.create({ name, email, password, picture });
      res.status(201).json(user);
  } catch (e) {
      let errorMessage = '';
      if (e.code === 11000) {
          errorMessage = 'User already exists';
      } else {
          errorMessage = e.message;
      }
      console.log(e);
      res.status(400).json({ message: errorMessage }); // Return error in consistent format
  }
});

// login user
router.post('/login', async(req, res) => {
  try {
      const { email, password } = req.body;
      const user = await User.findByCredentials(email, password);

      // Generate JWT token
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      // Set token as HTTP-only cookie
      res.cookie('authtoken', token, { httpOnly: true, secure: false, sameSite: 'Lax' });

      user.status = 'online';
      
      await user.save();
    //   user .password = ""
      res.status(200).json(user);
  } catch (e) {
      res.status(400).json(e.message);
  }
}); 

module.exports = router;
