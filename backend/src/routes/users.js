const express = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/:userId', userController.getProfile);

router.put('/:userId', authenticate, userController.updateProfile);

router.post('/:userId/follow', authenticate, userController.followUser);

router.delete('/:userId/follow/:targetUserId', authenticate, userController.unfollowUser);

router.get('/:userId/followers', userController.getFollowers);

router.get('/:userId/following', userController.getFollowing);

router.post('/:userId/block', authenticate, userController.blockUser);

router.post('/:userId/report', authenticate, userController.reportUser);

module.exports = router;
