import { SlashCommandBuilder } from 'discord.js';
import { fetchDocSafe } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows the current AI and usage stats fetched robustly from Firestore.'),
  async execute(interaction: any) {
    // 1. We assume `interaction.deferReply()` has ALREADY been called by interactionCreate.ts.
    // This stops infinite loading on Discord UI immediately.

    // 2. Fetch data using our robust connection client with a 5-second timeout.
    const userId = interaction.user.id;
    let { data: userData, exists, error } = await fetchDocSafe('users', userId, 5000);
    if (!userData && interaction.user.username) {
      const fallbackResult = await fetchDocSafe('users', interaction.user.username, 5000);
      userData = fallbackResult.data;
      exists = fallbackResult.exists;
    }

    // 3. Handle connection timeouts or Firestore logic rejections
    if (error) {
      // Because we deferred, we must use editReply
      return await interaction.editReply({
        content: `⚠️ **Network Timeout / Error:** Could not reach the Database to fetch your stats. Please try again in a few moments.\n\n*Diagnostics: ${error}*`
      });
    }

    // 4. Handle normal DB state empty vs populated
    if (!exists || !userData) {
      return await interaction.editReply({
        content: '📊 Welcome! It looks like you do not have any tracked statistics yet. Use some AI tools first to populate your profile.'
      });
    }

    // 5. Successful response mapping
    const totalRequests = userData.aiRequests || 0;
    const totalTokens = userData.totalTokens || 0;
    
    let lastActive = 'Unknown';
    if (userData.lastAIActivity) {
      if (typeof userData.lastAIActivity.toDate === 'function') {
        lastActive = userData.lastAIActivity.toDate().toLocaleString();
      } else if (typeof userData.lastAIActivity === 'string') {
        lastActive = new Date(userData.lastAIActivity).toLocaleString();
      } else {
        lastActive = String(userData.lastAIActivity);
      }
    }

    await interaction.editReply({
      content: `📊 **Your AI Statistics:**\n\n- **Total Requests:** ${totalRequests}\n- **Tokens Consumed:** ${totalTokens}\n- **Last Used:** ${lastActive}`
    });
  },
};
