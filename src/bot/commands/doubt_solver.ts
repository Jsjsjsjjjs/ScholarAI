import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('doubt_solver')
    .setDescription('Solve an academic doubt'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Doubt Solver WIP...', ephemeral: true });
  },
};
