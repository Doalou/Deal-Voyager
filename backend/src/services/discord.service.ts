import { EmbedBuilder, TextChannel } from 'discord.js';
import { discordClient } from '../discord';
import prisma from '../lib/prisma';
import type { Prisma } from '@prisma/client';

type MobilePlanType = Prisma.MobilePlanGetPayload<{}>;

const getOperatorColor = (operatorName: string): number => {
    const normalized = operatorName.toLowerCase();
    if (normalized.includes('sosh') || normalized.includes('orange')) return 0xFF7900;
    if (normalized.includes('red') || normalized.includes('sfr')) return 0xE2001A;
    if (normalized.includes('b&you') || normalized.includes('bouygues')) return 0x0089C5;
    if (normalized.includes('free')) return 0xCC0000;
    if (normalized.includes('coriolis')) return 0x6B2D8B;
    if (normalized.includes('youprice')) return 0x1B1B3A;
    if (normalized.includes('la poste')) return 0xFFD300;
    if (normalized.includes('nrj')) return 0xE31937;
    if (normalized.includes('auchan')) return 0xE30613;
    if (normalized.includes('cdiscount')) return 0x00528A;
    if (normalized.includes('syma')) return 0x00A651;
    if (normalized.includes('lebara')) return 0xE6007E;
    return 0xFFFFFF; // Default white
};

export const broadcastDeal = async (plan: MobilePlanType, type: 'NEW' | 'UPDATE') => {
    if (!discordClient.isReady()) return;

    const title = type === 'NEW'
        ? `🆕 Nouveau forfait détecté : ${plan.planName} chez ${plan.operator} !`
        : `🔄 Forfait mis à jour : ${plan.planName} chez ${plan.operator} !`;

    const color = getOperatorColor(plan.operator);

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setURL(plan.url || 'https://deal.doalo.fr')
        .addFields(
            { name: '💰 Prix Mensuel', value: `**${plan.price.toFixed(2)} €**`, inline: true },
            { name: '🌐 Enveloppe Data', value: `**${plan.dataGb >= 1 ? plan.dataGb + ' Go' : (plan.dataGb * 1000) + ' Mo'}** ${plan.networkGeneration || ''}`, inline: true },
            { name: '📡 Réseau', value: plan.network || 'Inconnu', inline: true },
            { name: '📞 Appels', value: plan.calls || 'Illimités', inline: true },
            { name: '💬 SMS/MMS', value: plan.sms || 'Illimités', inline: true }
        );

    let feesText = '';
    if (plan.simPrice !== null) feesText += `Carte SIM : ${plan.simPrice}€\n`;
    if (plan.activationPrice && plan.activationPrice > 0) feesText += `Activation : ${plan.activationPrice}€\n`;
    if (plan.cancellationPrice && plan.cancellationPrice > 0) feesText += `Résiliation : ${plan.cancellationPrice}€\n`;

    if (feesText) {
        embed.addFields({ name: '💳 Frais Annexes', value: feesText, inline: false });
    }

    embed.setFooter({ text: 'Deal-Voyager Bot 📡', iconURL: 'https://deal.doalo.fr/favicon.ico' })
        .setTimestamp();

    try {
        const subscriptions = await prisma.discordSubscription.findMany();

        for (const sub of subscriptions) {
            try {
                const channel = await discordClient.channels.fetch(sub.channelId);
                if (channel && channel.isTextBased()) {
                    await (channel as TextChannel).send({ embeds: [embed] });
                }
            } catch (err) {
                console.error(`Impossible d'envoyer le message au salon ${sub.channelId}:`, err);
            }
        }
    } catch (dbError) {
        console.error('Erreur lors de la récupération des abonnements Discord :', dbError);
    }
};
