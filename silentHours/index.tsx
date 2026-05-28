/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    startHour: { type: OptionType.NUMBER, description: "Silence start hour (0–23, 24h)", default: 23 },
    endHour:   { type: OptionType.NUMBER, description: "Silence end hour (0–23, 24h)",   default: 7  },
    suppressAll: { type: OptionType.BOOLEAN, description: "Suppress all notifications (not just sounds)", default: false },
});

function isInSilentHours(): boolean {
    const h = new Date().getHours();
    const { startHour, endHour } = settings.store;
    return startHour > endHour
        ? h >= startHour || h < endHour   // overnight e.g. 23–7
        : h >= startHour && h < endHour;  // same-day e.g. 9–17
}

let timer: any = null;
let NotifModule: any = null;
let originalSetMute: any = null;

function applySilence() {
    const silent = isInSilentHours();
    try {
        if (!NotifModule) NotifModule = findByProps("setDesktopType", "isSuppressAll");
        if (NotifModule) NotifModule.setDesktopType?.(silent && settings.store.suppressAll ? "nothing" : "all");
    } catch {}
}

export default definePlugin({
    name: "SilentHours",
    description: "Automatically mutes all Discord notifications between two times (e.g. 11 PM – 7 AM).",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() { applySilence(); timer = setInterval(applySilence, 60_000); },
    stop()  {
        if (timer) { clearInterval(timer); timer = null; }
        // Re-enable notifications on stop
        try { NotifModule?.setDesktopType?.("all"); } catch {}
    },
});
