import { Events, Interaction, MessageFlags } from 'discord.js';
import { CustomClient } from '../index.js';

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction, client: CustomClient) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands?.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      // 1. Acknowledge the interaction immediately to prevent the "Interaction has already been acknowledged" 
      // or "Unknown interaction" errors entirely. This gives us 15 minutes to respond using editReply.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      // 2. Execute command logics. The command logic should only use `interaction.editReply()`.
      await command.execute(interaction);
    } catch (error: any) {
      console.error(`[Global Error Failsafe] Command ${interaction.commandName} crashed: ${error.stack || error.message}`);
      
      // Log to #dev-logs channel if possible
      try {
        if (interaction.guild) {
          const channelName = process.env.DEV_LOGS_CHANNEL_NAME || 'dev-logs';
          const devChannel = interaction.guild.channels.cache.find(c => c.name === channelName && c.isTextBased());
          if (devChannel && devChannel.isTextBased()) {
            await devChannel.send(`🚨 **Command Crash Alert** 🚨\n**User:** ${interaction.user.tag} (${interaction.user.id})\n**Command:** \`/${interaction.commandName}\`\n**Error:**\`\`\`ts\n${error.stack || error.message}\n\`\`\``);
          }
        }
      } catch (logError) {
        console.error('[Global Error Failsafe] Failed to log to #dev-logs channel:', logError);
      }
      
      // 3. Robustly catch and inform the user if the async/await logic inside the command throws an unhandled rejection.
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ 
            content: `⚠️ An internal error occurred while executing \`${interaction.commandName}\`. Our team has been notified.`
          });
        }
      } catch (replyError: any) {
        // If editReply fails (e.g., deleted message, missed 15m window), log it aggressively.
        console.error('[Global Error Failsafe] Failed to notify user of command crash:', replyError.message);
      }
    }
  },
};
