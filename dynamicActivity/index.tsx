/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelType } from "@vencord/discord-types/enums";
import {
    ChannelStore, FluxDispatcher, GuildStore,
    PresenceStore, React, SelectedChannelStore,
    UserStore, useEffect, useState,
} from "@webpack/common";

const enum ActivityType { PLAYING=0, STREAMING=1, LISTENING=2, WATCHING=3, COMPETING=5 }
const enum Mode {
    DEFAULT="default", CUSTOM="custom", ROTATING="rotating", SCHEDULED="scheduled",
    IDLE_AWARE="idle_aware", MUSIC_MIRROR="music_mirror", RANDOM="random",
    CLONE="clone", DISABLED="disabled",
}
interface Activity {
    name: string; type: ActivityType; details?: string; state?: string;
    timestamps?: { start?: number; end?: number; };
    assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string; };
    buttons?: { label: string; url: string; }[];
    application_id?: string; url?: string;
}
const SOCKET_ID = "DynamicActivity";
const APP_ID    = "1045800378228281345";
const dispatch = (a: Activity | null) => FluxDispatcher.dispatch({
    type: "LOCAL_ACTIVITY_UPDATE",
    activity: a ? { ...a, application_id: a.application_id ?? APP_ID } : null,
    socketId: SOCKET_ID,
});
const parseJson = <T,>(raw: string, fb: T): T => { try { return JSON.parse(raw) as T; } catch { return fb; } };

async function getBattery(): Promise<string | null> {
    try {
        const b = await (navigator as any).getBattery?.();
        return b ? `${Math.round(b.level * 100)}%${b.charging ? "" : ""}` : null;
    } catch { return null; }
}
const injectBat = (t: string, b: string | null) => b ? t.replace("{battery}", b) : t;

function buildDefault(bat: string | null): Activity | null {
    const vid = SelectedChannelStore.getVoiceChannelId?.();
    if (vid) {
        const vc = ChannelStore.getChannel(vid), guild = vc?.guild_id ? GuildStore.getGuild(vc.guild_id) : null;
        return { type: ActivityType.LISTENING,
            name: vc?.type === ChannelType.GUILD_STAGE_VOICE ? "a Stage Channel" : "Voice Chat",
            details: vc ? `#${vc.name}` : "Unknown", state: guild ? `in ${guild.name}` : "in a server",
            timestamps: { start: Date.now() } };
    }
    const cid = SelectedChannelStore.getChannelId();
    if (!cid) return { type: ActivityType.WATCHING, name: "Discord", details: "Home screen" };
    const ch = ChannelStore.getChannel(cid);
    if (!ch) return null;
    const me = UserStore.getCurrentUser();
    switch (ch.type) {
        case ChannelType.DM: return { type: ActivityType.WATCHING, name: "Discord", details: "Reading a DM", state: bat ? `Battery: ${bat}` : me?.username };
        case ChannelType.GROUP_DM: return { type: ActivityType.WATCHING, name: "Discord", details: `In ${(ch as any).name || "a Group Chat"}`, state: `${(ch as any).recipients?.length ?? "?"} members` };
        case ChannelType.GUILD_TEXT: case ChannelType.GUILD_ANNOUNCEMENT: case ChannelType.GUILD_FORUM: {
            const g = GuildStore.getGuild(ch.guild_id);
            return { type: ActivityType.WATCHING, name: g?.name ?? "a Server", details: `#${ch.name}`, state: "Reading messages", timestamps: { start: Date.now() } };
        }
        default: return { type: ActivityType.WATCHING, name: "Discord", details: "Browsing" };
    }
}

function buildCustom(bat: string | null): Activity {
    const s = settings.store;
    const btns: { label: string; url: string; }[] = [];
    if (s.customButton1Label && s.customButton1Url) btns.push({ label: s.customButton1Label, url: s.customButton1Url });
    if (s.customButton2Label && s.customButton2Url) btns.push({ label: s.customButton2Label, url: s.customButton2Url });
    return {
        type: s.customType, name: s.customName || "Discord",
        details: injectBat(s.customDetails, bat) || undefined,
        state:   injectBat(s.customState, bat)   || undefined,
        timestamps: s.customShowTimestamp ? { start: startTs } : undefined,
        assets: (s.customLargeImage || s.customSmallImage) ? { large_image: s.customLargeImage || undefined, large_text: s.customLargeText || undefined, small_image: s.customSmallImage || undefined, small_text: s.customSmallText || undefined } : undefined,
        buttons: btns.length ? btns : undefined,
        url: s.customType === ActivityType.STREAMING ? s.customButton1Url || undefined : undefined,
    };
}

