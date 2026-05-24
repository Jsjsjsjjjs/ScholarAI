import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDb } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('view_library')
    .setDescription('📚 View curriculum libraries and track your ongoing CBSE topic completions'),

  async execute(interaction: any) {
    const userId = interaction.user.id;
    
    // Core ScholarAI curriculum topics
    const libraryCatalog = [
      { subject: 'Science', topic: 'Chemical Reactions and Equations', slug: 'chemical-reactions-and-equations' },
      { subject: 'Science', topic: 'Acids, Bases and Salts', slug: 'acids--bases-and-salts' },
      { subject: 'Science', topic: 'Carbon and its Compounds', slug: 'carbon-and-its-compounds' },
      { subject: 'Mathematics', topic: 'Quadratic Equations', slug: 'quadratic-equations' },
      { subject: 'Mathematics', topic: 'Introduction to Trigonometry', slug: 'introduction-to-trigonometry' },
      { subject: 'Social Science', topic: 'Nationalism in India', slug: 'nationalism-in-india' },
      { subject: 'Social Science', topic: 'Lifelines of National Economy', slug: 'lifelines-of-national-economy' }
    ];

    try {
      console.log(`[View Library] Loading library catalog for user: ${userId}`);
      const db = getDb();
      
      // Query user's progress records from subcollection
      let finishedTopics: string[] = [];
      let startedTopics: string[] = [];

      try {
        const progressSnap = await db.collection('users').doc(userId).collection('progress').get();
        if (!progressSnap.empty) {
          progressSnap.forEach((doc: any) => {
            const data = doc.data();
            const slug = doc.id;
            // Topic is finished if notes read, quiz taken, or pyqs viewed
            if (data.notesRead && data.quizTaken) {
              finishedTopics.push(slug);
            } else {
              startedTopics.push(slug);
            }
          });
        }
      } catch (dbErr: any) {
        console.warn('[View Library DB Warning] Failed to query user progress logs:', dbErr.message);
      }

      const libraryEmbed = new EmbedBuilder()
        .setTitle('📚 SCHOLAR-AI CORE CURRICULUM LIBRARY')
        .setDescription('Track your study progress directly inside Discord! Use `/internal_gen` to study any chapter.')
        .setColor(0x3B82F6) // Bright blue
        .setThumbnail('https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=300&auto=format&fit=crop');

      // Group catalog by subject
      const grouped: { [key: string]: any[] } = {};
      libraryCatalog.forEach(item => {
        if (!grouped[item.subject]) {
          grouped[item.subject] = [];
        }
        grouped[item.subject].push(item);
      });

      // Populate embed fields
      for (const [subject, items] of Object.entries(grouped)) {
        const listStr = items.map(item => {
          let statusEmoji = '⚪'; // Not started
          if (finishedTopics.includes(item.slug)) {
            statusEmoji = '🟢'; // Finished
          } else if (startedTopics.includes(item.slug) || finishedTopics.some(f => f.includes(item.slug)) || startedTopics.some(s => s.includes(item.slug))) {
            statusEmoji = '🟡'; // In progress
          }
          return `${statusEmoji} **${item.topic}**`;
        }).join('\n');

        libraryEmbed.addFields({
          name: `📘 ${subject.toUpperCase()}`,
          value: listStr || 'No curriculum materials found.',
          inline: false
        });
      }

      // Add simple legend
      libraryEmbed.addFields({
        name: '📊 PROGRESS LEGEND',
        value: '🟢 Completed both Notes & Quiz • 🟡 Started Study • ⚪ Unexplored. (*Synced with website*)'
      });

      await safeReply(interaction, {
        embeds: [libraryEmbed]
      });

    } catch (err: any) {
      console.error('[View Library Error]', err);
      await safeReply(interaction, {
        content: `❌ **Failed to load Scholar library:** Sync exception from server database.\n*Diagnostics: ${err.message}*`
      });
    }
  },
};
