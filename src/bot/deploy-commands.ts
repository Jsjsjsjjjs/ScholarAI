import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { allCommands } from './commands/index.js';

dotenv.config();

export async function deployCommands() {
  let token = process.env.DISCORD_BOT_TOKEN?.trim() || "";
  token = token.replace(/^["']|["']$/g, '').trim();
  let clientId = process.env.DISCORD_CLIENT_ID?.trim() || "";
  clientId = clientId.replace(/^["']|["']$/g, '').trim();

  if (!token || !clientId) {
    console.warn("DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID is missing. Cannot deploy commands.");
    return;
  }

  const commandsArray: any[] = [];
  
  for (const command of allCommands) {
    if (command && 'data' in command) {
      commandsArray.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`Started refreshing ${commandsArray.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandsArray },
    );

    console.log(`Successfully reloaded application (/) commands.`);
  } catch (error) {
    console.error("Failed to deploy commands:", error);
  }
}
