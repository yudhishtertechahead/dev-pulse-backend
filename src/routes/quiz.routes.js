const express = require('express');
const router = express.Router();
const quizCtrl = require('../controllers/quiz.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect); // All quiz routes are protected

router.post('/', quizCtrl.submitQuiz);
router.get('/', quizCtrl.getPastQuizzes);
router.get('/:id', quizCtrl.getQuizDetails);

module.exports = router;
