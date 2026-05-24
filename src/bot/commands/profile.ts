import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchDocSafe } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('👤 Shows a detailed academic profile and system statistics card')
    .addUserOption(option => 
      option.setName('target')
        .setDescription('Select is student user to view their study profile')
        .setRequired(false)
    ),
  async execute(interaction: any) {
    // 1. Defer the interaction since database queries can exceed the 3-second threshold
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('target') || interaction.user;
    const targetId = targetUser.id;

    try {
      // 2. Query user metadata and academic stats collections
      const { data: userData, exists: userExists } = await fetchDocSafe('users', targetId, 5000);
      const { data: statsData, exists: statsExists } = await fetchDocSafe('stats', targetId, 5000);

      if (!userExists && !statsExists) {
        return await interaction.editReply({
          content: `⚠️ **Scholar Not Found:** \`${targetUser.tag}\` does not have an active session associated with our central database yet.`
        });
      }

      // 3. Extrapolate profiles parameters
      const userDoc = userData || {};
      const statsDoc = statsData || {};

      const nickname = userDoc.nickname || statsDoc.nickname || targetUser.username;
      const role = (userDoc.role || 'Scholar').toUpperCase();
      const plan = (userDoc.plan || 'Free Tier').toUpperCase();
      
      // Safe email masking for privacy protection across public chats
      let email = userDoc.email || 'N/A';
      if (email !== 'N/A' && email.includes('@')) {
        const [left, right] = email.split('@');
        email = `${left[0]}***${left[left.length - 1] || ''}@${right}`;
      }

      // Date safely parsed
      let joinedDate = 'New Student';
      if (userDoc.joinedAt) {
        if (typeof userDoc.joinedAt.toDate === 'function') {
          joinedDate = userDoc.joinedAt.toDate().toLocaleDateString();
        } else if (userDoc.joinedAt instanceof Date) {
          joinedDate = userDoc.joinedAt.toLocaleDateString();
        } else {
          joinedDate = new Date(userDoc.joinedAt).toLocaleDateString();
        }
      }

      // Education Stats Metrics
      const quizCorrect = statsDoc.quizCorrect ?? 0;
      const totalAttempted = statsDoc.totalAttempted ?? 0;
      const accuracy = statsDoc.accuracy ?? (totalAttempted > 0 ? ((quizCorrect / totalAttempted) * 100).toFixed(1) : 0);
      const timeSpent = statsDoc.timeSpent ?? 0; // minutes

      // Tic Tac Toe Standings
      const tttWins = userDoc.tttWins ?? 0;
      const tttLosses = userDoc.tttLosses ?? 0;
      const tttTies = userDoc.tttTies ?? 0;
      const elo = userDoc.tttElo ?? (1000 + tttWins * 25 - tttLosses * 15);

      const avatarUrl = targetUser.displayAvatarURL({ forceStatic: false }) || 'https://images.unsplash.com/photo-1541829019-259273aed3c3?q=80&w=200';

      const embed = new EmbedBuilder()
        .setTitle(`🎓 SCHOLAR CARD: ${nickname.toUpperCase()}`)
        .setThumbnail(avatarUrl)
        .setColor(0x0284C7) // Sky blue
        .setDescription(`Active academic diagnostic profile since **${joinedDate}**. Fully integrated with Central Intelligence Systems.`)
        .addFields(
          { name: '👤 Nickname / Identification', value: `\`${nickname}\``, inline: true },
          { name: '🛡️ Role Designation', value: `\`${role}\``, inline: true },
          { name: '✉️ Registered Email', value: `\`${email}\``, inline: true },
          { name: '💎 Account Priority Plan', value: `\`${plan}\``, inline: true },
          { name: '📚 Total Revision Points', value: `\`${quizCorrect * 10} pts\``, inline: true },
          { name: '🧠 Accuracy Quotient', value: `\`${accuracy}% (${quizCorrect}/${totalAttempted})\``, inline: true },
          { name: '⏱️ Study Session Duration', value: `\`${timeSpent} minutes\``, inline: true },
          { name: '👾 Cognitive Duel Rank', value: `\`${elo} ELO (Record: ${tttWins}W - ${tttLosses}L - ${tttTies}D)\``, inline: false }
        )
        .setFooter({ text: 'ScholarAI Platform • Empirical Study Logs', iconURL: avatarUrl })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (err: any) {
      console.error('[Profile Command Error]', err);
      await interaction.editReply({
        content: `❌ **Failed to retrieve student profile:** Verification session exception caught.\n*Diagnostics: ${err.message}*`
      });
    }
  },
};

