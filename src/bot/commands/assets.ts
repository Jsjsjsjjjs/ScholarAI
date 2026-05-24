import { safeReply } from '../utils/responses.js';
import { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  EmbedBuilder, 
  ComponentType, 
  AttachmentBuilder 
} from 'discord.js';
import { getDb } from '../utils/firestore.js';
import { 
  generateNotes, 
  generateFlashcards, 
  generateQuiz, 
  generatePracticeTest, 
  generateImportantQuestions 
} from '../../lib/gemini.js';
import { jsPDF } from 'jspdf';

/**
 * Generates a high-fidelity PDF buffer using the jsPDF programmatic library.
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
    .setName('assets')
    .setDescription('📚 View and download curated CBSE Class 10 assets via an interactive dropdown'),

  async execute(interaction: any) {
    const userId = interaction.user.id;
    const db = getDb();

    // Core catalog fallback
    const defaultCatalog = [
      { subject: 'Science', topic: 'Chemical Reactions and Equations', slug: 'chemical-reactions-and-equations' },
      { subject: 'Science', topic: 'Acids, Bases and Salts', slug: 'acids--bases-and-salts' },
      { subject: 'Science', topic: 'Carbon and its Compounds', slug: 'carbon-and-its-compounds' },
      { subject: 'Mathematics', topic: 'Quadratic Equations', slug: 'quadratic-equations' },
      { subject: 'Mathematics', topic: 'Introduction to Trigonometry', slug: 'introduction-to-trigonometry' },
      { subject: 'Social Science', topic: 'Nationalism in India', slug: 'nationalism-in-india' },
      { subject: 'English', topic: 'Formal Writing', slug: 'formal-writing' }
    ];

    let progressList: any[] = [];

    try {
      // 1. Fetch current user progress highlights
      const userProgressSnap = await db.collection('users').doc(userId).collection('progress')
        .orderBy('lastActivity', 'desc')
        .limit(10)
        .get();

      userProgressSnap.forEach((doc: any) => {
        const data = doc.data();
        progressList.push({
          id: doc.id,
          subject: data.subject || 'Science',
          topic: data.topic || doc.id,
          notesRead: !!data.notesRead,
          quizTaken: !!data.quizTaken,
          pyqsViewed: !!data.pyqsViewed,
          lastActivity: data.lastActivity,
          creator: 'You',
          creatorId: userId
        });
      });

      // 2. Supplement from global community activities if the current user has few assets
      if (progressList.length < 10) {
        const usersSnap = await db.collection('users').limit(5).get();
        for (const userDoc of usersSnap.docs) {
          if (userDoc.id === userId) continue;
          const uData = userDoc.data();
          const pSnap = await db.collection('users').doc(userDoc.id).collection('progress')
            .orderBy('lastActivity', 'desc')
            .limit(3)
            .get();

          pSnap.forEach((pDoc: any) => {
            const pData = pDoc.data();
            if (!progressList.some(p => p.id === pDoc.id && p.creatorId === userDoc.id)) {
              progressList.push({
                id: pDoc.id,
                subject: pData.subject || 'Science',
                topic: pData.topic || pDoc.id,
                notesRead: !!pData.notesRead,
                quizTaken: !!pData.quizTaken,
                pyqsViewed: !!pData.pyqsViewed,
                lastActivity: pData.lastActivity,
                creator: uData.nickname || uData.discordUsername || 'Other Scholar',
                creatorId: userDoc.id
              });
            }
          });
        }
      }
    } catch (dbErr: any) {
      console.warn('[Assets Command] Progress load exception. Defaulting to curated core list.', dbErr.message);
    }

    // 3. Fallback to Catalog defaults if still empty
    if (progressList.length === 0) {
      defaultCatalog.forEach(item => {
        progressList.push({
          id: item.slug,
          subject: item.subject,
          topic: item.topic,
          notesRead: true,
          quizTaken: true,
          pyqsViewed: true,
          lastActivity: new Date().toISOString(),
          creator: 'Lead Educator',
          creatorId: 'system'
        });
      });
    }

    // 4. Transform collection documents into elegant selects options
    const rawOptions: any[] = [];
    for (const item of progressList) {
      const formattedDate = item.lastActivity 
        ? new Date(item.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Recently';

      if (item.notesRead && rawOptions.length < 25) {
        rawOptions.push({
          label: `${item.topic.substring(0, 50)} Study Notes`,
          description: `By: ${item.creator} | Updated: ${formattedDate} | Type: Notes`,
          value: `asset:${item.creatorId}:${item.subject}:${item.id}:notes`,
          emoji: '📄'
        });
      }
      if (item.quizTaken && rawOptions.length < 25) {
        rawOptions.push({
          label: `${item.topic.substring(0, 50)} CBSE Quiz`,
          description: `By: ${item.creator} | Updated: ${formattedDate} | Type: MCQ Practice`,
          value: `asset:${item.creatorId}:${item.subject}:${item.id}:quiz`,
          emoji: '🧠'
        });
      }
      if (item.pyqsViewed && rawOptions.length < 25) {
        rawOptions.push({
          label: `${item.topic.substring(0, 50)} PYQs`,
          description: `By: ${item.creator} | Updated: ${formattedDate} | Type: High-Yield PYQ`,
          value: `asset:${item.creatorId}:${item.subject}:${item.id}:pyqs`,
          emoji: '💥'
        });
      }
    }

    // Deduplicate options
    const selectOptions: any[] = [];
    const seenValues = new Set<string>();
    for (const opt of rawOptions) {
      if (!seenValues.has(opt.value)) {
        seenValues.add(opt.value);
        selectOptions.push(opt);
      }
    }

    // Slice options to maximum limit of 25 (Discord Select Menu limit)
    const finalOptions = selectOptions.slice(0, 25);

    // If options are empty for any reason, add a fallback standard selector option
    if (finalOptions.length === 0) {
      finalOptions.push({
        label: 'Chemical Reactions Study Notes',
        description: 'Standard textbook chemical formulas & reactions notes',
        value: 'asset:system:Science:chemical-reactions-and-equations:notes',
        emoji: '📄'
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('scholar_assets_menu')
      .setPlaceholder('Select a Curated Study Asset...')
      .addOptions(
        finalOptions.map(opt =>
          new StringSelectMenuOptionBuilder()
            .setLabel(opt.label)
            .setDescription(opt.description)
            .setValue(opt.value)
            .setEmoji(opt.emoji)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const initialEmbed = new EmbedBuilder()
      .setTitle('📚 DYNAMIC SCHOLAR-AI EXPORT TERMINAL')
      .setDescription('Fetch high-fidelity Class 10th CBSE educational guides, expert mind maps, formulas, and mock questions. Expand the select menu below to instantly sync & generate high-definition printable study PDFs.')
      .setColor(0x3B82F6) // Active blue
      .addFields(
        { name: '📥 Automatic Syncing', value: 'Instantly syncs notes/quizzes generated on the website and retrieves them in Discord.' },
        { name: '✏️ Interactive Generation', value: 'Choose any asset to compile its content live using the integrated Gemini API.' },
        { name: '🖨️ High-Fidelity PDFs', value: 'Programmatically generates matching A4 PDF boards ready to print.' }
      )
      .setThumbnail('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=260&auto=format&fit=crop')
      .setFooter({ text: 'Powered by ScholarAI Board Preparant' });

    const responseMessage = await safeReply(interaction, {
      embeds: [initialEmbed],
      components: [row]
    });

    if (!responseMessage) {
      console.warn('[Assets Menu] Failed to reply with ActionRow select menu.');
      return;
    }

    const collector = (responseMessage as any).createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 120000 // Active for 2 minutes
    });

    collector.on('collect', async (menuInteraction: any) => {
      if (menuInteraction.user.id !== userId) {
        return await menuInteraction.reply({
          content: '❌ You did not invoke this command. Please type `/assets` to explore yourself!',
          ephemeral: true
        });
      }

      const selection = menuInteraction.values[0];
      const parts = selection.split(':');
      if (parts[0] !== 'asset') return;

      const [_, creatorId, subject, topicSlug, assetType] = parts;

      // 1. Defer the interaction update to avoid timeouts while generating
      await menuInteraction.deferUpdate();

      // Find original option label to display and get a descriptive topic name
      const matchingOption = finalOptions.find(o => o.value === selection);
      let topic = topicSlug.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      if (matchingOption) {
        // Strip out trailing types to get clean name
        topic = matchingOption.label.replace(' Study Notes', '').replace(' CBSE Quiz', '').replace(' PYQs', '');
      }

      // Display dynamic generation state
      const loadingEmbed = new EmbedBuilder()
        .setTitle(`⏳ SYNCHRONIZING PORTAL ASSET...`)
        .setDescription(`**Topic:** ${topic.toUpperCase()} (${subject})\n**Asset Style:** ${assetType.toUpperCase()}\n\nContacting the central AI Engine to fetch educational data. Drawing customized, high-fidelity PDF margins and layout templates... Please stand by.`)
        .setColor(0xF59E0B);

      await menuInteraction.editReply({
        embeds: [loadingEmbed],
        components: [row]
      });

      try {
        let contentStr = '';

        // 2. Fetch raw educational contents automatically matched from Gemini SDK
        if (assetType === 'notes') {
          contentStr = await generateNotes(subject, topic, 'one-page');
        } else if (assetType === 'quiz') {
          const quizItems = await generateQuiz(subject, topic, 4, 'Medium');
          contentStr = quizItems && quizItems.length > 0
            ? quizItems.map((q: any, i: number) => `**Question ${i+1}:** ${q.question}\nOptions:\n${q.options.map((opt: string, idx: number) => `  ${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}\n*Correct Answer: ${q.correctAnswer}*\n*Solution Explanation:* ${q.explanation}\n`).join('\n')
            : 'Unresolved MCQ study block.';
        } else if (assetType === 'pyqs') {
          contentStr = await generateImportantQuestions(subject, topic, 4);
        } else {
          contentStr = await generateNotes(subject, topic, 'one-page');
        }

        // 3. Compile Programmatic PDF Buffer using the exact same library (jsPDF)
        const pdfBuffer = generatePdfForAsset(subject, topic, assetType, contentStr);

        const sanitizedTopic = topicSlug.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const filename = `${sanitizedTopic}_${assetType}.pdf`;
        const attachment = new AttachmentBuilder(pdfBuffer, { name: filename });

        const successEmbed = new EmbedBuilder()
          .setTitle(`🎓 SPECIALIZED ASSET SYNCED`)
          .setDescription(`Your professional education study deck has been compiled flawlessly! Standard-designed print outlines have been drawn and delivered below.`)
          .setColor(0x10B981) // High-polish Emerald
          .addFields(
            { name: '📘 Topic', value: topic, inline: true },
            { name: '🧪 Subject', value: subject, inline: true },
            { name: '📑 Type', value: assetType.toUpperCase(), inline: true }
          )
          .setThumbnail('https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=260&auto=format&fit=crop')
          .setFooter({ text: 'ScholarAI Educational Sync Unit' })
          .setTimestamp();

        await menuInteraction.editReply({
          embeds: [successEmbed],
          files: [attachment],
          components: [row]
        });

      } catch (err: any) {
        console.error('[Assets Selection Error]', err);
        const errorEmbed = new EmbedBuilder()
          .setTitle(`❌ ASSET TRANSIT FAILURE`)
          .setDescription(`An error was encountered during the programmatic PDF build and transmission pipeline:\n\`\`\`ts\n${err.message || String(err)}\n\`\`\``)
          .setColor(0xEF4444);

        await menuInteraction.editReply({
          embeds: [errorEmbed],
          components: [row]
        });
      }
    });

    collector.on('end', async () => {
      // Safely disable select dropdown component on idle timeout
      try {
        const disabledSelectMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledSelectMenu);
        await (responseMessage as any).edit({
          components: [disabledRow]
        });
      } catch (e) {
        // Suppress update fails if message/channel was cleared
      }
    });
  }
};
