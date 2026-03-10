import { Client, GatewayIntentBits, REST, Routes, Interaction, TextChannel } from 'discord.js';
import prisma from '../lib/prisma';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

export const discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });

export const initDiscordBot = async () => {
    if (!token || !clientId || token === 'ton_token_ici') {
        console.log('Discord Bot ignoré : DISCORD_BOT_TOKEN non configuré ou par défaut.');
        return;
    }

    const commands = [
        {
            name: 'deal-setup',
            description: 'Configure ce salon pour recevoir les alertes des forfaits Deal Voyager',
        },
    ];

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationCommands(clientId), { body: commands });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Erreur lors de la configuration des slash commands Discord :', error);
    }

    discordClient.on('ready', () => {
        console.log(`📡 Discord Bot connecté en tant que ${discordClient.user?.tag}`);
    });

    discordClient.on('interactionCreate', async (interaction: Interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'deal-setup') {
            const channelId = interaction.channelId;
            const guildId = interaction.guildId;

            if (!guildId) {
                await interaction.reply({ content: 'Cette commande doit être utilisée sur un serveur.', ephemeral: true });
                return;
            }

            try {
                await prisma.discordSubscription.upsert({
                    where: {
                        guildId_channelId: { guildId, channelId }
                    },
                    update: {},
                    create: { guildId, channelId }
                });

                await interaction.reply('✅ Ce salon recevra désormais les alertes de nouveaux forfaits !');
            } catch (e) {
                console.error(e);
                await interaction.reply({ content: 'Une erreur est survenue lors de l\'enregistrement.', ephemeral: true });
            }
        }
    });

    try {
        await discordClient.login(token);
    } catch (e) {
        console.error('Impossible de se connecter au bot Discord :', e);
    }
};
