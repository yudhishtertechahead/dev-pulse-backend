const DIFFICULTIES = ['easy', 'medium', 'hard', 'any'];

function round1(value) {
  return Math.round(value * 10) / 10;
}

function scorePercent(score, totalQuestions) {
  if (!totalQuestions) return 0;
  return round1((score / totalQuestions) * 100);
}

function formatTrendDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function emptyQuizStats() {
  return {
    summary: {
      totalQuizzes: 0,
      averageScorePercent: 0,
      bestScorePercent: 0,
      totalQuestionsAnswered: 0,
      averageTimeSeconds: 0,
      lastQuizAt: null,
    },
    byDifficulty: DIFFICULTIES.map((difficulty) => ({
      difficulty,
      attempts: 0,
      averageScorePercent: 0,
    })),
    scoreTrend: [],
  };
}

/**
 * Builds aggregated quiz stats from raw quiz rows.
 * Matches the frontend contract in quizAnalytics.js.
 */
function buildQuizStatsFromRows(quizzes) {
  if (!Array.isArray(quizzes) || quizzes.length === 0) {
    return emptyQuizStats();
  }

  const sortedByDate = [...quizzes].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const percents = sortedByDate.map((quiz) =>
    scorePercent(quiz.score, quiz.total_questions)
  );

  const lastQuiz = sortedByDate[sortedByDate.length - 1];

  const summary = {
    totalQuizzes: sortedByDate.length,
    averageScorePercent: round1(
      percents.reduce((sum, value) => sum + value, 0) / sortedByDate.length
    ),
    bestScorePercent: round1(Math.max(...percents)),
    totalQuestionsAnswered: sortedByDate.reduce(
      (sum, quiz) => sum + quiz.total_questions,
      0
    ),
    averageTimeSeconds: Math.round(
      sortedByDate.reduce((sum, quiz) => sum + quiz.time_taken, 0) /
        sortedByDate.length
    ),
    lastQuizAt: lastQuiz?.created_at
      ? new Date(lastQuiz.created_at).toISOString()
      : null,
  };

  const byDifficulty = DIFFICULTIES.map((difficulty) => {
    const attempts = sortedByDate.filter(
      (quiz) => quiz.difficulty === difficulty
    );

    if (attempts.length === 0) {
      return { difficulty, attempts: 0, averageScorePercent: 0 };
    }

    const average = round1(
      attempts.reduce(
        (sum, quiz) => sum + scorePercent(quiz.score, quiz.total_questions),
        0
      ) / attempts.length
    );

    return {
      difficulty,
      attempts: attempts.length,
      averageScorePercent: average,
    };
  });

  const scoreTrend = sortedByDate.slice(-20).map((quiz) => ({
    quizId: quiz.id,
    date: formatTrendDate(quiz.created_at),
    scorePercent: scorePercent(quiz.score, quiz.total_questions),
    score: quiz.score,
    totalQuestions: quiz.total_questions,
  }));

  return { summary, byDifficulty, scoreTrend };
}

module.exports = {
  emptyQuizStats,
  buildQuizStatsFromRows,
};
