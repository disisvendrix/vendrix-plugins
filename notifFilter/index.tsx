/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

const settings = definePluginSettings({
    mode:            { type: OptionType.SELECT,  description: "Filter mode", options: [{label:"Blocklist — block matching notifications",value:"block",default:true},{label:"Allowlist — only show matching notifications",value:"allow"}] },
    keywords:        { type: OptionType.STRING,  description: "Comma-separated keywords to match (case-insensitive)", default: "" },
    blockedServers:  { type: OptionType.STRING,  description: "Comma-separated server IDs to block entirely", default: "" },
    blockedChannels: { type: OptionType.STRING,  description: "Comma-separated channel IDs to block", default: "" },
    muteDMs:         { type: OptionType.BOOLEAN, description: "Suppress all DM notifications", default: false },
});

function shouldBlock(action: any): boolean {
    const s = settings.store;
    const content: string  = (action.message?.content ?? action.body ?? "").toLowerCase();
    const guildId: string  = action.message?.guild_id ?? action.guildId ?? "";
    const channelId: string = action.message?.channel_id ?? action.channelId ?? "";
    const isDM = !guildId;

    if (s.muteDMs && isDM) return true;
    if (s.blockedServers.split(",").map((x:string) => x.trim()).filter(Boolean).includes(guildId)) return true;
    if (s.blockedChannels.split(",").map((x:string) => x.trim()).filter(Boolean).includes(channelId)) return true;

    const kws = s.keywords.split(",").map((x:string) => x.trim().toLowerCase()).filter(Boolean);
    if (!kws.length) return false;

    const matches = kws.some((k: string) => content.includes(k));
    return s.mode === "block" ? matches : !matches;
}

function onNotif(action: any) {
    if (shouldBlock(action)) {
        action._vendrixBlocked = true;
        action.message = undefined; // prevent dispatch from showing toast
    }
}

export default definePlugin({
    name: "NotifFilter",
    description: "Block or allowlist notifications by keyword, server ID, or channel ID.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    patches: [
        {
            find: "LOCAL_NOTIFICATION_CREATE",
            replacement: {
                match: /(LOCAL_NOTIFICATION_CREATE.*?dispatch\()(action)/,
                replace: "$1(Vencord.Plugins.plugins.NotifFilter?.shouldBlockAction?.($2),$2)",
            },
        },
    ],
    shouldBlockAction: shouldBlock,
    start() { FluxDispatcher.subscribe("LOCAL_NOTIFICATION_CREATE", onNotif); },
    stop()  { FluxDispatcher.unsubscribe("LOCAL_NOTIFICATION_CREATE", onNotif); },
});
