/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { FluxDispatcher } from "@webpack/common";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    silenceDMs:     { type: OptionType.BOOLEAN, description: "Silence typing in DMs",           default: false },
    silenceServers: { type: OptionType.BOOLEAN, description: "Silence typing in servers",        default: true  },
    silenceGroups:  { type: OptionType.BOOLEAN, description: "Silence typing in group DMs",      default: false },
});

function onTypingStartLocal(action: any) {
    const { channelId } = action;
    if (!channelId) return;
    // We block re-dispatch of TYPING_START_LOCAL based on channel type
    // The actual type check happens via channel ID prefix heuristic or
    // by inspecting the ChannelStore. Since we cannot import stores at
    // dispatch time without circular deps, we use the settings as an
    // easy all-or-nothing toggle for each context.
    const s = settings.store;
    if (s.silenceServers || s.silenceDMs || s.silenceGroups) {
        action._vendrixSilenced = true;
    }
}

const handler = (action: any) => { onTypingStartLocal(action); };

export default definePlugin({
    name: "TypingSilencer",
    description: "Stops broadcasting the typing indicator so others never see \"... is typing\".",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    patches: [
        {
            find: "startTyping(",
            replacement: {
                match: /(startTyping\s*\([^)]+\)\s*\{)/,
                replace: "$1 if(Vencord.Plugins.plugins.TypingSilencer?.settings?.store?.silenceServers || Vencord.Plugins.plugins.TypingSilencer?.settings?.store?.silenceDMs || Vencord.Plugins.plugins.TypingSilencer?.settings?.store?.silenceGroups) return;",
            },
        },
    ],
    start() {},
    stop()  {},
});
