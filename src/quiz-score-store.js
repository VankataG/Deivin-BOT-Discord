import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scoresFile = fileURLToPath(new URL('../data/quiz-scores.json', import.meta.url));

await mkdir(dirname(scoresFile), { recursive: true });

let scoreData;

try {
  scoreData = JSON.parse(await readFile(scoresFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;

  scoreData = { scores: {}, dailyAnswers: {} };
  await writeFile(scoresFile, JSON.stringify(scoreData, null, 2));
}

let pendingSave = Promise.resolve();

function saveScoreData() {
  pendingSave = pendingSave.then(() =>
    writeFile(scoresFile, JSON.stringify(scoreData, null, 2)),
  );

  return pendingSave;
}

export async function recordDailyAnswer({ userId, username, dateKey, isCorrect }) {
  const answerKey = `${dateKey}:${userId}`;
  const previousAnswer = scoreData.dailyAnswers[answerKey];

  if (previousAnswer !== undefined) {
    return { alreadyAnswered: true, wasCorrect: previousAnswer === 'correct' };
  }

  scoreData.dailyAnswers[answerKey] = isCorrect ? 'correct' : 'wrong';

  let pointsAwarded = 0;
  if (isCorrect) {
    const currentScore = scoreData.scores[userId]?.points ?? 0;
    pointsAwarded = 10;
    scoreData.scores[userId] = {
      username,
      points: currentScore + pointsAwarded,
    };
  }

  await saveScoreData();
  return { alreadyAnswered: false, pointsAwarded };
}

export function getLeaderboard() {
  return Object.entries(scoreData.scores)
    .map(([userId, score]) => ({ userId, ...score }))
    .sort((first, second) => second.points - first.points);
}
