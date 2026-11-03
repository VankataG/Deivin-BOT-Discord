import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { data as sessionsCommand, execute as executeSessions } from './commands/sessions.js';
import { data as coinCommand, execute as executeCoin } from './commands/coin.js';
import { data as quizCommand, execute as executeQuiz, handleAnswer as handleQuizAnswer } from './commands/quiz.js';
import { data as leaderboardCommand, execute as executeLeaderboard } from './commands/leaderboard.js';
import { data as newsCommand, execute as executeNews } from './commands/news.js';
import { startNewsAutomation } from './news-digest.js';
import { data as dealsCommand, execute as executeDeals } from './commands/deals.js';
import { data as dealStatusCommand, execute as executeDealStatus } from './commands/dealstatus.js';
import { startWheyDealsAutomation } from './whey-deals.js';

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('DISCORD_TOKEN is missing. Add it to your .env file.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commandHandlers = new Map([
  [sessionsCommand.name, executeSessions],
  [coinCommand.name, executeCoin],
  [quizCommand.name, executeQuiz],
  [leaderboardCommand.name, executeLeaderboard],
  [newsCommand.name, executeNews],
  [dealsCommand.name, executeDeals],
  [dealStatusCommand.name, executeDealStatus],
]);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  startNewsAutomation(readyClient);
  startWheyDealsAutomation(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith('quiz:')) {
      await handleQuizAnswer(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const executeCommand = commandHandlers.get(interaction.commandName);
    if (!executeCommand) return;

    await executeCommand(interaction);
  } catch (error) {
    console.error(`Failed to handle /${interaction.commandName}:`, error);

    const reply = {
      content: 'Възникна грешка при изпълнението на командата.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

await client.login(token);
