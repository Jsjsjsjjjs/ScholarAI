import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('identity')
    .setDescription('Show server identity card'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Identity WIP...', ephemeral: true });
  },
};
