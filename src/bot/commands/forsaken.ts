import { SlashCommandBuilder } from "discord.js";
import { fetchDocSafe, getDb } from "../utils/firestore.js";
import { GoogleGenAI } from "@google/genai";

export default {
  data: new SlashCommandBuilder()
    .setName("forsaken")
    .setDescription("🌌 AI Studio System Controller: Prompt the AI supervisor to inspect or configure properties.")
    .addStringOption(option => 
      option.setName("instruction")
        .setDescription("The intelligence query or system action to invoke (e.g. 'Show user counts' or 'Toggle maintenance')")
        .setRequired(true)
    ),
  async execute(interaction: any) {
    const userId = interaction.user.id;
    const instruction = interaction.options.getString("instruction", true);

    // 1. RBAC authorization check
    let { data: userData } = await fetchDocSafe("users", userId, 5000);
    if (!userData && interaction.user.username) {
      const fallbackResult = await fetchDocSafe("users", interaction.user.username, 5000);
      userData = fallbackResult.data;
    }
    const role = userData?.role || "user";

    if (role !== "owner" && role !== "admin" && role !== "developer") {
      return await interaction.editReply({
        content: `❌ **Access Denied.** The \`/forsaken\` interface is a restricted console. (Current classification: \`${role}\`)`
      });
    }

    // 2. Fail gracefully if GEMINI_API_KEY is not configured
    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyAf-esDwLLnA7HWxnsV4KcrYeUnR6U-tWY";
    if (!apiKey) {
      return await interaction.editReply({
        content: "⚠️ **System Offline:** The `GEMINI_API_KEY` is not configured in the host environment. Cannot execute cognitive super-commands."
      });
    }

    try {
      const db = getDb();
      
      // Collect database diagnostics first to provide real-time context to Gemini!
      const usersSnap = await db.collection("users").get();
      const configSnap = await db.collection("system").doc("config").get();
      const systemConfig = configSnap.exists ? configSnap.data() : {
        maintenanceMode: false,
        logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60",
        activeModel: "gemini-1.5-flash",
        requestCapLimit: 100
      };

      // Calculate simple statistics
      let totalTokens = 0;
      let totalRequests = 0;
      usersSnap.forEach(doc => {
        const d = doc.data();
        totalTokens += (d.totalTokens || 0);
        totalRequests += (d.aiRequests || 0);
      });

      // Simple NLP triggers for instant actions!
      const normalizedQuery = instruction.toLowerCase();
      let matchedActionMessage = "";

      if (normalizedQuery.includes("toggle maintenance") || normalizedQuery.includes("maintenance on") || normalizedQuery.includes("enable maintenance")) {
        await db.collection("system").doc("config").set({ maintenanceMode: true }, { merge: true });
        systemConfig.maintenanceMode = true;
        matchedActionMessage = "✅ **Action Taken:** Dynamic parameter `maintenanceMode` in Firestore set to `true` on-the-fly.";
      } else if (normalizedQuery.includes("maintenance off") || normalizedQuery.includes("disable maintenance") || normalizedQuery.includes("turn maintenance off")) {
        await db.collection("system").doc("config").set({ maintenanceMode: false }, { merge: true });
        systemConfig.maintenanceMode = false;
        matchedActionMessage = "✅ **Action Taken:** Dynamic parameter `maintenanceMode` in Firestore set to `false` on-the-fly.";
      } else if (normalizedQuery.includes("change logo") || normalizedQuery.includes("set logo")) {
        // Extract URL or use a random high-quality placeholder
        const urlMatch = instruction.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          await db.collection("system").doc("config").set({ logoUrl: urlMatch[0] }, { merge: true });
          systemConfig.logoUrl = urlMatch[0];
          matchedActionMessage = `✅ **Action Taken:** Application brand logo modified to specified URL: \`${urlMatch[0]}\``;
        }
      }

      // 3. Initialize modern Google GenAI Client
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // 4. Send instructions with system state context
      const systemInstruction = `
You are 'Forsaken', the ultimate AI Studio supervisor and command controller of the ScholarAI platform.
You have special admin access to the website database and Discord gateway parameters.

Current Live System Context:
- Registered Users: ${usersSnap.size}
- Total requests processed: ${totalRequests}
- Total tokens tracked in DB: ${totalTokens}
- Maintenance Mode state: ${systemConfig.maintenanceMode ? "ACTIVE (OFFLINE)" : "RELAXED (ONLINE)"}
- Brand Logo URL: ${systemConfig.logoUrl}
- Configured AI Model: ${systemConfig.activeModel}
- Target Request Cap limit: ${systemConfig.requestCapLimit}
- User invoking command: ${interaction.user.tag} (ID: ${userId}, Role: ${role})

If the user request succeeded to trigger an inline action (such as changing logo or toggling maintenance), acknowledge it proudly.
Format your responses beautifully in professional Markdown. Keep them compact, authoritative, and structured. Include terminal-style aesthetics.
`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: instruction,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      const responseText = response.text || "No response generated by the supervisor model.";

      await interaction.editReply({
        content: `🌌 **FORSAKEN // SYSTEM CONTROLLER**\n\n${matchedActionMessage ? `${matchedActionMessage}\n\n` : ""}*Console Response:*\n${responseText}`
      });
    } catch (err: any) {
      console.error("[Forsaken Controller Command Fail]", err);
      await interaction.editReply({
        content: `🚨 **Controller Command Failed:** Encountered dynamic execution/binding failure.\n\n*Diagnostics: ${err.message}*`
      });
    }
  }
};
