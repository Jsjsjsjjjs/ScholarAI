import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('internal_gen')
    .setDescription('Internal generation logic'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'internal_gen WIP...', ephemeral: true });
  },
};
