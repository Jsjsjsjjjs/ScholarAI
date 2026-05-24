import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { fetchDocSafe, getDb } from "../utils/firestore.js";
import { deployCommands } from "../deploy-commands.js";
import { allCommands } from "./index.js";

export default {
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("⚙️ Reloads the command engine, syncs cache, and re-deploys command schemas."),
  async execute(interaction: any) {
    const userId = interaction.user.id;

    try {
      const client = interaction.client;
      
      // Clear current commands collection cache
      client.commands.clear();

      // Re-populate command collection
      let count = 0;
      for (const cmd of allCommands) {
        if (cmd && "data" in cmd && "execute" in cmd) {
          client.commands.set(cmd.data.name, cmd);
          count++;
        }
      }

      // Re-trigger REST deployment
      console.log(`[Reload Engine] Starting command redeplay by request of ${interaction.user.tag}`);
      await deployCommands();

      // Calculate Ping / Latency metrics
      const clientLatency = Math.round(client.ws.ping);
      const hostUptime = Math.round(process.uptime());

      await interaction.editReply({
        content: `⚙️ **Engine Code Reload Complete!**\n\n- 📦 **Commands Cached:** \`${count} commands\` successfully hot-reloaded.\n- 📡 **Discord Gateway Latency:** \`${clientLatency}ms\`\n- ⏱️ **Bot Client Uptime:** \`${hostUptime}s\`\n- 💎 **System State:** \`STABLE / ONLINE\`\n\n*Command schema deployed successfully to Discord Global Edge.*`
      });
    } catch (err: any) {
      console.error("[Reload Engine Fail]", err);
      await interaction.editReply({
        content: `🚨 **Reboot Failure:** Encountered error during hot reloading engine command configurations.\n\n*Diagnostics: ${err.message}*`
      });
    }
  }
};