function buildRotating(): Activity | null {
    const list = parseJson<any[]>(settings.store.rotatingActivities, []);
    if (!list.length) return null;
    const e = list[rotIdx % list.length];
    return { type: e.type ?? ActivityType.PLAYING, name: e.name || "Discord", details: e.details, state: e.state, timestamps: { start: startTs } };
}

function buildScheduled(): Activity | null {
    const h = new Date().getHours(), s = settings.store;
    const raw = h >= 6 && h < 12 ? s.scheduleMorning : h >= 12 && h < 18 ? s.scheduleAfternoon : h >= 18 ? s.scheduleEvening : s.scheduleNight;
    const slot = parseJson<any>(raw, null);
    return slot ? { type: slot.type ?? ActivityType.PLAYING, name: slot.name || "Discord", details: slot.details, state: slot.state } : null;
}

function buildMusicMirror(): Activity | null {
    try {
        const acts: any[] = PresenceStore.getActivities(UserStore.getCurrentUser()?.id) ?? [];
        const m = acts.find((a: any) => a.type === ActivityType.LISTENING || a.name === "Spotify");
        if (m) return { type: ActivityType.LISTENING, name: m.name, details: m.details, state: m.state, timestamps: m.timestamps, assets: m.assets };
    } catch {}
    return buildDefault(null);
}

function buildRandom(): Activity | null {
    const list = parseJson<any[]>(settings.store.rotatingActivities, []);
    if (!list.length) return null;
    if (randomPick < 0) randomPick = Math.floor(Math.random() * list.length);
    const e = list[randomPick];
    return { type: e.type ?? ActivityType.PLAYING, name: e.name || "Discord", details: e.details, state: e.state };
}

function buildClone(): Activity | null {
    const id = settings.store.cloneTargetId?.trim();
    if (!id) return null;
    try {
        const a = (PresenceStore.getActivities(id) as any[]).find((x: any) => x.type !== 4);
        return a ? { type: a.type, name: a.name, details: a.details, state: a.state, assets: a.assets, timestamps: a.timestamps } : null;
    } catch { return null; }
}

function buildIdle(): Activity {
    const s = settings.store;
    return { type: s.idleType, name: s.idleName || "AFK", details: s.idleDetails || undefined, timestamps: { start: Date.now() } };
}

let startTs = Date.now(), rotIdx = 0, randomPick = -1, bat: string | null = null, isIdle = false;
let rotTimer: any = null, schedTimer: any = null, idleTimer: any = null, batTimer: any = null;

