/**
 * The hosted soltoolkit bots, for the "add to" buttons. A site of your own points these at your bots with
 * VITE_TELEGRAM_BOT (the bot's username) and VITE_DISCORD_APP_ID (the application id); either left empty hides
 * its button.
 */

const env = (name: string, fallback: string): string => ((import.meta.env[name] as string | undefined) ?? fallback).trim();

const telegram = env('VITE_TELEGRAM_BOT', 'soltoolkit_bot');
const discord = env('VITE_DISCORD_APP_ID', '1572559572189712447');

/** Send Messages, Embed Links and View Channel: what the bot needs to post cards. */
const DISCORD_PERMISSIONS = 2048 + 16384 + 1024;

/** Opens Telegram's group picker for the bot. */
export const telegramInvite: string | null = telegram ? `https://t.me/${encodeURIComponent(telegram)}?startgroup=true` : null;

/** Opens Discord's server picker for the bot, with its slash commands. */
export const discordInvite: string | null = /^\d{15,22}$/.test(discord) ? `https://discord.com/oauth2/authorize?client_id=${discord}&scope=bot%20applications.commands&permissions=${DISCORD_PERMISSIONS}` : null;
