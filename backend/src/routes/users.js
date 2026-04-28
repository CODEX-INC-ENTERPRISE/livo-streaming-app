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

router.get('/:userId', userController.getProfile);

router.put('/:userId', authenticate, validateRequest(updateProfileSchema), userController.updateProfile);

router.post('/:userId/follow', authenticate, validateRequest(followUserSchema), userController.followUser);

router.delete('/:userId/follow/:targetUserId', authenticate, userController.unfollowUser);

router.get('/:userId/followers', validateQuery(paginationSchema), userController.getFollowers);

router.get('/:userId/following', validateQuery(paginationSchema), userController.getFollowing);

router.post('/:userId/block', authenticate, validateRequest(blockUserSchema), userController.blockUser);

router.post('/:userId/report', authenticate, validateRequest(reportUserSchema), userController.reportUser);

module.exports = router;
