/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";
import definePlugin, { OptionType } from "@utils/types";

type Status = "online" | "idle" | "dnd" | "invisible";

const settings = definePluginSettings({
    morningStatus:   { type: OptionType.SELECT, description: "Status 6 AM–12 PM",  options: [{label:"Online",value:"online",default:true},{label:"Idle",value:"idle"},{label:"Do Not Disturb",value:"dnd"},{label:"Invisible",value:"invisible"}] },
    afternoonStatus: { type: OptionType.SELECT, description: "Status 12 PM–6 PM",  options: [{label:"Online",value:"online",default:true},{label:"Idle",value:"idle"},{label:"Do Not Disturb",value:"dnd"},{label:"Invisible",value:"invisible"}] },
    eveningStatus:   { type: OptionType.SELECT, description: "Status 6 PM–12 AM",  options: [{label:"Online",value:"online",default:true},{label:"Idle",value:"idle"},{label:"Do Not Disturb",value:"dnd"},{label:"Invisible",value:"invisible"}] },
    nightStatus:     { type: OptionType.SELECT, description: "Status 12 AM–6 AM",  options: [{label:"Online",value:"online"},{label:"Idle",value:"idle"},{label:"Do Not Disturb",value:"dnd"},{label:"Invisible",value:"invisible",default:true}] },
});

function getTarget(): Status {
    const h = new Date().getHours(), s = settings.store;
    if (h >= 6  && h < 12) return s.morningStatus   as Status;
    if (h >= 12 && h < 18) return s.afternoonStatus  as Status;
    if (h >= 18)           return s.eveningStatus    as Status;
    return s.nightStatus as Status;
}

let timer: any = null;
let UserSettingsProtoActionCreators: any = null;

async function applyStatus() {
    if (!UserSettingsProtoActionCreators)
        UserSettingsProtoActionCreators = findByProps("updateAsync", "updateRemoteSettings") ?? null;
    const status = getTarget();
    try {
        // Try the proto-based approach first (newer Discord)
        UserSettingsProtoActionCreators?.updateRemoteSettings?.({ status });
    } catch {}
}

export default definePlugin({
    name: "AutoStatus",
    description: "Automatically changes your Discord status based on the time of day.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    start() {
        applyStatus();
        timer = setInterval(applyStatus, 60_000);
    },
    stop() {
        if (timer) { clearInterval(timer); timer = null; }
    },
});