const settings = definePluginSettings({
    mode: { type: OptionType.SELECT, description: "Activity mode", options: [
        { label: "Default — auto-detects what you're doing",  value: Mode.DEFAULT,     default: true },
        { label: "Custom — fixed activity",                   value: Mode.CUSTOM       },
        { label: "Rotating — cycle through a list",           value: Mode.ROTATING     },
        { label: "Scheduled — change by time of day",         value: Mode.SCHEDULED    },
        { label: "Idle-Aware — AFK when inactive",            value: Mode.IDLE_AWARE   },
        { label: "Music Mirror — mirror Spotify/music",       value: Mode.MUSIC_MIRROR },
        { label: "Random — random pick on startup",           value: Mode.RANDOM       },
        { label: "Clone — mirror another user",              value: Mode.CLONE        },
        { label: "Disabled",                                   value: Mode.DISABLED     },
    ], onChange: () => plugin.refresh() },
    customType:           { type: OptionType.SELECT,  description: "[Custom] Type", options: [{label:"Playing",value:0,default:true},{label:"Watching",value:3},{label:"Listening to",value:2},{label:"Streaming",value:1},{label:"Competing in",value:5}], onChange: () => plugin.refresh() },
    customName:           { type: OptionType.STRING,  description: "[Custom] Name", default: "Discord", onChange: () => plugin.refresh() },
    customDetails:        { type: OptionType.STRING,  description: "[Custom] Details (use {battery})", default: "", onChange: () => plugin.refresh() },
    customState:          { type: OptionType.STRING,  description: "[Custom] State (use {battery})",   default: "", onChange: () => plugin.refresh() },
    customShowTimestamp:  { type: OptionType.BOOLEAN, description: "[Custom] Show elapsed timestamp", default: false, onChange: () => plugin.refresh() },
    customLargeImage:     { type: OptionType.STRING,  description: "[Custom] Large image key/URL", default: "", onChange: () => plugin.refresh() },
    customLargeText:      { type: OptionType.STRING,  description: "[Custom] Large image text",    default: "", onChange: () => plugin.refresh() },
    customSmallImage:     { type: OptionType.STRING,  description: "[Custom] Small image key/URL", default: "", onChange: () => plugin.refresh() },
    customSmallText:      { type: OptionType.STRING,  description: "[Custom] Small image text",    default: "", onChange: () => plugin.refresh() },
    customButton1Label:   { type: OptionType.STRING,  description: "[Custom] Button 1 label", default: "", onChange: () => plugin.refresh() },
    customButton1Url:     { type: OptionType.STRING,  description: "[Custom] Button 1 URL",   default: "", onChange: () => plugin.refresh() },
    customButton2Label:   { type: OptionType.STRING,  description: "[Custom] Button 2 label", default: "", onChange: () => plugin.refresh() },
    customButton2Url:     { type: OptionType.STRING,  description: "[Custom] Button 2 URL",   default: "", onChange: () => plugin.refresh() },
    rotatingActivities:      { type: OptionType.STRING, description: "[Rotating/Random] JSON array: [{\"type\":0,\"name\":\"...\"}]", default: '[{"type":0,"name":"Discord"},{"type":2,"name":"Spotify","details":"Vibing"}]', onChange: () => plugin.refresh() },
    rotatingIntervalSeconds: { type: OptionType.NUMBER, description: "[Rotating] Seconds per rotation (min 15)", default: 30, onChange: () => plugin.refresh() },
    scheduleMorning:   { type: OptionType.STRING, description: "[Scheduled] 6 AM–12 PM",  default: '{"type":0,"name":"Morning grind"}',      onChange: () => plugin.refresh() },
    scheduleAfternoon: { type: OptionType.STRING, description: "[Scheduled] 12 PM–6 PM",  default: '{"type":3,"name":"YouTube"}',              onChange: () => plugin.refresh() },
    scheduleEvening:   { type: OptionType.STRING, description: "[Scheduled] 6 PM–12 AM",  default: '{"type":0,"name":"Gaming"}',               onChange: () => plugin.refresh() },
    scheduleNight:     { type: OptionType.STRING, description: "[Scheduled] 12 AM–6 AM",  default: '{"type":2,"name":"Late night playlist"}',  onChange: () => plugin.refresh() },
    idleThresholdMinutes: { type: OptionType.NUMBER,  description: "[Idle] Minutes before AFK", default: 10 },
    idleName:             { type: OptionType.STRING,  description: "[Idle] Name",    default: "AFK",           onChange: () => plugin.refresh() },
    idleDetails:          { type: OptionType.STRING,  description: "[Idle] Details", default: "Gone for a bit", onChange: () => plugin.refresh() },
    idleType:             { type: OptionType.SELECT,  description: "[Idle] Type", options: [{label:"Playing",value:0,default:true},{label:"Watching",value:3},{label:"Listening to",value:2}], onChange: () => plugin.refresh() },
    idleBaseMode:         { type: OptionType.SELECT,  description: "[Idle] Mode when active", options: [{label:"Default",value:Mode.DEFAULT,default:true},{label:"Custom",value:Mode.CUSTOM},{label:"Rotating",value:Mode.ROTATING}], onChange: () => plugin.refresh() },
    cloneTargetId: { type: OptionType.STRING, description: "[Clone] User ID to mirror", default: "", onChange: () => plugin.refresh() },
});

function compute(): Activity | null {
    const mode = settings.store.mode as Mode;
    if (mode === Mode.DISABLED) return null;
    if (mode === Mode.IDLE_AWARE) {
        if (isIdle) return buildIdle();
        const base = settings.store.idleBaseMode as Mode;
        return base === Mode.CUSTOM ? buildCustom(bat) : base === Mode.ROTATING ? buildRotating() : buildDefault(bat);
    }
    const map: Record<Mode, () => Activity | null> = {
        [Mode.DEFAULT]: () => buildDefault(bat), [Mode.CUSTOM]: () => buildCustom(bat),
        [Mode.ROTATING]: buildRotating, [Mode.SCHEDULED]: buildScheduled,
        [Mode.MUSIC_MIRROR]: buildMusicMirror, [Mode.RANDOM]: buildRandom,
        [Mode.CLONE]: buildClone, [Mode.IDLE_AWARE]: () => null, [Mode.DISABLED]: () => null,
    };
    return map[mode]?.() ?? null;
}

