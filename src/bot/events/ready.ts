import { Events, TextChannel, EmbedBuilder } from 'discord.js';
import { CustomClient } from '../index.js';
import { getDb } from '../utils/firestore.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: CustomClient) {
    console.log(`Ready! Logged in as ${client.user?.tag}`);

    // Start Ticket Listener
    startTicketListener(client).catch(console.error);
  },
};

let lastInitialLoad = true;
async function startTicketListener(client: CustomClient) {
  try {
    const db = getDb();
    
    // Check if tickets toggled off globally
    const tickRef = db.collection('system').doc('ticketsConfig');
    
    db.collection('tickets').onSnapshot(async (snapshot) => {
      // Ignore initial flood of tickets
      if (lastInitialLoad) {
        lastInitialLoad = false;
        return;
      }
      
      const configSnap = await tickRef.get();
      const configData = configSnap.data();
      const enabled = configData?.pingEnabled !== false;
      const channelId = configData?.channelId || process.env.DISCORD_TICKETS_CHANNEL_ID;
      
      if (!enabled || !channelId) return;
      
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added') {
          const t = change.doc.data();
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('🎫 New Support Ticket Created')
              .setDescription(`**Subject:** ${t.subject}\n\n**Submitter:** ${t.submitterName} (ID: ${t.submitterUid})\n\n**Message:**\n${t.messages[0]?.text}`)
              .setColor('#f97316')
              .setFooter({ text: `Ticket ID: ${change.doc.id}` })
              .setTimestamp();
              
            (channel as TextChannel).send({ embeds: [embed] });
          }
        }
      }
    });

    console.log('[Tickets] Initialized real-time ticket listener for Discord pings.');
  } catch (err) {
    console.error('[Tickets Listener] Error initializing listener:', err);
  }
}
