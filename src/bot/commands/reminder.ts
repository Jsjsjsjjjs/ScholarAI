import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDb } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('⏰ Schedule a Class 10th study session reminder')
    .addStringOption(option =>
      option.setName('subject')
        .setDescription('Select the subject')
        .setRequired(true)
        .addChoices(
          { name: 'Science', value: 'Science' },
          { name: 'Mathematics', value: 'Mathematics' },
          { name: 'Social Science', value: 'Social Science' },
          { name: 'English', value: 'English' }
        )
    )
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('Enter the study topic (e.g. Light, AP series, History)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Hour of reminders (e.g. 18:30, 4:00 PM)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('date')
        .setDescription('Date of reminders (e.g. 2026-05-25, Tomorrow)')
        .setRequired(true)
    ),

  async execute(interaction: any) {
    const subject = interaction.options.getString('subject')!;
    const topic = interaction.options.getString('topic')!;
    const time = interaction.options.getString('time')!;
    const date = interaction.options.getString('date')!;
    const userId = interaction.user.id;

    try {
      console.log(`[Reminder Command] Setting reminder for ${userId} - Sub: ${subject}, Topic: ${topic}`);
      const db = getDb();

      // Ensure user profile documents exist in firestore collection
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        await userRef.set({
          uid: userId,
          nickname: interaction.user.username,
          discordName: interaction.user.tag,
          discordUsername: interaction.user.username,
          discordAvatar: interaction.user.displayAvatarURL(),
          joinedAt: new Date().toISOString(),
          colorMode: 'dark',
          role: 'scholar',
          aiRequests: 0,
          totalTokens: 0,
          lastAIActivity: new Date().toISOString()
        });
      }

      // Generate a distinct auto-increment or random ID for reminders
      const reminderId = 'rem_' + Math.random().toString(36).substring(2, 11);
      const reminderRef = userRef.collection('reminders').doc(reminderId);

      const reminderPayload = {
        topic: topic,
        subject: subject,
        time: time,
        date: date,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Write directly to subcollection
      await reminderRef.set(reminderPayload);

      const embed = new EmbedBuilder()
        .setTitle('⏰ COMPASS STUDY SESSION REMINDER SCHEDULED')
        .setDescription('Your study session reminder has been locked into the ScholarAI cloud scheduler and is synced to the web platform.')
        .setThumbnail('https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=200&auto=format&fit=crop')
        .setColor(0x8B5CF6) // Purple theme
        .addFields(
          { name: '📘 Subject', value: subject, inline: true },
          { name: '🎯 Topic Topic', value: topic, inline: true },
          { name: '🕒 Selected Time', value: `${date} @ ${time}`, inline: false }
        )
        .setFooter({ text: 'Daily reminders will trigger via DM channel' });

      await safeReply(interaction, {
        embeds: [embed]
      });

    } catch (err: any) {
      console.error('[Reminder Command Error]', err);
      await safeReply(interaction, {
        content: `❌ **Failed to schedule reminder:** Database sync error.\n*Diagnostics: ${err.message}*`
      });
    }
  },
};
