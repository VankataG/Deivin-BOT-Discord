import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getTradingSessions } from '../trading-sessions.js';

export const data = new SlashCommandBuilder()
  .setName('sessions')
  .setDescription('Показва информация за основните Forex сесии.');

export async function execute(interaction) {
  const sessions = getTradingSessions();
  const anySessionOpen = sessions.some((session) => session.isOpen);

  const embed = new EmbedBuilder()
    .setTitle('Основни Forex сесии')
    .setColor(anySessionOpen ? 0x2ecc71 : 0xe74c3c)
    .setDescription('Часовете са показани в българско време (Europe/Sofia).')
    .addFields(
      sessions.map((session) => ({
        name: `${session.isOpen ? '🟢' : '🔴'} ${session.name}`,
        value: [
          `**Часове:** ${session.opensAtSofia}–${session.closesAtSofia}`,
          `**Статус:** ${session.isOpen ? 'OPEN' : 'CLOSED'}`,
        ].join('\n'),
        inline: false,
      })),
    )
    .setFooter({
      text: 'Ориентировъчни Forex прозорци; не са универсални часове за всички финансови пазари.',
    });

  await interaction.reply({ embeds: [embed] });
}
