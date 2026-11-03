import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { readWheyDealStatus } from '../whey-deals.js';

export const data = new SlashCommandBuilder()
  .setName('dealstatus')
  .setDescription('Покажи статуса на проследяването на whey оферти');

export async function execute(interaction) {
  const status = await readWheyDealStatus();
  const lastCheck = status.lastCheckAt
    ? new Intl.DateTimeFormat('bg-BG', { timeZone: 'Europe/Sofia', dateStyle: 'short', timeStyle: 'short' }).format(new Date(status.lastCheckAt))
    : 'Все още няма проверка';
  const embed = new EmbedBuilder()
    .setColor(status.lastCheckOk ? 0x2ecc71 : 0xe67e22)
    .setTitle('📊 Статус на WHEY Deals Tracker')
    .addFields(
      { name: 'Последна проверка', value: `${lastCheck}${status.lastCheckOk ? ' • успешна' : ''}`, inline: true },
      { name: 'Следени продукти', value: String(status.trackedCount), inline: true },
      { name: 'Следваща проверка', value: status.nextCheck, inline: true },
      { name: 'Праг', value: `€${Number(process.env.WHEY_MAX_EUR_PER_KG ?? 30).toFixed(2)}/kg`, inline: true },
    );
  const checks = Object.values(status.shopChecks ?? {});
  if (checks.length) {
    embed.addFields({
      name: 'Резултати по магазини',
      value: checks.map((check) => `${check.ok ? '✅' : '⚠️'} ${check.store}${check.error ? ` — ${check.error}` : ` — €${check.priceEur.toFixed(2)}`}`).join('\n').slice(0, 1024),
    });
  }
  if (status.lastCheckError) embed.setDescription(status.lastCheckError);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
