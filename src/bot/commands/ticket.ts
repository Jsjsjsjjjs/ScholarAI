import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getDb } from '../utils/firestore.js';
import { FieldValue } from 'firebase-admin/firestore';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Manage a support ticket')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcmd => 
    subcmd.setName('view')
      .setDescription('View a ticket')
      .addStringOption(opt => opt.setName('id').setDescription('Ticket ID').setRequired(true)))
  .addSubcommand(subcmd => 
    subcmd.setName('reply')
      .setDescription('Reply to a ticket')
      .addStringOption(opt => opt.setName('id').setDescription('Ticket ID').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Your reply message').setRequired(true)))
  .addSubcommand(subcmd => 
    subcmd.setName('status')
      .setDescription('Change ticket status')
      .addStringOption(opt => opt.setName('id').setDescription('Ticket ID').setRequired(true))
      .addStringOption(opt => 
        opt.setName('status')
          .setDescription('New status')
          .setRequired(true)
          .addChoices(
            { name: 'Open', value: 'open' },
            { name: 'On Hold', value: 'hold' },
            { name: 'Solved', value: 'solved' }
          )))
  .addSubcommand(subcmd => 
    subcmd.setName('delete')
      .setDescription('Delete a ticket permanently')
      .addStringOption(opt => opt.setName('id').setDescription('Ticket ID').setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const sub = interaction.options.getSubcommand();
    const id = interaction.options.getString('id', true);
    const db = getDb();
    const docRef = db.collection('tickets').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return interaction.editReply({ content: `❌ Ticket with ID \`${id}\` not found.` });
    }

    const tData = snap.data() || {};

    if (sub === 'view') {
      const messages = tData.messages || [];
      const msgStr = messages.map((m: any) => `**${m.sender === 'user' ? 'User' : 'Admin'}**: ${m.text}`).join('\n\n').slice(-3500);
      
      const embed = new EmbedBuilder()
        .setTitle(`Ticket: ${tData.subject}`)
        .setDescription(`**Status**: ${tData.status}\n**Submitter**: ${tData.submitterName}\n\n**Chat History** (last 3500 chars):\n${msgStr || 'No messages.'}`)
        .setColor(tData.status === 'open' ? '#3b82f6' : (tData.status === 'solved' ? '#22c55e' : '#f97316'))
        .setFooter({ text: `ID: ${id}` });
        
      await interaction.editReply({ embeds: [embed] });
    }
    else if (sub === 'reply') {
      const msg = interaction.options.getString('message', true);
      const newMsg = {
        sender: 'admin',
        text: msg,
        timestamp: new Date().toISOString()
      };
      
      await docRef.update({
        messages: FieldValue.arrayUnion(newMsg),
        updatedAt: FieldValue.serverTimestamp(),
        status: tData.status === 'solved' ? 'open' : tData.status
      });
      
      await interaction.editReply({ content: `✅ Replied to ticket \`${id}\`.` });
    }
    else if (sub === 'status') {
      const status = interaction.options.getString('status', true);
      await docRef.update({ 
        status, 
        updatedAt: FieldValue.serverTimestamp() 
      });
      await interaction.editReply({ content: `✅ Ticket \`${id}\` status updated to **${status}**.` });
    }
    else if (sub === 'delete') {
      await docRef.delete();
      await interaction.editReply({ content: `🗑️ Ticket \`${id}\` has been permanently deleted.` });
    }

  } catch (err: any) {
    console.error('[Ticket Command Error]', err);
    await interaction.editReply({ content: `An error occurred: ${err.message}` });
  }
}
