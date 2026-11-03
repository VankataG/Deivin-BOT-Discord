import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { data as sessionsCommand } from './commands/sessions.js';
import { data as coinCommand } from './commands/coin.js';
import { data as quizCommand } from './commands/quiz.js';
import { data as leaderboardCommand } from './commands/leaderboard.js';
import { data as newsCommand } from './commands/news.js';
import { data as dealsCommand } from './commands/deals.js';
import { data as dealStatusCommand } from './commands/dealstatus.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error('DISCORD_TOKEN, CLIENT_ID, and GUILD_ID must all be set in .env.');
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
  body: [
    sessionsCommand.toJSON(),
    coinCommand.toJSON(),
    quizCommand.toJSON(),
    leaderboardCommand.toJSON(),
    newsCommand.toJSON(),
    dealsCommand.toJSON(),
    dealStatusCommand.toJSON(),
  ],
});

console.log('Registered /sessions, /coin, /quiz, /leaderboard, /news, /deals, and /dealstatus in the configured Discord server.');
