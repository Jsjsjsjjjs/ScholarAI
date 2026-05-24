import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { fetchDocSafe, getDb } from "../utils/firestore.js";

export default {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("📊 Server & App Status Dashboard (Updates every 2 min automatically)."),

  async execute(interaction: any) {
    const userId = interaction.user.id;

    // Check roles
    let { data: userData } = await fetchDocSafe("users", userId, 5000);
    if (!userData && interaction.user.username) {
      const fallbackResult = await fetchDocSafe("users", interaction.user.username, 5000);
      userData = fallbackResult.data;
    }
    const role = userData?.role || "user";
    
    if (role !== "owner" && role !== "admin" && role !== "developer") {
      return await interaction.editReply({
        content: `❌ **Access Denied.** The live system monitoring dashboard requires Lead Developer clearance.`
      });
    }

    try {
      const getDashboardPayload = async () => {
        const db = getDb();
        
        // 1. Gather global stats (Requests, Tokens, Users)
        const usersSnap = await db.collection("users").get();
        let totalTokens = 0;
        let totalRequests = 0;
        const topUsers: any[] = [];
        
        usersSnap.forEach(doc => {
          const d = doc.data();
          totalTokens += (d.totalTokens || 0);
          totalRequests += (d.aiRequests || 0);
          topUsers.push({ nickname: d.nickname || "Anonymous", reqs: d.aiRequests || 0 });
        });

        // Simple Leaderboard top 3
        topUsers.sort((a, b) => b.reqs - a.reqs);
        const leaders = topUsers.slice(0, 3).map((u, i) => `**${i+1}.** ${u.nickname} - ${u.reqs} reqs`).join("\\n") || "No records.";

        // 2. Fetch System Logs / Errors
        let errorFeed = "None recently.";
        try {
          const logsSnap = await db.collection("system-logs")
            .where("type", "==", "error")
            .orderBy("timestamp", "desc")
            .limit(3)
            .get();
          
          const recentLogs: string[] = [];
          logsSnap.forEach(doc => {
            const data = doc.data();
            const time = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString() : "Unknown";
            recentLogs.push(`[\`${time}\`] ${data.message}`);
          });
          if (recentLogs.length > 0) errorFeed = recentLogs.join("\\n");
        } catch(e) {
          errorFeed = "No designated 'system-logs' collection available.";
        }

        // 3. Overall Config
        const configSnap = await db.collection("system").doc("config").get();
        const cfg = configSnap.exists ? configSnap.data() : {};
        const isMaint = cfg?.maintenanceMode ? "🔴 OFFLINE" : "🟢 ONLINE";
        const totalRequestsLimit = cfg?.requestCapLimit || 100;
        
        // Embed Generation
        const embed = new EmbedBuilder()
          .setTitle("🌌 SCHOLAR-AI SYSTEM DASHBOARD")
          .setColor(0x00FF00) // Green
          .setDescription(`Auto-updating diagnostic telemetry grid. System status: **${isMaint}**\\nLast Synced: <t:${Math.floor(Date.now() / 1000)}:T>`)
          .addFields(
            { name: "👥 Active Scholars", value: `\`${usersSnap.size}\` verified profiles.`, inline: true },
            { name: "🧠 Token Exhaustion", value: `\`${totalTokens.toLocaleString()}\` tokens generated`, inline: true },
            { name: "⚡ Processing Reqs", value: `\`${totalRequests}\` total server requests`, inline: true },
            { name: "🏆 Top Resolvers (By Traffic)", value: leaders },
            { name: "🚨 Top System Anomalies (Errors)", value: errorFeed },
            { name: "⚙️ Instance Parameters", value: `Engine Model: \`${cfg?.activeModel || "gemini-1.5-flash"}\`\\nDaily Limit Cap: \`${totalRequestsLimit} max/user\`` }
          )
          .setFooter({ text: "Super-Admin Diagnostic Interface • Refresh cycle: 120s" });

        return embed;
      };

      // Send the initial dashboard
      const initialEmbed = await getDashboardPayload();
      const message = await interaction.editReply({ embeds: [initialEmbed] });

      // Run interval every 2 minutes (120,000 ms), update up to 6 times (~12 mins) to preserve Discord interaction lifetime safely
      let counter = 0;
      const interval = setInterval(async () => {
        counter++;
        if (counter > 6) {
          clearInterval(interval);
          // Just make it clearly 'expired' visual state smoothly
          return;
        }

        try {
          const newEmbed = await getDashboardPayload();
          await message.edit({ embeds: [newEmbed] }); // Using standard message edit!
        } catch (intervalErr: any) {
          if (intervalErr.code === 10008) { // Unknown Message
            clearInterval(interval);
          } else {
            console.error("Dashboard update interval exception:", intervalErr);
          }
        }
      }, 120 * 1000);

    } catch (err: any) {
      console.error("[Dashboard Build Failed]", err);
      return await interaction.editReply({
        content: `🚨 **Telemetry Crash:** Unexpected failure linking database logs.\\n\\n*Diagnostics: ${err.message}*`
      });
    }
  }
};
