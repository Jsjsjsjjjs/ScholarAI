import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('👤 Shows a detailed academic profile and system statistics card based on Scholar ID')
    .addStringOption(option =>
      option.setName('scholar_id')
        .setDescription('Optional: Specific Scholar ID to view (Document ID in the database)')
        .setRequired(false)
    )
    .addUserOption(option => 
      option.setName('target')
        .setDescription('Optional: Select a Discord student user to view their linked profile')
        .setRequired(false)
    ),
  async execute(interaction: any) {
    // Lazy load logic to prevent circular dependencies
    const { fetchDocSafe, resolveScholarId } = await import('../utils/firestore.js');

    // 1. Defer the interaction since database queries can exceed the 3-second threshold
    await interaction.deferReply();

    const inputScholarId = interaction.options.getString('scholar_id');
    const targetUser = interaction.options.getUser('target') || interaction.user;

    try {
      // 2. Resolve Scholar ID or Discord linked profile
      let resolvedScholarId: string | null = null;
      let resolvedUserData: any = null;

      if (inputScholarId) {
        const { scholarId, userData } = await resolveScholarId(interaction.user, inputScholarId);
        resolvedScholarId = scholarId;
        resolvedUserData = userData;
      } else {
        const { scholarId, userData } = await resolveScholarId(targetUser);
        resolvedScholarId = scholarId;
        resolvedUserData = userData;
      }

      if (!resolvedScholarId) {
        return await interaction.editReply({
          content: `⚠️ **Scholar Profile Not Found:** We could not resolve a Scholar ID mapping in our database for ${targetUser.tag}. Please sign in on the website, link your Discord settings, or provide a direct \`scholar_id\` parameter.`
        });
      }

      // 3. Query user metadata and academic stats collections on basis of resolved Scholar ID
      const { data: userData, exists: userExists } = resolvedUserData 
        ? { data: resolvedUserData, exists: true } 
        : await fetchDocSafe('users', resolvedScholarId, 5000);

      const { data: statsData, exists: statsExists } = await fetchDocSafe('stats', resolvedScholarId, 5000);

      if (!userExists && !statsExists) {
        return await interaction.editReply({
          content: `⚠️ **Scholar Not Found:** Scholar ID \`${resolvedScholarId}\` does not have an active session associated with our central database.`
        });
      }

      // 4. Extrapolate profiles parameters
      const userDoc = userData || {};
      const statsDoc = statsData || {};

      const nickname = userDoc.nickname || statsDoc.nickname || (inputScholarId ? `Scholar-${resolvedScholarId.slice(0,6)}` : targetUser.username);
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
        .setTitle(`🎓 Scholar: ${nickname.toUpperCase()}`)
        .setThumbnail(avatarUrl)
        .setColor(0x0284C7) // Sky blue
        .setDescription(`Academic study profile for Scholar ID: \`${resolvedScholarId}\` since **${joinedDate}**. Fully integrated with Central Intelligence Systems.`)
        .addFields(
          { name: '👤 Username / Nick', value: `\`${nickname}\``, inline: true },
          { name: '🆔 Scholar ID', value: `\`${resolvedScholarId}\``, inline: true },
          { name: '🛡️ Role Designation', value: `\`${role}\``, inline: true },
          { name: '✉️ Registered Email', value: `\`${email}\``, inline: true },
          { name: '💎 Priority Plan', value: `\`${plan}\``, inline: true },
          { name: '📚 Total Revision Points', value: `\`${quizCorrect * 10} pts\``, inline: true },
          { name: '🧠 Accuracy Quotient', value: `\`${accuracy}% (${quizCorrect}/${totalAttempted})\``, inline: true },
          { name: '⏱️ Revision Duration', value: `\`${timeSpent} minutes\``, inline: true },
          { name: '👾 Game Elo Rating', value: `\`${elo} ELO (Wins: ${tttWins} | Losses: ${tttLosses})\``, inline: false }
        )
        .setFooter({ text: `ScholarAI Central Database Lookup • ID: ${resolvedScholarId}`, iconURL: avatarUrl })
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

