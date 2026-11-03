import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import {
  formatPublishedAt,
  getMarketContext,
  getTodaysNews,
  translateToBulgarian,
} from '../news-digest.js';

export const data = new SlashCommandBuilder()
  .setName('news')
  .setDescription('Показва новините за днешния ден в българско време.');

export async function execute(interaction) {
  await interaction.deferReply();

  const items = await getTodaysNews();
  if (items.length === 0) {
    await interaction.editReply('Днес няма нови избрани заглавия в следените RSS емисии.');
    return;
  }

  const translatedItems = [];
  for (const item of items) {
    translatedItems.push({
      ...item,
      translatedTitle: await translateToBulgarian(item.title),
    });
  }

  const embeds = [];
  for (let start = 0; start < translatedItems.length; start += 25) {
    const chunk = translatedItems.slice(start, start + 25);
    const embed = new EmbedBuilder()
      .setTitle('🗞️ Новини за днес')
      .setColor(0x2f80ed)
      .setDescription('Заглавията са преведени на български. Източниците и часовете са посочени към всяка новина.')
      .addFields(
        chunk.map((item) => ({
          name: `[${item.currency}] ${item.translatedTitle}`.slice(0, 256),
          value: [
            `**Какво да следим:** ${getMarketContext(item.title)}`,
            `[${item.source} — ${formatPublishedAt(item.publishedAt)}](${item.url})`,
          ].join('\n'),
          inline: false,
        })),
      );

    embeds.push(embed);
  }

  for (let start = 0; start < embeds.length; start += 10) {
    const group = embeds.slice(start, start + 10);
    if (start === 0) {
      await interaction.editReply({ embeds: group });
    } else {
      await interaction.followUp({ embeds: group });
    }
  }
}
