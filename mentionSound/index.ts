/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    soundUrl:    { type: OptionType.STRING,  description: "URL of the sound to play on @mention (mp3/ogg/wav)", default: "" },
    volume:      { type: OptionType.NUMBER,  description: "Volume (0–100)", default: 80 },
    muteDefault: { type: OptionType.BOOLEAN, description: "Silence Discord\'s built-in mention sound", default: false },
});

let audio: HTMLAudioElement | null = null;

function playMentionSound() {
    const url = settings.store.soundUrl.trim();
    if (!url) return;
    try {
        if (!audio || audio.src !== url) {
            audio?.pause();
            audio = new Audio(url);
        }
        audio.volume = Math.max(0, Math.min(1, settings.store.volume / 100));
        audio.currentTime = 0;
        audio.play().catch(() => {});
    } catch {}
}

function onMessage(action: any) {
    const me = UserStore.getCurrentUser();
    if (!me) return;
    const msg = action.message;
    if (!msg || msg.author?.id === me.id) return;
    const mentioned = msg.mentions?.some((u: any) => u.id === me.id)
        || msg.mention_everyone
        || msg.mention_roles?.length;
    if (mentioned) playMentionSound();
}

export default definePlugin({
    name: "MentionSound",
    description: "Plays a custom sound (URL) only when you are @mentioned, replacing or supplementing Discord\'s default.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() { FluxDispatcher.subscribe("MESSAGE_CREATE", onMessage); },
    stop()  {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessage);
        audio?.pause(); audio = null;
    },
});
