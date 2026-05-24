import { safeReply } from '../utils/responses.js';
import { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  EmbedBuilder, 
  ComponentType 
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('assets')
    .setDescription('📚 View and download curated CBSE Class 10 assets via an interactive dropdown'),

  async execute(interaction: any) {
    // 1. Define Select Menu options
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('scholar_assets_menu')
      .setPlaceholder('Select a Study Asset Category...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Atomic Science Formula List')
          .setDescription('Chemical reactions, acids, bases and metals formulations')
          .setValue('science_formulas')
          .setEmoji('🧪'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Trigonometry & Apex Maths Sheets')
          .setDescription('Formulas, quadratic identities, and trigonometric cheat codes')
          .setValue('maths')
          .setEmoji('📐'),
        new StringSelectMenuOptionBuilder()
          .setLabel('CBSE History & Geography Maps')
          .setDescription('Nationalism timeline, resource locations, and geo map markers')
          .setValue('sst')
          .setEmoji('🌍'),
        new StringSelectMenuOptionBuilder()
          .setLabel('English Grammar & Lit Guide')
          .setDescription('Tenses, modal systems, writing layouts, and high-yield questions')
          .setValue('english')
          .setEmoji('📝')
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    const initialEmbed = new EmbedBuilder()
      .setTitle('📖 CURATED CLASS 10TH BOARD EXAM ASSETS')
      .setDescription('Explore custom cheat sheets, formula boards, and expert timelines created by top educators. Please expand the dropdown selection menu below to choose your asset:')
      .setColor(0x3B82F6) // Bright blue
      .addFields(
        { name: '🧪 Science Formulas', value: 'Complete reactions & structures.', inline: true },
        { name: '📐 Math Equations', value: 'High scoring geometry & trigonometry guides.', inline: true },
        { name: '🌍 Social Studies', value: 'Map indicators & history summaries.', inline: true }
      )
      .setFooter({ text: 'Powered by ScholarAI Board Preparant' });

    // Send the menu
    const responseMessage = await safeReply(interaction, {
      embeds: [initialEmbed],
      components: [row]
    });

    if (!responseMessage) {
      console.warn('[Assets Menu] Failed to reply with ActionRow select menu.');
      return;
    }

    // 2. Setup interactive components collector
    const collector = (responseMessage as any).createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000 // 1 minute active window
    });

    collector.on('collect', async (menuInteraction: any) => {
      // Ephemerally check and verify that only the trigger user compiles the selects
      if (menuInteraction.user.id !== interaction.user.id) {
        return await menuInteraction.reply({
          content: '❌ You did not invoke this command. Please type `/assets` to explore yourself!',
          ephemeral: true
        });
      }

      const selection = menuInteraction.values[0];
      let selectedEmbed = new EmbedBuilder();

      if (selection === 'science_formulas') {
        selectedEmbed
          .setTitle('🧪 CHEMISTRY & PHYSICS FORMULAS CHEAT SHEET')
          .setColor(0x06B6D4) // Cyan
          .setDescription('Complete summaries for board exam prep:')
          .addFields(
            { name: '1. Neutralization Process', value: '$\\text{Acid} + \\text{Base} \\rightarrow \\text{Salt} + \\text{Water}$' },
            { name: '2. Electricity Equations', value: '$\\text{Ohm\'s Law: } V = IR$\n$\\text{Joule\'s Heating: } H = I^2Rt$' },
            { name: '3. Light Mirror Formula', value: '$\\frac{1}{f} = \\frac{1}{v} + \\frac{1}{u}$ \n$\\text{Magnification: } m = -\\frac{v}{u}$' }
          )
          .setFooter({ text: 'Download complete PDF at ScholarAI web interface.' });
      } else if (selection === 'maths') {
        selectedEmbed
          .setTitle('📐 MATHEMATICS FORMULA BOARD')
          .setColor(0xF59E0B) // Amber
          .setDescription('Top-score trigonometry & equation sheets:')
          .addFields(
            { name: '1. Trigonometric Identities', value: '$\\sin^2\\theta + \\cos^2\\theta = 1$\n$\\sec^2\\theta - \\tan^2\\theta = 1$' },
            { name: '2. Quadratic Formula', value: 'For $ax^2 + bx + c = 0$, values of $x$ are:\n$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$' },
            { name: '3. Arithmetic Progression', value: '$\\text{n-th term: } a_n = a + (n-1)d$\n$\\text{Sum of terms: } S_n = \\frac{n}{2}[2a + (n-1)d]$' }
          )
          .setFooter({ text: 'Online practice and solutions synced via Firestore.' });
      } else if (selection === 'sst') {
        selectedEmbed
          .setTitle('🌍 CLASS 10 SOCIAL SCIENCE RESOURCE COMPASS')
          .setColor(0x10B981) // Emerald
          .setDescription('Crucial Map guides and History lists:')
          .addFields(
            { name: '1. History Nationalism in India', value: '• **1920 Jan:** Non-Cooperation movement\n• **1930:** Salt March starting point (Dandi)' },
            { name: '2. Geography Iron Ore Deposits', value: '• Mayurbhanj (Odisha)\n• Durg (Chhattisgarh)\n• Kudremukh (Karnataka)' },
            { name: '3. Major Dams of India', value: '• Salal (Chenab)\n• Bhakra Nangal (Sutlej)\n• Hirakud (Mahanadi)' }
          )
          .setFooter({ text: 'SST Flashcards available inside the main Scholar Dashboard.' });
      } else {
        selectedEmbed
          .setTitle('📝 ENGLISH GRAMMAR & WRITING TOOLKIT')
          .setColor(0x8B5CF6) // Purple
          .setDescription('Writing structures and key literature questions:')
          .addFields(
            { name: '1. Formal Letter Layout', value: 'Sender\'s Address $\\rightarrow$ Date $\\rightarrow$ Receiver\'s Designation $\\rightarrow$ Subject $\\rightarrow$ Salutation $\\rightarrow$ Body $\\rightarrow$ Complimentary Close.' },
            { name: '2. Modal Helper Uses', value: '• **Must:** High obligation / rules\n• **Should:** Recommendation\n• **May:** Formal permission' }
          )
          .setFooter({ text: 'English chapters are unlocked for all scholarship student accounts.' });
      }

      // Update the message with the selected menu and the new embed
      await menuInteraction.update({
        embeds: [selectedEmbed],
        components: [row] // Keep the dropdown menu active so they can switch between values
      });
    });

    collector.on('end', async () => {
      // Disable the select menu upon timeout to save memory
      const disabledSelectMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledSelectMenu);
      
      try {
        await (responseMessage as any).edit({
          components: [disabledRow]
        });
      } catch (err) {
        // Suppress message update if the user deleted the message/channel closed
      }
    });
  },
};
