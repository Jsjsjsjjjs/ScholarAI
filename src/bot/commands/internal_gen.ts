import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDb } from '../utils/firestore.js';
import { 
  generateNotes, 
  generateFlashcards, 
  generateQuiz, 
  generatePracticeTest, 
  generateImportantQuestions 
} from '../../lib/gemini.js';
import { formatMathAndScience } from '../utils/mathFormatter.js';

export default {
  data: new SlashCommandBuilder()
    .setName('internal_gen')
    .setDescription('⚡ Generate professional Class 10th CBSE educational assets instantly using Gemini')
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
        .setDescription('Type the topic name (e.g. Chemical Reactions, Acids Bases, Trigonometry)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('asset_type')
        .setDescription('Type of asset to generate')
        .setRequired(true)
        .addChoices(
          { name: 'Study Notes', value: 'notes' },
          { name: 'Flashcards (JSON Key)', value: 'flashcards' },
          { name: 'Interactive Quiz (MCQ)', value: 'quiz' },
          { name: 'Board Prep Test (Practice)', value: 'practice_test' },
          { name: 'High-Yield PYQs/Important Questions', value: 'pyqs' }
        )
    ),

  async execute(interaction: any) {
    const subject = interaction.options.getString('subject')!;
    const topic = interaction.options.getString('topic')!;
    const assetType = interaction.options.getString('asset_type')!;
    const userId = interaction.user.id;

    try {
      console.log(`[Internal Gen] Requested: ${assetType} for Subject: ${subject}, Topic: ${topic} by User: ${userId}`);

      let contentStr = '';
      let embedTitle = '';
      let responseEmbeds: EmbedBuilder[] = [];

      if (assetType === 'notes') {
        embedTitle = `📄 CBSE CLASS 10TH ${subject.toUpperCase()} NOTES: ${topic.toUpperCase()}`;
        contentStr = await generateNotes(subject, topic, 'one-page');
      } else if (assetType === 'flashcards') {
        embedTitle = `⚡ SCHOLAR-AI FLASHCARDS: ${topic.toUpperCase()}`;
        const cards = await generateFlashcards(subject, topic, null);
        contentStr = cards && cards.length > 0 
          ? cards.map((c: any, index: number) => `**Card ${index + 1}** [${c.category}]\n**Q:** ${c.front}\n**A:** ${c.back}\n`).join('\n')
          : 'No flashcards could be parsed.';
      } else if (assetType === 'quiz') {
        embedTitle = `📝 PRACTICE MCQS: ${topic.toUpperCase()} (${subject})`;
        const quizItems = await generateQuiz(subject, topic, 3, 'Medium');
        contentStr = quizItems && quizItems.length > 0
          ? quizItems.map((q: any, i: number) => `**Q${i+1}:** ${q.question}\nOptions:\n${q.options.map((opt: string, idx: number) => ` ${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}\n*Correct Answer: ${q.correctAnswer}*\n*Solution:* ${q.explanation}\n`).join('\n')
          : 'No quiz items could be parsed.';
      } else if (assetType === 'practice_test') {
        embedTitle = `🏆 PRE-BOARD REVISION CHAPTER EXAM: ${topic.toUpperCase()}`;
        const practice = await generatePracticeTest(subject, topic, null);
        contentStr = practice && practice.length > 0
          ? practice.map((p: any) => `**Question ${p.id}** [${p.type.toUpperCase()}]\n**Q:** ${p.questionText}\n${p.options ? `Options:\n${p.options.map((opt: string, idx: number) => ` ${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}` : ''}\n*Answers scoring criteria:* ${p.correctOption}\n*Detailed evaluation instructions:* ${p.detailedSolution}\n`).join('\n')
          : 'No board-exam practice questions generated.';
      } else {
        embedTitle = `💥 PYQS & IMPORTANT SCHOLAR QUESTIONS: ${topic.toUpperCase()}`;
        contentStr = await generateImportantQuestions(subject, topic, 3);
      }

      // 3. Split content to embeds safely (Discord limit: 4096 characters per embed)
      const formattedLaTex = formatMathAndScience(contentStr);
      const paragraphs = formattedLaTex.split('\n');
      let currentDesc = '';

      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        if ((currentDesc.length + p.length + 2) < 3800) {
          currentDesc += p + '\n';
        } else {
          responseEmbeds.push(
            new EmbedBuilder()
              .setTitle(responseEmbeds.length === 0 ? embedTitle : `${embedTitle} (Continued)`)
              .setColor(0x34D399) // Clean Emerald color
              .setDescription(currentDesc || 'Generating educational logs...')
          );
          currentDesc = p + '\n';
        }
      }

      if (currentDesc) {
        responseEmbeds.push(
          new EmbedBuilder()
            .setTitle(responseEmbeds.length === 0 ? embedTitle : `${embedTitle} (Continued)`)
            .setColor(0x34D399)
            .setDescription(currentDesc)
            .setFooter({ text: `ScholarAI CBSE Dashboard • Requested by ${interaction.user.username}` })
        );
      }

      // 4. Save progress update to database as requested to keep Bot & Platform connected
      try {
        const db = getDb();
        const userRef = db.collection('users').doc(userId);
        
        // Ensure user exists, if not construct basic profile
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
            aiRequests: 1,
            totalTokens: 1500,
            lastAIActivity: new Date().toISOString()
          });
        } else {
          await userRef.update({
            aiRequests: (userSnap.data().aiRequests || 0) + 1,
            lastAIActivity: new Date().toISOString()
          });
        }

        // Save progress topic trace
        const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const progressRef = userRef.collection('progress').doc(topicSlug);
        await progressRef.set({
          subject: subject,
          topic: topic,
          notesRead: assetType === 'notes',
          quizTaken: assetType === 'quiz',
          pyqsViewed: assetType === 'pyqs',
          lastActivity: new Date().toISOString()
        }, { merge: true });

        console.log(`[Firestore DB Sync] User progress log for ${topic} synchronized flawlessly.`);
      } catch (dbErr: any) {
        console.error('[Internal Gen DB Error] Firestore connection/write warning:', dbErr.message);
      }

      // Reply with generated elements
      await safeReply(interaction, {
        embeds: responseEmbeds.slice(0, 5)
      });

    } catch (err: any) {
      console.error('[Internal Gen Error] Complete stack:', err);
      await safeReply(interaction, {
        content: `❌ **Failed to generate CBSE learning resources:** AI/database transportation layer error occurred.\n*Diagnostics: ${err.message}*`
      });
    }
  },
};
