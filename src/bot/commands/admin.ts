import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { fetchDocSafe, getDb } from "../utils/firestore.js";

export default {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("👑 Super Admin Console - Modify platform features directly via Discord.")
    .addSubcommandGroup(group =>
      group
        .setName("config")
        .setDescription("System Configurations")
        .addSubcommand(cmd =>
          cmd.setName("maintenance")
            .setDescription("Toggle maintenance mode")
            .addBooleanOption(opt =>
              opt.setName("enabled")
                .setDescription("Set maintenance mode status")
                .setRequired(true)
            )
        )
        .addSubcommand(cmd =>
          cmd.setName("logo")
            .setDescription("Set a new logo URL for the platform")
            .addStringOption(opt =>
              opt.setName("url")
                .setDescription("The full URL image link")
                .setRequired(true)
            )
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName("user")
        .setDescription("Manage specific users")
        .addSubcommand(cmd =>
          cmd.setName("setplan")
            .setDescription("Change the plan of a user")
            .addStringOption(opt => 
              opt.setName("uid")
                .setDescription("The Firebase UID of the target user")
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName("plan")
                .setDescription("Plan tier (free, elite, admin)")
                .setRequired(true)
                .addChoices(
                  { name: "Free", value: "free" },
                  { name: "Elite", value: "elite" },
                  { name: "Admin", value: "admin" }
                )
            )
        )
        .addSubcommand(cmd =>
          cmd.setName("tokens")
            .setDescription("Set token balance manually for a user")
            .addStringOption(opt => 
              opt.setName("uid")
                .setDescription("The Firebase UID of the user")
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt.setName("amount")
                .setDescription("Amount of tokens")
                .setRequired(true)
            )
        )
        .addSubcommand(cmd =>
          cmd.setName("kick")
            .setDescription("Purge a user entirely from the system (Irreversible)")
            .addStringOption(opt => 
              opt.setName("uid")
                .setDescription("The Firebase UID of the user")
                .setRequired(true)
            )
        )
    ),

  async execute(interaction: any) {
    const userId = interaction.user.id;

    // Secure discord admin command: Must be a known developer or guild owner
    const isOwner = interaction.guild?.ownerId === userId;
    const isDeveloper = ["YOUR_DISCORD_USER_ID_HERE"].includes(userId); // Add admin discord IDs here if needed
    
    if (!isOwner && !isDeveloper && !interaction.member?.permissions?.has('Administrator')) {
       return await interaction.editReply({ content: "❌ **Access Denied:** You do not have the required administrative clearance to execute platform configuration commands." });
    }

    const group = interaction.options.getSubcommandGroup();
    const command = interaction.options.getSubcommand();
    const db = getDb();

    try {
      if (group === "config") {
        if (command === "maintenance") {
          const state = interaction.options.getBoolean("enabled", true);
          await db.collection("system").doc("config").set({ maintenanceMode: state }, { merge: true });
          return await interaction.editReply({ content: `✅ Subsystem configured: **Maintenance Mode** is now \`${state ? "ON" : "OFF"}\`.` });
        }
        
        if (command === "logo") {
          const url = interaction.options.getString("url", true);
          await db.collection("system").doc("config").set({ logoUrl: url }, { merge: true });
          return await interaction.editReply({ content: `✅ Brand updated: **System Logo URL** changed to \n${url}` });
        }
      }

      if (group === "user") {
        const targetUid = interaction.options.getString("uid", true);
        
        if (command === "setplan") {
          const plan = interaction.options.getString("plan", true);
          await db.collection("users").doc(targetUid).set({ plan }, { merge: true });
          return await interaction.editReply({ content: `✅ Updated user \`${targetUid}\` plan tier to **${plan.toUpperCase()}**.` });
        }

        if (command === "tokens") {
          const amount = interaction.options.getInteger("amount", true);
          await db.collection("users").doc(targetUid).set({ totalTokens: amount }, { merge: true });
          return await interaction.editReply({ content: `✅ Overwritten token balance for user \`${targetUid}\` to **${amount} tokens**.` });
        }

        if (command === "kick") {
          // Cascade delete
          await db.collection("users").doc(targetUid).delete();
          await db.collection("stats").doc(targetUid).delete();
          return await interaction.editReply({ content: `🚨 WARNING EXECUTED: User \`${targetUid}\` and primary stats have been purged from database.` });
        }
      }
    } catch (err: any) {
      console.error("[Admin Discord Command Error]", err);
      return await interaction.editReply({
        content: `❌ **Operation Failed:** ${err.message}`
      });
    }
  }
};
