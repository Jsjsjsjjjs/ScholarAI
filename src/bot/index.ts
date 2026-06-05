import { Client, GatewayIntentBits, Collection } from 'discord.js';
import * as dotenv from 'dotenv';
import { deployCommands } from './deploy-commands.js';
import { allCommands } from './commands/index.js';
import { allEvents } from './events/index.js';

dotenv.config();

export const botRuntimeLogs: string[] = [`[System] Logger initialized. Timestamp: ${new Date().toISOString()}`];
export let lastBotError: string | null = null;

export const getBotRunStats = () => {
  return {
    logs: [...botRuntimeLogs],
    error: lastBotError
  };
};

export function addBotLog(message: string) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = `[${timestamp}] ${message}`;
  botRuntimeLogs.push(entry);
  if (botRuntimeLogs.length > 100) {
    botRuntimeLogs.shift();
  }
  console.log(`[BOT-LOG] ${entry}`);
}

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

// Attach event listeners for debug, logs, error status tracking
client.on('ready', () => {
  addBotLog(`🟢 Bot successfully authenticated! Connected as: ${client.user?.tag} (${client.user?.id})`);
  lastBotError = null;
});

client.on('error', (err) => {
  lastBotError = err.message || String(err);
  addBotLog(`❌ CLIENT ERROR EVENT: ${lastBotError}`);
});

client.on('shardError', (err) => {
  lastBotError = err.message || String(err);
  addBotLog(`🔸 SHARD ERROR: ${lastBotError}`);
});

client.on('warn', (warning) => {
  addBotLog(`⚠️ WARNING EVENT: ${warning}`);
});

// Extend Client to store commands
export interface CustomClient extends Client {
  commands?: Collection<string, any>;
}

const customClient = client as CustomClient;
customClient.commands = new Collection();

export async function initDiscordBot() {
  let token = process.env.DISCORD_BOT_TOKEN || "";
  // Aggressively strip any accidental surrounding quotes, whitespace, and invisible unicode characters
  token = token.replace(/[\s\r\n\t"'`\u200B-\u200D\uFEFF]/g, '');
  
  const clientIdFromEnv = process.env.DISCORD_CLIENT_ID?.trim();
  lastBotError = null;

  if (!token) {
    const err = "DISCORD_BOT_TOKEN environment variable not set or is empty.";
    lastBotError = err;
    addBotLog(`❌ ERROR: ${err}`);
    return;
  }
  
  const maskedToken = `${token.substring(0, 5)}...${token.substring(token.length - 4)}`;
  addBotLog(`Starting bot login sequence... (Token format check: length=${token.length}, masked=${maskedToken})`);

  // Load Events
  addBotLog(`Loading ${allEvents.length} event subscribers...`);
  for (const event of allEvents) {
    if (event.once) {
      customClient.once(event.name, (...args) => event.execute(...args, customClient));
    } else {
      customClient.removeAllListeners(event.name);
      customClient.on(event.name, (...args) => event.execute(...args, customClient));
    }
  }

  // Load Commands
  addBotLog(`Loading ${allCommands.length} command modules...`);
  for (const command of allCommands) {
    if (command && 'data' in command && 'execute' in command) {
      customClient.commands.set(command.data.name, command);
    } else {
      addBotLog(`⚠️ Warning: command missing "data" or "execute" properties.`);
    }
  }

  // Setup Global Error boundary logic (User rule)
  process.on('uncaughtException', async (error) => {
    console.error('Core Application Error (uncaughtException):', error);
    await logErrorToDiscord(error);
  });

  process.on('unhandledRejection', async (reason) => {
    console.error('Core Application Error (unhandledRejection):', reason);
    if (reason instanceof Error) {
      await logErrorToDiscord(reason);
    } else {
      await logErrorToDiscord(new Error(String(reason)));
    }
  });

  try {
    addBotLog("Invoking client.login()...");
    await customClient.login(token);
    addBotLog("client.login() handshake completed.");
    
    // Commands deployment
    const clientId = clientIdFromEnv;
    if (!clientId) {
      addBotLog("⚠️ DISCORD_CLIENT_ID not found in env. Skipping command deployment.");
    } else {
      addBotLog(`Deploying commands for Application ID ${clientId}...`);
      await deployCommands();
      addBotLog("Commands deploy script finished.");
    }
  } catch (error: any) {
    lastBotError = error?.message || String(error);
    let hint = "";
    if (lastBotError.includes("TokenInvalid")) {
      hint = " HINT: Discord rejected this connection. Ensure you copied the 'Token' from the 'Bot' tab, NOT the 'Client Secret' from 'OAuth2'. If it is the correct Bot Token, it may have been auto-revoked by Discord and needs to be Reset/Regenerated.";
    }
    addBotLog(`❌ FATAL LOGIN ERROR: ${lastBotError} ${hint}`);
    console.warn(`[Discord Bot] Failed to log in: ${lastBotError}`);
  }
}

async function logErrorToDiscord(error: Error) {
  if (!customClient.isReady()) return;
  const channelId = process.env.DISCORD_DEV_CHANNEL_ID;
  
  try {
    let targetChannel;
    
    if (channelId) {
      targetChannel = await customClient.channels.fetch(channelId);
    } else {
      // Fallback to searching for a #dev-logs channel
      const channelName = process.env.DEV_LOGS_CHANNEL_NAME || 'dev-logs';
      for (const guild of customClient.guilds.cache.values()) {
        const found = guild.channels.cache.find(c => c.name === channelName && c.isTextBased());
        if (found) {
          targetChannel = found;
          break;
        }
      }
    }

    if (targetChannel && targetChannel.isTextBased() && 'send' in targetChannel) {
      await targetChannel.send({
        content: `🚨 **FATAL CRASH / ERROR**: \`\`\`ts\n${error.stack?.substring(0, 1500) || error.message}\n\`\`\``
      });
    }
  } catch (e) {
    console.error('Failed to log error to Discord:', e);
  }
}
