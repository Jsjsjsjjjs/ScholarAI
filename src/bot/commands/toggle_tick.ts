import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { getDb } from '../utils/firestore.js';

export const data = new SlashCommandBuilder()
  .setName('toggle-tick')
  .setDescription('Toggle or configure ticket ping channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addBooleanOption(option => 
    option.setName('enabled')
      .setDescription('Enable or disable ticket pings')
      .setRequired(true))
  .addChannelOption(option => 
    option.setName('channel')
      .setDescription('Channel to send pings to (defaults to current)'));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const enabled = interaction.options.getBoolean('enabled', true);
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    
    if (!channel) return interaction.editReply({ content: 'Invalid channel.' });

    const db = getDb();
    await db.collection('system').doc('ticketsConfig').set({
      pingEnabled: enabled,
      channelId: channel.id
    }, { merge: true });

    await interaction.editReply({ 
      content: `✅ Ticket pings have been **${enabled ? 'enabled' : 'disabled'}** for <#${channel.id}>`
    });
  } catch (error) {
    console.error('[toggle-tick command error]', error);
    await interaction.editReply({ content: 'Failed to update ticket configuration.' });
  }
}
