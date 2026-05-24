import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Set a study reminder'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Reminder WIP...', ephemeral: true });
  },
};
