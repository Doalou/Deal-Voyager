import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Interaction,
  TextChannel,
  MessageFlags,
  Events,
} from "discord.js";
import prisma from "../lib/prisma";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});

export const initDiscordBot = async () => {
  if (!token || !clientId || token === "ton_token_ici") {
    console.log(
      "Discord Bot ignoré : DISCORD_BOT_TOKEN non configuré ou par défaut.",
    );
    return;
  }

  const commands = [
    {
      name: "deal-setup",
      description:
        "Configure ce salon pour recevoir les alertes des forfaits Deal Voyager",
    },
  ];

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(clientId), { body: commands });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(
      "Erreur lors de la configuration des slash commands Discord :",
      error,
    );
  }

  discordClient.once(Events.ClientReady, () => {
    console.log(
      `📡 Discord Bot connecté en tant que ${discordClient.user?.tag}`,
    );
  });

  discordClient.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "deal-setup") {
      const channelId = interaction.channelId;
      const guildId = interaction.guildId;

      if (!guildId) {
        try {
          await interaction.reply({
            content: "Cette commande doit être utilisée sur un serveur.",
            flags: MessageFlags.Ephemeral,
          });
        } catch (replyError) {
          console.error(
            "[Discord] Impossible de répondre à l'interaction (pas de guild) :",
            replyError,
          );
        }
        return;
      }

      try {
        // Defer the reply immediately to avoid the 3-second timeout
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } catch (deferError) {
        // If we can't even defer, the interaction is already dead - bail out
        console.error(
          "[Discord] Impossible de defer l'interaction :",
          deferError,
        );
        return;
      }

      try {
        await prisma.discordSubscription.upsert({
          where: {
            guildId_channelId: { guildId, channelId },
          },
          update: {},
          create: { guildId, channelId },
        });

        await interaction.editReply(
          "✅ Ce salon recevra désormais les alertes de nouveaux forfaits !",
        );
      } catch (e) {
        console.error(
          "[Discord] Erreur lors de l'upsert ou de la réponse :",
          e,
        );
        try {
          await interaction.editReply(
            "❌ Une erreur est survenue lors de l'enregistrement.",
          );
        } catch (editError) {
          console.error(
            "[Discord] Impossible d'envoyer le message d'erreur :",
            editError,
          );
        }
      }
    }
  });

  // Prevent unhandled promise rejections from crashing the process
  discordClient.on("error", (error) => {
    console.error("[Discord Client] Erreur non gérée :", error);
  });

  try {
    await discordClient.login(token);
  } catch (e) {
    console.error("Impossible de se connecter au bot Discord :", e);
  }
};
