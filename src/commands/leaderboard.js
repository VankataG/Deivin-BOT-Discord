import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getLeaderboard } from '../quiz-score-store.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Показва класирането по Pips.');

export async function execute(interaction) {
  const leaderboard = getLeaderboard();

  if (leaderboard.length === 0) {
    await interaction.reply('Още няма Pips. Използвай `/quiz`, за да започнеш!');
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const rows = leaderboard.slice(0, 10).map((entry, index) => {
    const rank = medals[index] ?? `**${index + 1}.**`;
    return `${rank} **${entry.username}** — ${entry.points} Pips`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 Pips leaderboard')
    .setDescription(rows.join('\n'))
    .setColor(0xf1c40f);

  await interaction.reply({ embeds: [embed] });
}