function stopTimers() {
    [rotTimer, schedTimer, batTimer].forEach(t => t && clearInterval(t));
    if (idleTimer) clearTimeout(idleTimer);
    rotTimer = schedTimer = idleTimer = batTimer = null;
}

function startTimers() {
    stopTimers();
    const mode = settings.store.mode as Mode;
    if (mode === Mode.ROTATING || (mode === Mode.IDLE_AWARE && settings.store.idleBaseMode === Mode.ROTATING)) {
        rotTimer = setInterval(() => {
            rotIdx = (rotIdx + 1) % Math.max(parseJson<any[]>(settings.store.rotatingActivities, []).length, 1);
            dispatch(compute());
        }, Math.max(15, settings.store.rotatingIntervalSeconds) * 1000);
    }
    if (mode === Mode.SCHEDULED) schedTimer = setInterval(() => dispatch(compute()), 60_000);
    if (mode === Mode.MUSIC_MIRROR || mode === Mode.CLONE) schedTimer = setInterval(() => dispatch(compute()), 8_000);
    batTimer = setInterval(async () => { bat = await getBattery(); dispatch(compute()); }, 60_000);
}

function resetIdle() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (isIdle) { isIdle = false; dispatch(compute()); }
    idleTimer = setTimeout(() => { isIdle = true; dispatch(buildIdle()); }, Math.max(1, settings.store.idleThresholdMinutes) * 60_000);
}

const fluxSubs: Record<string, () => void> = {
    CHANNEL_SELECT: () => plugin.refresh(),
    VOICE_STATE_UPDATES: () => plugin.refresh(),
    SESSION_START_OR_RESUME: () => plugin.refresh(),
};

const plugin = definePlugin({
    name: "DynamicActivity",
    description: "Smart rich presence with 8 modes: Default, Custom, Rotating, Scheduled, Idle-Aware, Music Mirror, Random, Clone.",
    authors: [{ name: "irulune", id: 0n }],
    settings,
    refresh() { dispatch(compute()); },
    async start() {
        startTs = Date.now(); randomPick = -1; isIdle = false; bat = await getBattery();
        startTimers();
        for (const [ev, fn] of Object.entries(fluxSubs)) FluxDispatcher.subscribe(ev, fn);
        if (settings.store.mode === Mode.IDLE_AWARE) {
            resetIdle();
            document.addEventListener("mousemove", resetIdle);
            document.addEventListener("keydown", resetIdle);
            document.addEventListener("touchstart", resetIdle);
        }
        this.refresh();
    },
    stop() {
        stopTimers();
        for (const [ev, fn] of Object.entries(fluxSubs)) FluxDispatcher.unsubscribe(ev, fn);
        document.removeEventListener("mousemove", resetIdle);
        document.removeEventListener("keydown", resetIdle);
        document.removeEventListener("touchstart", resetIdle);
        dispatch(null);
    },
    settingsAboutComponent() {
        const [preview, setPreview] = useState<Activity | null>(null);
        useEffect(() => { setPreview(compute()); }, []);
        if (!preview) return <div style={{ opacity: 0.6, fontSize: 13 }}>No activity active.</div>;
        const label = ["Playing","Streaming","Listening to","Watching","","Competing in"][preview.type] ?? "";
        return (
            <div style={{ background: "var(--background-secondary)", borderRadius: 8, padding: "10px 14px", fontSize: 13, lineHeight: 1.6 }}>
                <strong>Preview</strong>
                <div style={{ marginTop: 6 }}><span style={{ opacity: 0.6 }}>{label}</span> <strong>{preview.name}</strong></div>
                {preview.details && <div>{preview.details}</div>}
                {preview.state   && <div style={{ opacity: 0.7 }}>{preview.state}</div>}
                {preview.timestamps?.start && <div style={{ opacity: 0.5, fontSize: 11 }}>Timestamp on</div>}
                {!!preview.buttons?.length && <div style={{ opacity: 0.7 }}>{preview.buttons!.map(b => b.label).join(" · ")}</div>}
            </div>
        );
    },
});

export default plugin;
