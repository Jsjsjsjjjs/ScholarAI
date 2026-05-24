import { SlashCommandBuilder } from 'discord.js';
import { fetchDocSafe, resolveScholarId } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows the current AI and usage stats fetched robustly from Firestore based on Scholar ID.')
    .addStringOption(option =>
      option.setName('scholar_id')
        .setDescription('Optional: Specific Scholar ID to look up (defaults to your linked Discord profile)')
        .setRequired(false)
    ),
  async execute(interaction: any) {
    const inputScholarId = interaction.options.getString('scholar_id');

    // 1. Resolve Scholar ID or Discord linked profile
    const { scholarId, userData: resolvedUserData } = await resolveScholarId(interaction.user, inputScholarId);

    if (!scholarId) {
      return await interaction.editReply({
        content: `⚠️ **No Profile Found:** We could not resolve a Scholar ID for you in our systems. Please log in first on the website or specify a valid \`scholar_id\` command option.`
      });
    }

    // 2. Fetch user document safely
    const { data: userData, exists, error } = resolvedUserData 
      ? { data: resolvedUserData, exists: true, error: null } 
      : await fetchDocSafe('users', scholarId, 5000);

    // 3. Handle network/timeout errors
    if (error) {
      return await interaction.editReply({
        content: `⚠️ **Network Timeout / Error:** Could not reach the Database to fetch scholar stats.\n\n*Diagnostics: ${error}*`
      });
    }

    if (!exists || !userData) {
      return await interaction.editReply({
        content: `📊 **Scholar ID Resolved:** \`${scholarId}\`\nIt looks like this profile doesn't have any tracked statistics yet. Use some AI tools on the website first to populate your profile!`
      });
    }

    // 4. Extract telemetry and render
    const nickname = userData.nickname || 'Scholar Elite';
    const totalRequests = userData.aiRequests || 0;
    const totalTokens = userData.totalTokens || 0;
    const lastActive = userData.lastAIActivity?.toDate 
      ? userData.lastAIActivity.toDate().toLocaleString() 
      : (userData.lastAIActivity ? String(userData.lastAIActivity) : 'Unknown');

    await interaction.editReply({
      content: `📊 **AI Usage Statistics for Scholar:**\n\n- **Scholar ID:** \`${scholarId}\`\n- **Nickname:** **${nickname}**\n- **Total requests:** ${totalRequests}\n- **Tokens Consumed:** ${totalTokens}\n- **Last Used:** ${lastActive}`
    });
  },
};
