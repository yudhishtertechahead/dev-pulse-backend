const QuizModel = require('../models/quiz.model');

exports.submitQuiz = async (req, res, next) => {
  try {
    const { difficulty, score, total_questions, time_taken, questions } = req.body;
    const user_id = req.user.id;

    if (!difficulty || score === undefined || !total_questions || time_taken === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const quiz = await QuizModel.createQuiz({
      user_id,
      difficulty,
      score,
      total_questions,
      time_taken,
      questions
    });

    res.status(201).json({
      success: true,
      data: quiz
    });
  } catch (error) {
    next(error);
  }
};

exports.getPastQuizzes = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const quizzes = await QuizModel.findByUserId(user_id);

    res.status(200).json({
      success: true,
      data: quizzes
    });
  } catch (error) {
    next(error);
  }
};

exports.getQuizDetails = async (req, res, next) => {
  try {
    const quiz_id = req.params.id;
    const quiz = await QuizModel.findById(quiz_id);

    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    if (quiz.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this quiz' });
    }

    res.status(200).json({
      success: true,
      data: quiz
    });
  } catch (error) {
    next(error);
  }
};
