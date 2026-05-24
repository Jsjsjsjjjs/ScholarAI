import { safeReply, safeDefer } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDb, fetchDocSafe } from '../utils/firestore.js';

export const data = new SlashCommandBuilder()
  .setName('change_id')
  .setDescription('Link your Discord account to a specific Scholar ID or Email')
  .addStringOption(option => 
    option.setName('target_id')
      .setDescription('The Scholar ID or Email to link to')
      .setRequired(true));

export default { data, execute };

export async function execute(interaction: any) {
  try {
    await safeDefer(interaction, true);
    const targetId = interaction.options.getString('target_id', true);
    const userId = interaction.user.id;
    const db = getDb();

    // Verify if the target scholarId or email exists first
    const { data: targetData, exists, error } = await fetchDocSafe('users', targetId, 5000);

    if (error || !exists || !targetData) {
       await safeReply(interaction, {
          embeds: [
             new EmbedBuilder()
               .setTitle('❌ Account Not Found')
               .setDescription(`We could not find a Scholar AI account associated with the ID or email: \`${targetId}\`. Please check your Profile Settings on the website.`)
               .setColor(0xEF4444)
          ],
          flags: 64 // Ephemeral
       });
       return;
    }

    const actualScholarId = targetData.uid;

    // Create or update mapping in discord_links
    await db.collection("discord_links").doc(userId).set({
      scholarId: actualScholarId,
      linkedAt: new Date().toISOString(),
      discordUsername: interaction.user.username
    }, { merge: true });

    await safeReply(interaction, {
       embeds: [
          new EmbedBuilder()
            .setTitle('✅ Account Linked Successfully!')
            .setDescription(`Your Discord account is now linked to **${targetData.email || actualScholarId}**. Commands like \`/assets\`, \`/internal_gen\`, and \`/stats\` will now fetch and store data for this profile.`)
            .setColor(0x10B981)
       ],
       flags: 64
    });

  } catch (error) {
    console.error("[change_id Command] Error linking account:", error);
    await safeReply(interaction, { content: '❌ An error occurred while linking your account. Please try again.', flags: 64 });
  }
}
