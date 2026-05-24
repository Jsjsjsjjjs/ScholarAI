import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tictactoe_stats')
    .setDescription('View tictactoe stats'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'TicTacToe Stats WIP...', ephemeral: true });
  },
};
