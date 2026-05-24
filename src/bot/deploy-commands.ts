import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import { allCommands } from './commands/index.js';

dotenv.config();

export async function deployCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

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
