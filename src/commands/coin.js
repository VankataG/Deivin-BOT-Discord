import { randomInt } from 'node:crypto';
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('coin')
  .setDescription('Хвърля монета: ези или тура.');

export async function execute(interaction) {
  const outcomes = ['Ези', 'Тура'];
  const result = outcomes[randomInt(outcomes.length)];

  await interaction.reply(`🪙 Падна се **${result}!**`);
}
