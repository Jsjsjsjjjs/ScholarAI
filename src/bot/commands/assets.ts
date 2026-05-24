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
import { getDb, fetchDocSafe } from '../utils/firestore.js';
import { jsPDF } from 'jspdf';

export default {
  data: new SlashCommandBuilder()
    .setName('assets')
    .setDescription('📚 View and download your recent generated ScholarAI assets.'),

  async execute(interaction: any) {
    const userId = interaction.user.id;
    const db = getDb();

    // Verify User Connection (mapping discord ID to their platform UID)
    const { data: userData } = await fetchDocSafe("users", userId, 5000);
    const platformUid = userData ? (userData.uid || userId) : userId;

    let assets: any[] = [];
    try {
      // Query the Firestore database for recent specific generated contents
      // Wait, the client SDK might not support collectionGroup, so we just check user's subcollection.
      const assetsSnap = await db.collection("users").doc(platformUid).collection("assets").get();
      assetsSnap.forEach((docSnap: any) => {
        assets.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Sort recent by createdAt
      assets.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      assets = assets.slice(0, 20); // Get 20 most recent
    } catch (err) {
      console.error("[Assets Command] Failed to fetch generated contents:", err);
    }

    if (assets.length === 0) {
      return await safeReply(interaction, {
        content: '❌ **No Assets Found:** You do not have any recent generated content on ScholarAI. Generate some /internal_gen first!',
        ephemeral: true
      });
    }

    // 1. Define Select Menu options
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('scholar_assets_menu_dynamic')
      .setPlaceholder('Select a generated asset...')
      .addOptions(
        assets.map((asset, index) => {
          const typeLabel = asset.type ? asset.type.toUpperCase() : 'ASSET';
          const title = asset.title ? asset.title : `Generated ${typeLabel} #${index + 1}`;
          return new StringSelectMenuOptionBuilder()
            .setLabel(title.substring(0, 100))
            .setDescription(`Type: ${typeLabel}`.substring(0, 100))
            .setValue(asset.id)
            .setEmoji('📄');
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const initialEmbed = new EmbedBuilder()
      .setTitle('📚 YOUR SCHOLAR-AI LIBRARY')
      .setDescription('Explore your most recent generated notes, flashcards, quizzes, and important questions. Select an asset below to export it as a PDF.')
      .setColor(0x3B82F6)
      .setFooter({ text: 'Powered by ScholarAI Board Preparant' });

    // Send the menu ephemerally if possible
    const responseMessage = await interaction.reply({
      embeds: [initialEmbed],
      components: [row],
      ephemeral: true,
      fetchReply: true
    });

    if (!responseMessage) {
      console.warn('[Assets Menu] Failed to reply with ActionRow select menu.');
      return;
    }

    // 2. Setup interactive components collector
    const collector = responseMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 120000 // 2 minutes window
    });

    collector.on('collect', async (menuInteraction: any) => {
      // Ephemerally check and verify
      if (menuInteraction.user.id !== interaction.user.id) {
        return await menuInteraction.reply({
          content: '❌ You did not invoke this command. Please type `/assets` to explore yourself!',
          ephemeral: true
        });
      }

      await menuInteraction.deferUpdate(); // Acknowledge the interaction first

      const selectionId = menuInteraction.values[0];
      const selectedAsset = assets.find(a => a.id === selectionId);

      if (!selectedAsset || !selectedAsset.rawData) {
        return await menuInteraction.followUp({
          content: '❌ This asset does not contain raw data or has expired.',
          ephemeral: true
        });
      }

      try {
        // Generating PDF buffer from rawData using jsPDF (server-side capable equivalent to web platform)
        // Since we are in Node.js, html2canvas isn't available, we use jsPDF core functionality directly.
        const pdf = new jsPDF("p", "mm", "a4");
        pdf.setFontSize(16);
        pdf.text(selectedAsset.title || "ScholarAI Asset", 10, 15);
        pdf.setFontSize(11);
        
        const splitText = pdf.splitTextToSize(String(selectedAsset.rawData), 190);
        let yPos = 25;
        
        for (let i = 0; i < splitText.length; i++) {
          if (yPos > 280) {
            pdf.addPage();
            yPos = 15;
          }
          pdf.text(splitText[i], 10, yPos);
          yPos += 7;
        }

        const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));
        let pdfFilename = `${(selectedAsset.title || "asset").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.pdf`;
        const attachment = new AttachmentBuilder(pdfBuffer, { name: pdfFilename });

        await menuInteraction.followUp({
          content: `✅ Successfully exported **${selectedAsset.title || 'PDF'}**.`,
          files: [attachment],
          ephemeral: true
        });

      } catch (pdfErr: any) {
        console.error("PDF Generation failed in Discord bot:", pdfErr);
        await menuInteraction.followUp({
          content: `❌ **PDF Compilation Failed:** The raw asset data could not be parsed to PDF format. Details: ${pdfErr.message}`,
          ephemeral: true
        });
      }
    });

    collector.on('end', async () => {
      const disabledSelectMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledSelectMenu);
      try {
        await interaction.editReply({ components: [disabledRow] });
      } catch (err) {}
    });
  },
};
