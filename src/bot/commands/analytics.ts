import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { fetchDocSafe, getDb } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('📊 [Admin Only] View aggregated platform usage statistics and telemetry'),

  async execute(interaction: any) {
    const userId = interaction.user.id;

    try {
      // 1. Check Authorization
      console.log(`[Analytics] Verifying permissions for user: ${userId}`);
      const { data: userData } = await fetchDocSafe('users', userId, 5000);
      const role = userData?.role || 'user';

      if (role !== 'owner' && role !== 'admin') {
        const denyEmbed = new EmbedBuilder()
          .setTitle('🚨 ACCESS DENIED')
          .setColor(0xEF4444) // Red
          .setDescription(`❌ **Permission Insufficient.** The \`/analytics\` command is restricted to Owner & Administrative roles.\n\n*Your current registered role is:* \`${role.toUpperCase()}\``);
          
        return await safeReply(interaction, {
          embeds: [denyEmbed],
          ephemeral: true
        });
      }

      // 2. Fetch platform collections telemetry
      const db = getDb();
      const usersCol = await db.collection('users').get();
      const statsCol = await db.collection('stats').get();

      let totalUsersCount = usersCol.size;
      let cumulativeAIRequests = 0;
      let totalTokensConsumed = 0;
      let roleBreaks = { owner: 0, admin: 0, scholar: 0, user: 0 };
      let elitePlans = 0;

      usersCol.forEach((doc: any) => {
        const u = doc.data();
        cumulativeAIRequests += u.aiRequests || 0;
        totalTokensConsumed += u.totalTokens || 0;
        
        const r = (u.role || 'user').toLowerCase();
        if (r in roleBreaks) {
          roleBreaks[r as keyof typeof roleBreaks]++;
        } else {
          roleBreaks.user++;
        }

        if (u.plan === 'elite' || u.plan === 'admin') {
          elitePlans++;
        }
      });

      const analyticsEmbed = new EmbedBuilder()
        .setTitle('📊 SCHOLAR-AI REAL-TIME TELEMETRY')
        .setDescription('Below is a consolidated summary of system load, user indices, and AI models telemetry metrics.')
        .setColor(0xF59E0B) // Bright yellow/amber
        .setThumbnail('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=200&auto=format&fit=crop')
        .addFields(
          { name: '👥 Total Registered Scholars', value: `\`${totalUsersCount} students\``, inline: true },
          { name: '💎 Subscribed Premium Plans', value: `\`${elitePlans} accounts\``, inline: true },
          { name: '⚙️ Role Classifications', value: `\`Owners: ${roleBreaks.owner} | Admins: ${roleBreaks.admin} | Scholars: ${roleBreaks.scholar + roleBreaks.user}\``, inline: false },
          { name: '🤖 Cumulative AI Queries', value: `\`${cumulativeAIRequests} calls\``, inline: true },
          { name: '💸 Overall Token Consumption', value: `\`${totalTokensConsumed} tokens\``, inline: true }
        )
        .addFields({
          name: '📡 SERVER INFRASTRUCTURE TELEMETRY',
          value: '```yaml\nHost Platform: "Cloud Run Container Sandbox"\nAPI Core: "Gemini-3.5-flash Production Interface"\nPrimary Port: "3000 Ingress Multiplex"\nRules State: "Relaxed Developer Access"\n```'
        })
        .setFooter({ text: 'Administrative Logs • Confidential Systems Data' })
        .setTimestamp();

      await safeReply(interaction, {
        embeds: [analyticsEmbed]
      });

    } catch (err: any) {
      console.error('[Analytics Command Error]', err);
      await safeReply(interaction, {
        content: `❌ **Failed to compile telemetry analytics:** Data linking failed.\n*Diagnostics: ${err.message}*`
      });
    }
  },
};
