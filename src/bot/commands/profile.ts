import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Shows a user profile'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Profile loading...', ephemeral: true });
  },
};
