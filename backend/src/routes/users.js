const express = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { 
  updateProfileSchema, 
  followUserSchema, 
  blockUserSchema, 
  reportUserSchema,
  paginationSchema 
} = require('../middleware/validationSchemas');

const router = express.Router();

// Must be before /:userId to avoid being caught as a userId param
router.get('/featured-hosts', userController.getFeaturedHosts);
router.get('/search', userController.searchUsers);

// Returns the currently authenticated user's full profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await require('../models/User').findById(req.userId).select('-passwordHash -__v');
    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }
    res.json(user.toJSON());
  } catch (err) {
    next(err);
  }
});

router.get('/:userId', userController.getProfile);

router.put('/:userId', authenticate, validateRequest(updateProfileSchema), userController.updateProfile);

router.post('/:userId/follow', authenticate, validateRequest(followUserSchema), userController.followUser);

router.delete('/:userId/follow/:targetUserId', authenticate, userController.unfollowUser);

router.get('/:userId/followers', validateQuery(paginationSchema), userController.getFollowers);

router.get('/:userId/following', validateQuery(paginationSchema), userController.getFollowing);

router.post('/:userId/block', authenticate, validateRequest(blockUserSchema), userController.blockUser);

router.post('/:userId/report', authenticate, validateRequest(reportUserSchema), userController.reportUser);

module.exports = router;
