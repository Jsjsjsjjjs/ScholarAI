import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Shows the top users in the server by stats'),
  async execute(interaction: any) {
    await safeReply(interaction, { content: 'Leaderboard loading...', ephemeral: true });
  },
};
