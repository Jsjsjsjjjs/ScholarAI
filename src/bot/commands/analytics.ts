import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('Analytics overview (Owner only)'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Analytics WIP...', ephemeral: true });
  },
};
