/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { definePlugin, OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    message:         { type: OptionType.STRING,  description: "Auto-reply message", default: "I\'m AFK right now, I\'ll get back to you soon!" },
    idleOnly:        { type: OptionType.BOOLEAN, description: "Only reply when status is idle/invisible", default: true },
    cooldownMinutes: { type: OptionType.NUMBER,  description: "Cooldown per user (minutes) before replying again", default: 30 },
    dmOnly:          { type: OptionType.BOOLEAN, description: "Only reply to DMs (not group DMs)", default: true },
});

const repliedUsers = new Map<string, number>();

async function onMessage(action: any) {
    const msg = action.message;
    if (!msg) return;
    const me = UserStore.getCurrentUser();
    if (!me || msg.author.id === me.id) return;

    const ch = ChannelStore.getChannel(msg.channel_id);
    if (!ch) return;

    const isDM = ch.type === 1, isGroup = ch.type === 3;
    if (settings.store.dmOnly && !isDM) return;
    if (!isDM && !isGroup) return;

    // Check cooldown
    const last = repliedUsers.get(msg.author.id) ?? 0;
    if (Date.now() - last < settings.store.cooldownMinutes * 60_000) return;
    repliedUsers.set(msg.author.id, Date.now());

    // Check idle status (simple heuristic: presence status from DOM class)
    if (settings.store.idleOnly) {
        const statusEl = document.querySelector("[class*=\"status-\"][class*=\"idle\"]");
        if (!statusEl) return; // not idle
    }

    try {
        await RestAPI.post({
            url: `/channels/${msg.channel_id}/messages`,
            body: { content: settings.store.message },
        });
    } catch {}
}

export default definePlugin({
    name: "AFKAutoReply",
    description: "Sends a configurable auto-reply to DMs once per cooldown period when you are AFK/idle.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() { FluxDispatcher.subscribe("MESSAGE_CREATE", onMessage); },
    stop()  { FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessage); repliedUsers.clear(); },
});
