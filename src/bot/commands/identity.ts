import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDb } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('identity')
    .setDescription('🎫 View details of your Scholar identity, role, and system diagnostics'),

  async execute(interaction: any) {
    const userId = interaction.user.id;
    let userRole = 'scholar (standard)';
    let totalAIRequests = 0;
    let joinedTime = 'Not synchronized';

    try {
      console.log(`[Identity Command] Querying identity details for user: ${userId}`);
      const db = getDb();
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const data = userDoc.data();
        userRole = data.role ? `${data.role.toUpperCase()}` : 'SCHOLAR';
        totalAIRequests = data.aiRequests || 0;
        joinedTime = data.joinedAt ? new Date(data.joinedAt).toLocaleDateString() : 'Active';
      }
    } catch (err: any) {
      console.warn('[Identity Warning] Firestore reader bypassed on error:', err.message);
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 SCHOLAR-AI INDIVIDUAL PASS IDENTIFICATION')
      .setThumbnail(interaction.user.displayAvatarURL())
      .setColor(0x3B82F6) // Accent blue
      .setDescription('```ini\n[USER VERIFICATION PASSPORT]\n```')
      .addFields(
        { name: '👤 Username Handle', value: `\`${interaction.user.tag}\``, inline: true },
        { name: '🆔 Global Client Identifier', value: `\`${userId}\``, inline: true },
        { name: '🏅 Academic Authority Role', value: `\`${userRole}\``, inline: false },
        { name: '🧠 Accumulated AI Queries', value: `\`${totalAIRequests} requests\``, inline: true },
        { name: '📅 Enrollment Registry', value: `\`${joinedTime}\``, inline: true }
      )
      .addFields({
        name: '⚙️ SCHOLAR-AI EMPOWERMENT SPECIFICATIONS',
        value: '```yaml\nEngine: "discord.js v14.x"\nAI Integration: "Google Gemini 3.5 Flash Model (Direct)"\nSync Adapter: "Cloud Firestore Core Database"\nLatency: "Fully Active Link ⚡"\n```'
      })
      .setFooter({ text: 'Passport system issued by ScholarAI Central Registrar Office' });

    await safeReply(interaction, {
      embeds: [embed]
    });
  },
};
