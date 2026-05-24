import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('console_log')
    .setDescription('Fetch raw console logs (Owner only)'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Console Logs WIP...', ephemeral: true });
  },
};
