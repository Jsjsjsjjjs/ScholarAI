import { safeReply, safeDefer } from '../utils/responses.js';
import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getDb, fetchDocSafe } from '../utils/firestore.js';

export default {
  data: new SlashCommandBuilder()
    .setName('internal_gen')
    .setDescription('⚡ Fetch previously generated Class 10th CBSE educational assets from your profile')
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

    // Immediately defer the reply to prevent Discord interaction timing out (3 second gateway limit)
    await safeDefer(interaction, false);

    try {
      console.log(`[Internal Gen] Requested fetch for: ${assetType} by User: ${userId}`);

      const db = getDb();
      const { data: matchedUser, exists: userExists } = await fetchDocSafe('users', userId, 5000);
      const actualUid = matchedUser ? (matchedUser.uid || matchedUser.id || userId) : userId;

      if (!userExists) {
         return await safeReply(interaction, { content: '❌ Platform Profile not found. Please link your account or generate content first.' });
      }

      const assetsSnap = await db.collection('users').doc(actualUid).collection('assets')
                                 .where('type', '==', assetType)
                                 .orderBy('createdAt', 'desc')
                                 .limit(10)
                                 .get();

      let targetAsset = null;
      if (!assetsSnap.empty) {
         // Attempt topic match if topic provided, otherwise grab latest.
         for (const doc of assetsSnap.docs) {
            const data = doc.data();
            if (data.title && data.title.toLowerCase().includes(topic.toLowerCase())) {
                targetAsset = data;
                break;
            }
         }
         if (!targetAsset) targetAsset = assetsSnap.docs[0].data();
      }

      if (!targetAsset || !targetAsset.rawData) {
        return await safeReply(interaction, {
          content: `❌ Could not find previously generated content for type **${assetType.toUpperCase()}**. Please generate it on the ScholarAI platform first.`
        });
      }

      let contentStr = targetAsset.rawData;
      let embedTitle = targetAsset.title || `ScholarAI Document: ${topic}`;

      // 3. Format text length for the PDF Generation
      const formattedLaTex = contentStr.replace(/\\\[|\\\]|\\\(|\\\)/g, '$'); // uniform LaTeX
      
      const { generateTextPdf } = await import('../utils/pdfGenerator.js');
      const pdfBuffer = await generateTextPdf(embedTitle, formattedLaTex);
      const filename = `${assetType}_${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
      const files = [new AttachmentBuilder(pdfBuffer, { name: filename })];
      
      const responseEmbeds = [
          new EmbedBuilder()
            .setTitle(`✅ Generated PDF: ${embedTitle}`)
            .setColor(0x34D399)
            .setDescription(`Your requested document has been fetched from your profile and compiled into a PDF.`)
            .setFooter({ text: `ScholarAI CBSE Dashboard • Profile: ${matchedUser.email || actualUid}` })
      ];

      // Reply with generated elements
      await safeReply(interaction, {
        embeds: responseEmbeds,
        files: files
      });

    } catch (err: any) {
      console.error('[Internal Gen Error] Complete stack:', err);
      await safeReply(interaction, {
        content: `❌ **Failed to generate CBSE learning resources:** AI/database transportation layer error occurred.\n*Diagnostics: ${err.message}*`
      });
    }
  },
};
