import { CommandInteraction, InteractionReplyOptions, MessagePayload, MessageFlags } from 'discord.js';

export async function safeReply(interaction: CommandInteraction, content: any) {
  // Fix deprecation by converting ephemeral to flags
  if (content && typeof content === 'object' && 'ephemeral' in content) {
    if (content.ephemeral) {
      content.flags = MessageFlags.Ephemeral;
    }
    delete content.ephemeral;
  }

  try {
    if (interaction.replied) {
      return await interaction.followUp(content);
    } else if (interaction.deferred) {
      return await interaction.editReply(content);
    } else {
      return await interaction.reply(content);
    }
  } catch (error: any) {
    if (error.code === 40060 || error.message?.includes('acknowledged')) {
      console.warn('[safeReply] Interaction already acknowledged or expired, ignoring duplicate reply.');
      return null;
    }
    console.error('[safeReply] Error responding to interaction:', error);
    return null;
  }
}

export async function safeDefer(interaction: CommandInteraction, ephemeral = true) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      const options: any = {};
      if (ephemeral) options.flags = MessageFlags.Ephemeral;
      await interaction.deferReply(options);
    }
  } catch (error: any) {
    if (error.code === 40060 || error.message?.includes('acknowledged')) {
      return;
    }
    console.error('[safeDefer] Error deferring interaction:', error);
  }
}
