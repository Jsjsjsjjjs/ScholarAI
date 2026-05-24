import { Client, GatewayIntentBits, Collection } from 'discord.js';
import * as dotenv from 'dotenv';
import { deployCommands } from './deploy-commands.js';
import { allCommands } from './commands/index.js';
import { allEvents } from './events/index.js';

dotenv.config();

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

// Extend Client to store commands
export interface CustomClient extends Client {
  commands?: Collection<string, any>;
}

const customClient = client as CustomClient;
customClient.commands = new Collection();

export async function initDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn("DISCORD_BOT_TOKEN is not defined. Discord bot will not start.");
    return;
  }

  // Load Events
  for (const event of allEvents) {
    if (event.once) {
      customClient.once(event.name, (...args) => event.execute(...args, customClient));
    } else {
      customClient.removeAllListeners(event.name);
      customClient.on(event.name, (...args) => event.execute(...args, customClient));
    }
  }

  // Load Commands
  for (const command of allCommands) {
    if (command && 'data' in command && 'execute' in command) {
      customClient.commands.set(command.data.name, command);
    } else {
      console.warn(`[WARNING] A command is missing a required "data" or "execute" property.`);
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
    await customClient.login(token);
    console.log('Discord Bot logging in...');
    await deployCommands();
  } catch (error) {
    console.error('Failed to log in Discord bot:', error);
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
