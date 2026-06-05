import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDb } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tictactoe_stats')
    .setDescription('🎮 View your TicTacToe academic math-break performance and game records'),

  async execute(interaction: any) {
    const userId = interaction.user.id;
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let elo = 1200; // Starting baseline ELO
    let winRate = '0%';

    try {
      console.log(`[TicTacToe Stats] Fetching game stats for: ${userId}`);
      const db = getDb();
      const docRef = db.collection('users').doc(userId);
      const userSnap = await docRef.get();

      if (userSnap.exists) {
        const data = userSnap.data();
        wins = data.tttWins ?? 0;
        losses = data.tttLosses ?? 0;
        ties = data.tttTies ?? 0;
        elo = data.tttElo ?? 1200;
        
        const total = wins + losses + ties;
        if (total > 0) {
          winRate = ((wins / total) * 100).toFixed(1) + '%';
        }
      } else {
        winRate = '0%';
        elo = 1200;
      }
    } catch (err: any) {
      console.warn('[TicTacToe Stats Warning] database connection, reverting to seeded state:', err.message);
    }

    const totalGames = wins + losses + ties;

    const embed = new EmbedBuilder()
      .setTitle('❌ TIC-TAC-TOE CLASS 10TH RECREATIONAL STANDINGS ⭕')
      .setThumbnail('https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?q=80&w=200&auto=format&fit=crop')
      .setColor(0xE11D48) // Crimson Rose
      .setDescription('Recreational logic play triggers math concepts and refreshes the brain during long study routines. Below is your current standing in the game ranks:')
      .addFields(
        { name: '🥊 Total Matches Played', value: `\`${totalGames} matches\``, inline: true },
        { name: '⭐ Calculated Brain Rating', value: `\`${elo} ELO\``, inline: true },
        { name: '📈 Session Win Ratio', value: `\`${winRate}\``, inline: false },
        { name: '🟢 Wins', value: `\`${wins} rounds\``, inline: true },
        { name: '🔴 Losses', value: `\`${losses} rounds\``, inline: true },
        { name: '🟡 Draws', value: `\`${ties} matches\``, inline: true }
      )
      .addFields({
        name: '🖼️ RECENT BOARD DIAGNOSTICS',
        value: '```\n ❌ | ⭕ | ❌ \n---+---+---\n ⭕ | ❌ | ⭕ \n---+---+---\n ⭕ |   | ❌ \n```'
      })
      .setFooter({ text: 'Compete in TicTacToe study sessions to improve cognitive score!' });

    await safeReply(interaction, {
      embeds: [embed]
    });
  },
};
