import { SlashCommandBuilder } from 'discord.js';
import { buildDealsEmbed, checkWheyDeals } from '../whey-deals.js';

export const data = new SlashCommandBuilder()
  .setName('deals')
  .setDescription('Провери актуалните оферти за whey протеин')
  .addBooleanOption((option) => option.setName('test_embed').setDescription('Изпрати еднократен тестов embed в канала за оферти'));

export async function execute(interaction) {
  if (interaction.options.getBoolean('test_embed')) {
    const channelId = process.env.WHEY_DEALS_CHANNEL_ID;
    if (!channelId) {
      await interaction.reply({ content: 'WHEY_DEALS_CHANNEL_ID не е настроен.', ephemeral: true });
      return;
    }
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.send) throw new Error('Каналът за оферти не е достъпен за бота.');
    await channel.send({ embeds: [buildDealsEmbed([], { test: true })] });
    await interaction.reply({ content: 'Изпратих тестов embed. Историята на офертите не е променена.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const { deals, failures, checkedCount } = await checkWheyDeals();
  if (checkedCount === 0) {
    await interaction.editReply(`Не успях да прочета цена от нито един магазин. Провери логовете на бота. (${failures.length} източника пропуснати)`);
    return;
  }
  if (deals.length === 0) {
    const skipped = failures.length ? ` ${failures.length} страници бяха пропуснати; виж логовете за причините.` : '';
    await interaction.editReply(`Проверих ${checkedCount} продукта. Няма оферта под €${Number(process.env.WHEY_MAX_EUR_PER_KG ?? 30).toFixed(2)}/kg.${skipped}`);
    return;
  }
  const skipped = failures.length ? ` ${failures.length} страници бяха пропуснати; виж логовете за причините.` : '';
  await interaction.editReply({ content: `Актуални оферти (${checkedCount} проверени продукта).${skipped}`, embeds: [buildDealsEmbed(deals)] });
}
