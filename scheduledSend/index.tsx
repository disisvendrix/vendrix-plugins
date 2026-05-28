/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React, RestAPI, SelectedChannelStore, useState, useEffect } from "@webpack/common";

interface Scheduled { id: string; channelId: string; content: string; sendAt: number; }

const STORAGE_KEY = "vendrix_scheduled_sends";

function loadQueue(): Scheduled[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

function saveQueue(q: Scheduled[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

function addScheduled(channelId: string, content: string, sendAt: number) {
    const q = loadQueue();
    q.push({ id: Math.random().toString(36).slice(2), channelId, content, sendAt });
    saveQueue(q);
}

async function processDue() {
    const now = Date.now();
    const q = loadQueue();
    const due = q.filter(s => s.sendAt <= now);
    const remaining = q.filter(s => s.sendAt > now);
    saveQueue(remaining);
    for (const s of due) {
        try {
            await RestAPI.post({ url: `/channels/${s.channelId}/messages`, body: { content: s.content } });
        } catch {}
    }
}

let timer: any = null;

const settings = definePluginSettings({
    showComposerButton: { type: OptionType.BOOLEAN, description: "Show scheduled-send button in message composer area", default: true },
});

export default definePlugin({
    name: "ScheduledSend",
    description: "Schedule messages to be sent at a specific date and time. Queued locally in the browser.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    scheduledQueue: loadQueue,
    addScheduled,
    start() {
        processDue();
        timer = setInterval(processDue, 30_000);
    },
    stop() {
        if (timer) { clearInterval(timer); timer = null; }
    },
});
