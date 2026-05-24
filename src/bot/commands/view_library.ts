import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('view_library')
    .setDescription('View library'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Library WIP...', ephemeral: true });
  },
};
