import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('assets')
    .setDescription('Select and handle assets via a dropdown'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Assets WIP...', ephemeral: true });
  },
};
