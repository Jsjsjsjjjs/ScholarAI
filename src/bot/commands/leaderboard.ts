import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDb } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 Shows the top Class 10th Scholars in the platform by academic statistics'),
  async execute(interaction: any) {
    // 1. Defer reply since querying collections takes time
    await interaction.deferReply();

    try {
      const db = getDb();
      
      // 2. Fetch the top 10 documents from the 'stats' collection ordered by correct answers
      const statsQuery = db.collection('stats')
        .orderBy('quizCorrect', 'desc')
        .limit(10);
        
      const snap = await statsQuery.get();

      if (snap.empty) {
        return await interaction.editReply({
          content: '🏆 **Scoreboard Empty:** No students have taken any quiz challenges yet. Be the first to claim the #1 spot!'
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 SCHOLAR-AI CENTRAL SCOREBOARD Toppers')
        .setDescription('Below are the top CBSE Class 10th students ranked by overall quiz corrections and academic dedication metrics.')
        .setThumbnail('https://images.unsplash.com/photo-1571260899304-425eee4c7efc?q=80&w=200&auto=format&fit=crop')
        .setColor(0xD97706); // Amber Gold

      let leaderboardText = '';
      const medals = ['👑', '🥈', '🥉', '🏅', '🏅', '🏅', '🏅', '🏅', '🏅', '🏅'];

      let index = 0;
      snap.forEach((doc: any) => {
        const d = doc.data();
        const icon = medals[index] || '▪️';
        const nick = d.nickname || 'Unknown Student';
        const correct = d.quizCorrect ?? 0;
        const total = d.totalAttempted ?? 0;
        const accuracy = d.accuracy ?? (total > 0 ? ((correct / total) * 100) : 0);
        const timeSpent = d.timeSpent ?? 10;

        leaderboardText += `${icon} **Rank ${index + 1}: ${nick}**\n   └ Score: \`${correct} correct (${total} attempted, ${Number(accuracy).toFixed(1)}%)\` | Study: \`${timeSpent}m\`\n\n`;
        index++;
      });

      embed.addFields({
        name: '👑 BOARD OF TOP PERFORMERS',
        value: leaderboardText || '*No records available.*'
      });

      embed.setFooter({ text: 'Compete in AI-quizzes to increase your score!' }).setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (err: any) {
      console.error('[Leaderboard Command Error]', err);
      await interaction.editReply({
        content: `❌ **Failed to retrieve leaderboard catalog:** Technical connection exception.\n*Diagnostics: ${err.message}*`
      });
    }
  },
};

