import { safeReply } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getDb, resolveScholarId } from '../utils/firestore.js';
import { 
  generateNotes, 
  generateFlashcards, 
  generateQuiz, 
  generatePracticeTest, 
  generateImportantQuestions 
} from '../../lib/gemini.js';
import { formatMathAndScience } from '../utils/mathFormatter.js';
import { jsPDF } from 'jspdf';

/**
 * Generates a high-fidelity PDF buffer using the jsPDF programmatic library.
 * This compiles matching A4 pages that reflect the high-fidelity sheets exported on the website.
 */
function generatePdfForAsset(subject: string, topic: string, assetType: string, contentStr: string): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 20;
  const pageHeight = 297;
  const pageWidth = 210;
  const maxLineWidth = pageWidth - (margin * 2);

  // Set Top Header Banner
  doc.setFillColor(31, 41, 55); // Gray-800 Dark
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Title & Metadata
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SCHOLAR-AI EXPORT STUDY SHEET', margin, 15);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`SUBJECT: ${subject.toUpperCase()}   |   TOPIC: ${topic.toUpperCase()}`, margin, 24);
  doc.text(`ASSET: ${assetType.toUpperCase()}   |   DATE: ${new Date().toLocaleDateString()}`, margin, 30);

  // Body Content styling
  doc.setTextColor(17, 24, 39); // Slate-900 Core Text
  let currentY = 55;
  const lineHeight = 7;

  // Split lines and paragraphs
  const paragraphs = contentStr.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      currentY += 4;
      continue;
    }

    let isHeading = false;
    let cleanParagraph = paragraph;

    // Detect markdown structures and apply corresponding text layout rules
    if (paragraph.startsWith('###')) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      cleanParagraph = paragraph.replace('###', '').trim();
      isHeading = true;
    } else if (paragraph.startsWith('##')) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      cleanParagraph = paragraph.replace('##', '').trim();
      isHeading = true;
    } else if (paragraph.startsWith('#')) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(15);
      cleanParagraph = paragraph.replace('#', '').trim();
      isHeading = true;
    } else if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      cleanParagraph = paragraph.replace(/\*\*/g, '').trim();
      isHeading = true;
    } else {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
    }

    const lines = doc.splitTextToSize(cleanParagraph, maxLineWidth);
    for (const line of lines) {
      if (currentY + lineHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin;

        // Draw page index header
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`ScholarAI Class 10th - ${subject} - ${topic}`, margin, 12);
        doc.line(margin, 14, pageWidth - margin, 14);
        currentY = 22;

        // Restore active font config
        if (isHeading) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(17, 24, 39);
        } else {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(17, 24, 39);
        }
      }

      doc.text(line, margin, currentY);
      currentY += lineHeight;
    }
    // Vertical spacing
    currentY += 2;
  }

  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

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

      // 1. Resolve central Scholar ID or linked profile for accurate syncing and ownership
      const { scholarId, userData: resolvedUserData } = await resolveScholarId(interaction.user);
      const activeScholarId = scholarId || userId;

      let contentStr = '';
      let embedTitle = '';
      let responseEmbeds: EmbedBuilder[] = [];
      let structuredData: any = null;

      if (assetType === 'notes') {
        embedTitle = `📄 CBSE CLASS 10TH ${subject.toUpperCase()} NOTES: ${topic.toUpperCase()}`;
        contentStr = await generateNotes(subject, topic, 'one-page');
        structuredData = null;
      } else if (assetType === 'flashcards') {
        embedTitle = `⚡ SCHOLAR-AI FLASHCARDS: ${topic.toUpperCase()}`;
        const cards = await generateFlashcards(subject, topic, null);
        contentStr = cards && cards.length > 0 
          ? cards.map((c: any, index: number) => `**Card ${index + 1}** [${c.category}]\n**Q:** ${c.front}\n**A:** ${c.back}\n`).join('\n')
          : 'No flashcards could be parsed.';
        structuredData = cards;
      } else if (assetType === 'quiz') {
        embedTitle = `📝 PRACTICE MCQS: ${topic.toUpperCase()} (${subject})`;
        const quizItems = await generateQuiz(subject, topic, 3, 'Medium');
        contentStr = quizItems && quizItems.length > 0
          ? quizItems.map((q: any, i: number) => `**Q${i+1}:** ${q.question}\nOptions:\n${q.options.map((opt: string, idx: number) => ` ${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}\n*Correct Answer: ${q.correctAnswer}*\n*Solution:* ${q.explanation}\n`).join('\n')
          : 'No quiz items could be parsed.';
        structuredData = quizItems;
      } else if (assetType === 'practice_test') {
        embedTitle = `🏆 PRE-BOARD REVISION CHAPTER EXAM: ${topic.toUpperCase()}`;
        const practice = await generatePracticeTest(subject, topic, null);
        contentStr = practice && practice.length > 0
          ? practice.map((p: any) => `**Question ${p.id}** [${p.type.toUpperCase()}]\n**Q:** ${p.questionText}\n${p.options ? `Options:\n${p.options.map((opt: string, idx: number) => ` ${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}` : ''}\n*Answers scoring criteria:* ${p.correctOption}\n*Detailed evaluation instructions:* ${p.detailedSolution}\n`).join('\n')
          : 'No board-exam practice questions generated.';
        structuredData = practice;
      } else {
        embedTitle = `💥 PYQS & IMPORTANT SCHOLAR QUESTIONS: ${topic.toUpperCase()}`;
        contentStr = await generateImportantQuestions(subject, topic, 3);
        structuredData = null;
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
        const userRef = db.collection('users').doc(activeScholarId);
        
        // Ensure user exists, if not construct basic profile
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          await userRef.set({
            uid: activeScholarId,
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

        // Update central offline sync subcollection so the browser UI automatically syncs the generated asset!
        const syncDocId = `${assetType}:${subject.toLowerCase()}:${topicSlug}`;
        const syncRef = userRef.collection('offline_sync').doc(syncDocId);
        await syncRef.set({
          subject: subject,
          topic: topic,
          type: assetType,
          content: contentStr,
          questions: assetType === 'quiz' || assetType === 'practice_test' ? structuredData : null,
          flashcards: assetType === 'flashcards' ? structuredData : null,
          items: structuredData,
          timestamp: Date.now()
        });

        console.log(`[Firestore DB Sync] User progress log & offline sync for ${topic} completed successfully.`);
      } catch (dbErr: any) {
        console.error('[Internal Gen DB Error] Firestore connection/write warning:', dbErr.message);
      }

      // 5. Compile programmatic high-fidelity A4 PDF attachment using the exact same library (jsPDF)
      const pdfBuffer = generatePdfForAsset(subject, topic, assetType, contentStr);
      const sanitizedTopic = topic.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const filename = `${sanitizedTopic}_${assetType}.pdf`;
      const attachment = new AttachmentBuilder(pdfBuffer, { name: filename });

      // Reply with generated elements and accompanying PDF attachment
      await safeReply(interaction, {
        embeds: responseEmbeds.slice(0, 5),
        files: [attachment]
      });

    } catch (err: any) {
      console.error('[Internal Gen Error] Complete stack:', err);
      await safeReply(interaction, {
        content: `❌ **Failed to generate CBSE learning resources:** AI/database transportation layer error occurred.\n*Diagnostics: ${err.message}*`
      });
    }
  },
};
