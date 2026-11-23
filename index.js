let makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    downloadContentFromMessage,
    Browsers,
    proto;

async function loadBaileys() {
    if (typeof makeWASocket === 'function') return;
    const mod = await import('@whiskeysockets/baileys');
    const b = (mod && mod.default && (typeof mod.default === 'object' || typeof mod.default === 'function')) ? mod.default : mod;
    makeWASocket = [
        mod?.makeWASocket,
        b?.makeWASocket,
        typeof mod?.default === 'function' ? mod.default : null,
        typeof b?.default === 'function' ? b.default : null,
        typeof mod?.default?.default === 'function' ? mod.default.default : null
    ].find(fn => typeof fn === 'function');
    if (typeof makeWASocket !== 'function') {
        throw new Error('Failed to load makeWASocket from @whiskeysockets/baileys');
    }
    useMultiFileAuthState = mod.useMultiFileAuthState || b.useMultiFileAuthState;
    DisconnectReason = mod.DisconnectReason || b.DisconnectReason;
    fetchLatestBaileysVersion = mod.fetchLatestBaileysVersion || b.fetchLatestBaileysVersion;
    fetchLatestWaWebVersion = mod.fetchLatestWaWebVersion || b.fetchLatestWaWebVersion;
    makeCacheableSignalKeyStore = mod.makeCacheableSignalKeyStore || b.makeCacheableSignalKeyStore;
    jidNormalizedUser = mod.jidNormalizedUser || b.jidNormalizedUser;
    downloadContentFromMessage = mod.downloadContentFromMessage || b.downloadContentFromMessage;
    Browsers = mod.Browsers || b.Browsers;
    proto = mod.proto || b.proto;
}

const TelegramBot = require('node-telegram-bot-api');
const http  = require('http');
const pino  = require('pino');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const {
    unwrapContainer,
    getQuotedInfo,
    cacheIncomingViewOnce,
    handleViewOnceCommand
} = require('./lib/viewOnce');
const { handleSystemAndAutoCommands } = require('./lib/commands/system');
const { handleGroupCommands } = require('./lib/commands/group');
const { handleMediaAndDownloaderCommands } = require('./lib/commands/media');

const TG_TOKEN   = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const BOT_NAME   = "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇";
const OWNER_NAME = "𝛥𝑆𝛥𝐷";
const WEB_PORT   = Number(process.env.PORT) || 8000;
const DEFAULT_WA_CHANNEL_LINK = 'https://whatsapp.com/channel/0029VbATSM74dTnMw4evnN13';

const CONFIG_PATH = path.join(__dirname, 'config.json');
function loadConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
let resolvedChannelJid = '';
let resolvedChannelName = '';
const newsletterRoleCache = new Map();

const DEFAULT_WA_CHANNEL_JID = '120363400000000000@newsletter';

function getViewChannelContext(cfg, dpBuf, targetJid = '', sessionObj = null) {
    const chUrl = String(cfg.WA_CHANNEL_LINK || process.env.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim();
    const chJid = sessionObj?.resolvedChannelJid || cfg.WA_CHANNEL_JID || resolvedChannelJid || DEFAULT_WA_CHANNEL_JID;
    const chName = sessionObj?.resolvedChannelName || cfg.WA_CHANNEL_NAME || resolvedChannelName || (BOT_NAME + ' OFFICIAL');
    const isSameChannel = Boolean(targetJid && String(targetJid).endsWith('@newsletter'));
    const ctx = {
        forwardingScore: 999,
        isForwarded: true,
        externalAdReply: {
            title: '📢 View Channel — ' + chName,
            body: 'POWERED BY ASAD-MD ⚡',
            mediaType: 1,
            renderLargerThumbnail: false,
            showAdAttribution: false,
            sourceUrl: chUrl,
            ...(dpBuf ? { thumbnail: dpBuf } : {})
        }
    };
    if (chJid && chJid.endsWith('@newsletter') && !isSameChannel) {
        ctx.forwardedNewsletterMessageInfo = {
            newsletterJid: chJid,
            newsletterName: chName,
            serverMessageId: 143
        };
    }
    return ctx;
}

function getBotImgPayload(caption, includeViewChannel = false, targetJid = '', sessionCfg = null, sessionObj = null) {
    const cfg = sessionCfg || loadConfig();
    const localDp = path.join(__dirname, cfg.DEFAULT_DP || 'assets/bot_dp.jpg');
    const dpBuf = fs.existsSync(localDp) ? fs.readFileSync(localDp) : null;
    const contextInfo = includeViewChannel ? getViewChannelContext(cfg, dpBuf, targetJid, sessionObj) : undefined;
    if (cfg.BOT_IMG && /^https?:\/\//i.test(cfg.BOT_IMG)) {
        return contextInfo
            ? { image: { url: cfg.BOT_IMG }, caption, contextInfo }
            : { image: { url: cfg.BOT_IMG }, caption };
    }
    if (dpBuf) {
        return contextInfo
            ? { image: dpBuf, caption, contextInfo }
            : { image: dpBuf, caption };
    }
    return contextInfo ? { text: caption, contextInfo } : { text: caption };
}

const ALL_REACT_EMOJIS = ["⚡","❤️","🔥","👑","👍","😂","😍","🤩","🥳","💯","✨","🚀","💥","💎","🫡","🙏","👏","🎉","🖤","💚","💙","💜","🧡","💛","🤍","💖","💘","💝","💓","💞","💕","❣️","🥰","😘","😎","🤓","🧐","🤯","😮","😲","😱","🥹","😭","🤣","😅","😆","😁","😊","😇","🙂","🙃","😉","😌","🤤","🤗","🤭","🤫","🤔","🤨","😐","😏","😒","🙄","😬","😴","😷","🤒","🤕","🤠","🤡","👻","💀","☠️","👽","👾","🤖","🎃","😈","👿","👹","💪","🦾","✌️","🤞","🤟","🤘","👌","🤌","🤏","🙌","👐","🤲","🤝","🫶","☝️","👆","🌟","⭐","🌈","☀️","🌙","☄️","🌊","❄️","🌸","🌹","🌺","🌻","🍀","🌴","🌵","🍁","🦁","🐯","🐺","🦅","🦋","🐉","🐍","🦈","🐬","🦄","🐝","🐞","🕊️","🦜","🦚","🦢","☕","🍕","🍔","🍟","🍩","🍪","🍫","🍓","🍉","🥭","🍇","🍒","🥂","🧋","🍵","🍯","⚽","🏏","🏆","🥇","🎯","🎮","🎲","🎸","🎧","🎤","🎬","📸","💻","📱","🔒","🔑","☪️","🕌","🕋","🤲","🌙","✨","🛡️","⚔️","🏴","🇵🇰","🚩","🔔","📢","💬","💠","☑️"];
const emojiBags = new Map();
const lastPickedEmoji = new Map();

function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

// Shuffled non-repeating emoji bag: cycles through ALL 140+ emojis without repeating 1 emoji back-to-back!
function pickAutoReactEmoji(auto, scopeKey = 'default') {
    const custom = Array.isArray(auto?.reactEmojis) && auto.reactEmojis.length ? auto.reactEmojis : [];
    const basePool = (auto?.allEmojiReact !== false)
        ? (custom.length ? Array.from(new Set([...ALL_REACT_EMOJIS, ...custom])) : ALL_REACT_EMOJIS)
        : (custom.length ? custom : ALL_REACT_EMOJIS);

    let bag = emojiBags.get(scopeKey);
    if (!bag || !bag.length) {
        bag = shuffleArray(basePool);
        const prev = lastPickedEmoji.get(scopeKey);
        if (bag.length > 1 && bag[bag.length - 1] === prev) {
            const first = bag.shift();
            bag.push(first);
        }
        emojiBags.set(scopeKey, bag);
    }
    const picked = bag.pop();
    lastPickedEmoji.set(scopeKey, picked);
    return picked;
}

// Fixes "Waiting for this message. This may take a while." via getMessage + retry cache
const messageStore = new Map();
function rememberMessage(keyId, messageObj) {
    if (!keyId || !messageObj) return;
    messageStore.set(keyId, messageObj);
    if (messageStore.size > 1500) {
        const oldestKey = messageStore.keys().next().value;
        messageStore.delete(oldestKey);
    }
}
function createRetryCache() {
    const map = new Map();
    return {
        get: (k) => map.get(k),
        set: (k, v) => {
            map.set(k, v);
            if (map.size > 1000) map.delete(map.keys().next().value);
        },
        del: (k) => map.delete(k),
        flushAll: () => map.clear()
    };
}
const groupMetaCache = new Map();

['tmp', 'temp', 'assets', 'sessions'].forEach(d =>
    fs.mkdirSync(path.join(__dirname, d), { recursive: true })
);

const hasRealTgToken = Boolean(TG_TOKEN && !TG_TOKEN.includes('YOUR_TELEGRAM_BOT_TOKEN') && TG_TOKEN.includes(':'));
let tgBot = null;

const sessions = {};

function extractText(rawMessage) {
    const m = unwrapContainer(rawMessage);
    if (!m) return '';
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        m.buttonsResponseMessage?.selectedButtonId ||
        m.templateButtonReplyMessage?.selectedId ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    );
}

function detectQuotedMedia(rawNode) {
    const m = unwrapContainer(rawNode);
    if (!m) return null;
    if (m.imageMessage) return { type: 'image', media: m.imageMessage };
    if (m.videoMessage) return { type: 'video', media: m.videoMessage };
    if (m.audioMessage) return { type: 'audio', media: m.audioMessage };
    if (m.stickerMessage) return { type: 'sticker', media: m.stickerMessage };
    if (m.documentMessage) return { type: 'document', media: m.documentMessage };
    return null;
}

function containsLink(rawMessage, plainText) {
    const m = unwrapContainer(rawMessage);
    const hay = [
        plainText || '',
        m?.extendedTextMessage?.matchedText || '',
        m?.extendedTextMessage?.canonicalUrl || '',
        m?.extendedTextMessage?.title || '',
        m?.extendedTextMessage?.description || ''
    ].join(' ');
    return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|whatsapp\.com\/channel\/|wa\.me\/|t\.me\/|bit\.ly\/|tinyurl\.com\/)/i.test(hay);
}

const TOXIC_WORDS = [
    'madarchod','maderchod','bhenchod','bsdk','chutiya','chutiye',
    'randi','harami','kamina','gandu','gaandu','bhosdike','bhosdi',
    'lauda','lund','fuck','fucker','fucking','bitch','bastard',
    'asshole','motherfucker','bc','mc','lode','haramzada','kutte','kamine'
];

const PORN_WORDS = [
    'porn','pornhub','xvideos','xnxx','xhamster','brazzers','onlyfans',
    'sexvideo','nude','nudes','hentai','xxx','chudai','choot','bur',
    'redtube','youporn','spankbang','stripchat','camgirl'
];

function hasToxicOrBlocked(t, customWords, includeDefaultToxic = true) {
    if (!t) return false;
    const l = t.toLowerCase();
    const list = [
        ...(includeDefaultToxic ? TOXIC_WORDS : []),
        ...(Array.isArray(customWords) ? customWords : [])
    ];
    return list.some(w => new RegExp('\\b' + String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\b', 'i').test(l));
}

function hasPornOrNsfw(t) {
    if (!t) return false;
    const l = t.toLowerCase();
    return PORN_WORDS.some(w => l.includes(w));
}

function styleBox(title, body) {
    return '╭─「 ⚡ *' + BOT_NAME + (title ? ' — ' + title : '') + '* 」\n' + body + '\n╰──────────────────────◈';
}

function getMenuText(sessionCfg = null) {
    const cfg = sessionCfg || loadConfig();
    const p = cfg.PREFIX || '.';
    let txt = "✦ ━━━━━━━━━━━━━━━━━━━ ✦\n  𝛥𝑆𝛥𝐷 𝛭𝐷\n  𝐶𝛥𝑅𝑇𝛩𝛩𝛮\n  135 COMMANDS\n✦ ━━━━━━━━━━━━━━━━━━━ ✦\n\n┌───✦ OWNER ✦───┐\n│               │\n└───────────────┘\n💫 .alive\n🌠 .ping\n😻 .chreact\n🪐 .uptime\n🔁 .restart\n💥 .shutdown\n🆙 .update\n🎛️ .mode\n⌨️ .setprefix\n👑 .setowner\n🔗 .pair\n🔢 .paircode\n🗂️ .getsessions\n🗑️ .delsession\n🧹 .clearsession\n🚪 .logout\n🆔 .jid\n📢 .broadcast\n👥 .bcgroup\n👤 .bcuser\n➡️ .forward\n📝 .setbio\n🖼️ .setpp\n✏️ .setname\n🚫 .ban\n✅ .unban\n📋 .banlist\n⛔ .block\n🔓 .unblock\n📃 .blocklist\n⚠️ .warn\n🧽 .delwarn\n🧠 .eval\n💻 .exec\n🐚 .shell\n📜 .getcode\n➕ .setcmd\n➖ .delcmd\n\n┌───✦ ANTI ✦───┐\n│               │\n└───────────────┘\n🔗 .antilink\n🤖 .antibot\n👁️ .vv\n👁️ .antivv\n👀 .antiviewonce\n🗑️ .antidelete\n🚫 .antisticker\n📵 .antispam\n🗣️ .antiword\n🎭 .antifake\n🔞 .antiporn\n🤬 .antibadword\n📞 .anticall\n👥 .antigroup\n📊 .antipoll\n📢 .antimention\n↪️ .antiforward\n🎬 .antimedia\n\n┌───✦ GROUP ✦───┐\n│               │\n└───────────────┘\n🗣️ .allgroupmessage\nℹ️ .groupinfo\n📄 .ginfo\n➕ .join\n🚶 .leave\n🔗 .link\n🌐 .grouplink\n♻️ .revoke\n✏️ .setgname\n📝 .setgdesc\n🖼️ .setgpp\n🔓 .open\n🔒 .close\n🔐 .lock\n🔓 .unlock\n➕ .add\n👢 .kick\n❌ .remove\n⬆️ .promote\n⬇️ .demote\n📣 .tagall\n👻 .hidetag\n🏷️ .tag\n📊 .poll\n🗳️ .vote\n👋 .welcome\n👋 .goodbye\n🎉 .setwelcome\n💔 .setgoodbye\n👮 .listadmin\n👑 .admins\n👥 .members\n✉️ .invite\n\n┌───✦ DOWNLOAD ✦───┐\n│               │\n└───────────────┘\n🎵 .play\n🎶 .song\n🎬 .video\n🎧 .ytmp3\n📹 .ytmp4\n🔍 .yts\n🔊 .ytaudio\n🎥 .ytvideo\n🎵 .tiktok\n⬇️ .tiktokdl\n📘 .fb\n⬇️ .fbdl\n📸 .insta\n⬇️ .igdl\n📷 .instagram\n🐦 .twitter\n⬇️ .xdl\n📌 .pinterest\n📍 .pin\n💾 .mediafire\n📱 .apk\n⬇️ .apkdl\n🎧 .spotify\n☁️ .soundcloud\n📦 .terabox\n💽 .gdrive\n🖼️ .image\n🌐 .google\n\n┌───✦ AUTO ✦───┐\n│               │\n└───────────────┘\n👀 .autostatus\n👁️ .autostatusview\n❤️ .autolike\n😍 .autoreact\n📖 .autoread\n⌨️ .autotyping\n🎙️ .autorecording\n📝 .autobio\n🚫 .autoblock\n✅ .autounblock\n👋 .autowelcome\n👋 .autogoodbye\n⬆️ .autopromote\n⬇️ .autodemote\n🗑️ .autodelete\n🤖 .autoai\n💬 .autoreply\n⬇️ .autodownload\n\n✦ ━━━━━━━━━━━━━━━━━━━ ✦\n  POWERED BY ASAD MD\n  MADE BY 𝛥𝑆𝛥𝐷\n✦ ━━━━━━━━━━━━━━━━━━━ ✦\n📢 *View Channel:*\nhttps://whatsapp.com/channel/0029VbATSM74dTnMw4evnN13";
    if (p !== '.') {
        txt = txt.replace(/^([^\n ]+ )\./gm, '$1' + p);
    }
    return txt;
}
function getAllMenuText(sessionCfg = null) {
    return getMenuText(sessionCfg);
}
function getAllMenuChunks(sessionCfg = null) {
    const full = getAllMenuText(sessionCfg);
    const lines = full.split('\n');
    const chunks = [];
    let cur = '';
    for (const line of lines) {
        if ((cur + '\n' + line).length > 3400 && cur) {
            chunks.push(cur);
            cur = line;
        } else {
            cur = cur ? (cur + '\n' + line) : line;
        }
    }
    if (cur) chunks.push(cur);
    return chunks;
}
function getListText(sessionCfg = null) {
    const cfg = sessionCfg || loadConfig();
    const p = cfg.PREFIX || '.';
    let txt = "✦ ━━━━━━━━━━━━━━━━━━━ ✦\n  𝛥𝑆𝛥𝐷 𝛭𝐷 — CATEGORIES\n  135 COMMANDS\n✦ ━━━━━━━━━━━━━━━━━━━ ✦\n│ 👑 *1. OWNER* — `38 cmds`\n│ 🛡️ *2. ANTI* — `18 cmds`\n│ 👥 *3. GROUP* — `33 cmds`\n│ 📥 *4. DOWNLOAD* — `28 cmds`\n│ ⚡ *5. AUTO* — `18 cmds`\n\n💡 Use *.menu* to open the full commands card.\n  MADE BY 𝛥𝑆𝛥𝐷\n\n📢 *View Channel:*\nhttps://whatsapp.com/channel/0029VbATSM74dTnMw4evnN13";
    if (p !== '.') {
        txt = txt.replace(/\*\.menu\*/g, '*' + p + 'menu*');
    }
    return txt;
}

function normalizePhoneInput(raw) {
    let digits = String(raw || '')
        .replace(/[\u200e\u200f\u202a-\u202e\s+()-]/g, '')
        .replace(/[^0-9]/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('03') && digits.length === 11) digits = '92' + digits.slice(1);
    else if (digits.startsWith('3') && digits.length === 10) digits = '92' + digits;
    return digits;
}

let cachedBaileysVersion = null;
let cachedBaileysTs = 0;
async function getBaileysVersionSafe() {
    if (cachedBaileysVersion && Date.now() - cachedBaileysTs < 30 * 60 * 1000) {
        return cachedBaileysVersion;
    }
    if (typeof fetchLatestWaWebVersion === 'function') {
        try {
            const waRes = await fetchLatestWaWebVersion({});
            if (Array.isArray(waRes?.version) && waRes.version.length === 3) {
                cachedBaileysVersion = waRes.version;
                cachedBaileysTs = Date.now();
                return cachedBaileysVersion;
            }
        } catch {}
    }
    if (typeof fetchLatestBaileysVersion === 'function') {
        try {
            const res = await fetchLatestBaileysVersion();
            if (Array.isArray(res?.version) && res.version.length === 3) {
                cachedBaileysVersion = res.version;
                cachedBaileysTs = Date.now();
                return cachedBaileysVersion;
            }
        } catch {}
    }
    return [2, 3000, 1027934701];
}

class Session {
    constructor(phoneKey, tgChatId, notifyWaFn = null) {
        this.phoneKey  = normalizePhoneInput(phoneKey);
        this.authPath  = path.join(__dirname, 'sessions', this.phoneKey);
        this.configPath = path.join(this.authPath, 'session_config.json');
        this.cacheDir  = path.join(this.authPath, 'vv_cache');
        this.metaFile  = path.join(this.authPath, 'tg_owner.json');
        this.tgChatId  = tgChatId ? String(tgChatId) : this.readSavedTgChatId();
        this.notifyWaFn = typeof notifyWaFn === 'function' ? notifyWaFn : null;
        this.sock      = null;
        this.connected = false;
        this.stopped   = false;
        this.lastPairingCode = null;
        this.lastError = '';
        this._starting = false;
        this._reconnectCount = 0;
        this._credsQueue = Promise.resolve();
        this._pendingPair = false;
        this._pendingCallback = null;
        this._channelFollowed = false;
        this.resolvedChannelJid = '';
        this.resolvedChannelName = '';
        this.processedMsgIds = new Set();
        this.knownDms = new Set();
        this.warns = {};
        this.recentMsgs = new Map();
        this.spamMap = new Map();
        fs.mkdirSync(this.authPath, { recursive: true });
        this.initSessionConfig();
        if (tgChatId) {
            try { fs.writeFileSync(this.metaFile, JSON.stringify({ tgChatId: String(tgChatId) })); } catch {}
        }
    }

    buildDefaultSessionConfig() {
        const base = loadConfig();
        let cloned = {};
        try { cloned = JSON.parse(JSON.stringify(base || {})); } catch { cloned = {}; }
        const envOwner = String(process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        // Strictly isolate each paired WhatsApp: root/env OWNER_NUMBER never controls another user's session!
        cloned.OWNER_NUMBER = (envOwner && this.phoneKey === envOwner) ? envOwner : '';
        cloned.DISABLED_COMMANDS = [];
        cloned.BANNED_USERS = [];
        cloned.ANTI_WORDS = Array.isArray(cloned.ANTI_WORDS) ? cloned.ANTI_WORDS : [];
        cloned.CUSTOM_COMMANDS = (cloned.CUSTOM_COMMANDS && typeof cloned.CUSTOM_COMMANDS === 'object') ? cloned.CUSTOM_COMMANDS : {};
        cloned.AUTO = (cloned.AUTO && typeof cloned.AUTO === 'object') ? { ...cloned.AUTO } : {};
        cloned.SAFETY = (cloned.SAFETY && typeof cloned.SAFETY === 'object') ? { ...cloned.SAFETY } : {};
        return cloned;
    }

    initSessionConfig() {
        if (!fs.existsSync(this.configPath)) {
            const initial = this.buildDefaultSessionConfig();
            try { fs.writeFileSync(this.configPath, JSON.stringify(initial, null, 2)); } catch {}
        }
    }

    loadSessionConfig() {
        this.initSessionConfig();
        try {
            const parsed = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            parsed.AUTO = (parsed.AUTO && typeof parsed.AUTO === 'object') ? parsed.AUTO : {};
            parsed.SAFETY = (parsed.SAFETY && typeof parsed.SAFETY === 'object') ? parsed.SAFETY : {};
            parsed.DISABLED_COMMANDS = Array.isArray(parsed.DISABLED_COMMANDS) ? parsed.DISABLED_COMMANDS : [];
            parsed.BANNED_USERS = Array.isArray(parsed.BANNED_USERS) ? parsed.BANNED_USERS : [];
            parsed.ANTI_WORDS = Array.isArray(parsed.ANTI_WORDS) ? parsed.ANTI_WORDS : [];
            parsed.CUSTOM_COMMANDS = (parsed.CUSTOM_COMMANDS && typeof parsed.CUSTOM_COMMANDS === 'object') ? parsed.CUSTOM_COMMANDS : {};
            return parsed;
        } catch {
            return this.buildDefaultSessionConfig();
        }
    }

    saveSessionConfig(nextCfg) {
        try {
            fs.mkdirSync(this.authPath, { recursive: true });
            fs.writeFileSync(this.configPath, JSON.stringify(nextCfg || {}, null, 2));
        } catch {}
    }

    async restartSelf() {
        this.connected = false;
        if (this._keepAlive) clearInterval(this._keepAlive);
        try { this.sock?.end(); } catch {}
    }

    markProcessed(id) {
        if (!id) return false;
        if (this.processedMsgIds.has(id)) return true;
        this.processedMsgIds.add(id);
        if (this.processedMsgIds.size > 2000) {
            this.processedMsgIds.delete(this.processedMsgIds.keys().next().value);
        }
        return false;
    }

    readSavedTgChatId() {
        try { return JSON.parse(fs.readFileSync(this.metaFile, 'utf8')).tgChatId || null; } catch { return null; }
    }

    async notifyTg(text) {
        if (!this.tgChatId || !tgBot) return;
        try { await tgBot.sendMessage(this.tgChatId, text, { parse_mode: 'Markdown' }); } catch {}
    }

    async followConfiguredChannel(attempt = 1) {
        if (this.stopped || !this.connected || !this.sock || this._channelFollowed) return;
        try {
            const cfg = this.loadSessionConfig();
            const rootCfg = loadConfig();
            const auto = cfg.AUTO || {};
            const chLink = String(cfg.WA_CHANNEL_LINK || rootCfg.WA_CHANNEL_LINK || process.env.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim();
            const inv = chLink.match(/whatsapp\.com\/channel\/([0-9A-Za-z]+)/i);
            const rawJid = chLink.endsWith('@newsletter') ? chLink : null;
            if (!inv && !rawJid) return;
            let targetJid = rawJid;
            let targetName = cfg.WA_CHANNEL_NAME || (BOT_NAME + ' OFFICIAL');
            if (inv && typeof this.sock.newsletterMetadata === 'function') {
                const metaCh = await this.sock.newsletterMetadata('invite', inv[1]).catch((err) => {
                    console.log('[SESSION +' + this.phoneKey + '] newsletterMetadata warn:', err?.message || err);
                    return null;
                });
                if (metaCh?.id) {
                    targetJid = metaCh.id;
                    targetName = metaCh?.thread_metadata?.name?.text || metaCh?.name || targetName;
                    this.resolvedChannelJid = targetJid;
                    this.resolvedChannelName = targetName;
                    if (!resolvedChannelJid) resolvedChannelJid = targetJid;
                    if (!resolvedChannelName) resolvedChannelName = targetName;
                    if (cfg.WA_CHANNEL_JID !== targetJid || cfg.WA_CHANNEL_NAME !== targetName) {
                        cfg.WA_CHANNEL_JID = targetJid;
                        cfg.WA_CHANNEL_NAME = targetName;
                        this.saveSessionConfig(cfg);
                    }
                }
            }
            if (auto.autoChannelFollow === false) return;
            if (targetJid && typeof this.sock.newsletterFollow === 'function') {
                await this.sock.newsletterFollow(targetJid);
                if (typeof this.sock.subscribeNewsletterUpdates === 'function') {
                    await this.sock.subscribeNewsletterUpdates(targetJid).catch(() => {});
                }
                this._channelFollowed = true;
                this._followedChannelJid = targetJid;
                console.log('[SESSION +' + this.phoneKey + '] ✅ Auto-Followed & Subscribed Channel:', targetJid);
                return;
            }
        } catch (err) {
            console.log('[SESSION +' + this.phoneKey + '] Channel follow attempt ' + attempt + ' error:', err?.message || err);
        }
        if (attempt < 5 && !this.stopped && this.connected) {
            setTimeout(() => this.followConfiguredChannel(attempt + 1), attempt * 3500);
        }
    }

    async stopAndCleanup(removeAuth = false) {
        this.stopped = true;
        if (this._keepAlive) clearInterval(this._keepAlive);
        try { this.sock?.ev?.removeAllListeners(); } catch {}
        try { this.sock?.ws?.close(); } catch {}
        try { this.sock?.end(); } catch {}
        await this._credsQueue.catch(() => {});
        await new Promise(r => setTimeout(r, 350));
        if (removeAuth) {
            try { fs.rmSync(this.authPath, { recursive: true, force: true }); } catch {}
        }
    }

    async start(requestCode = false, onCodeCallback = null) {
        if (this.stopped || this._starting) return;
        this._starting = true;
        try {
        await loadBaileys();
        if (requestCode) {
            this._pendingPair = true;
            this.lastError = '';
            if (typeof onCodeCallback === 'function') this._pendingCallback = onCodeCallback;
        }
        const activeCallback = onCodeCallback || this._pendingCallback;

        const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
        const version = await getBaileysVersionSafe();
        const msgRetryCounterCache = createRetryCache();
        const silentLogger = pino({ level: 'silent' });
        const authConfig = typeof makeCacheableSignalKeyStore === 'function'
            ? { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silentLogger) }
            : state;

        this.sock = makeWASocket({
            version,
            auth: authConfig,
            browser: Browsers.macOS('Chrome'),
            printQRInTerminal: false,
            logger: silentLogger,
            qrTimeout: 60000,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            retryRequestDelayMs: 1000,
            maxMsgRetryCount: 5,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            markOnlineOnConnect: false,
            emitOwnEvents: true,
            msgRetryCounterCache,
            cachedGroupMetadata: async (jid) => {
                const hit = groupMetaCache.get(jid);
                if (hit && Date.now() - hit.ts < 60000) return hit.data;
                return undefined;
            },
            getMessage: async (key) => {
                const cached = key?.id ? messageStore.get(key.id) : null;
                return cached?.message || cached || proto.Message.fromObject({});
            }
        });

        const origSendMessage = this.sock.sendMessage.bind(this.sock);
        this.sock.sendMessage = async (jid, content, options) => {
            const sent = await origSendMessage(jid, content, options);
            if (sent?.key?.id && sent?.message) {
                rememberMessage(sent.key.id, sent.message);
            }
            return sent;
        };

        // Serialize creds writes so 515 restartRequired never reads partial creds.json
        this.sock.ev.on('creds.update', () => {
            this._credsQueue = this._credsQueue.then(() => saveCreds()).catch(() => {});
        });

        let qrReadyResolve = null;
        let closedEarly = false;
        const qrReadyPromise = new Promise((resolve) => {
            qrReadyResolve = resolve;
            setTimeout(() => {
                if (qrReadyResolve) { qrReadyResolve('timeout'); qrReadyResolve = null; }
            }, 16000);
        });

        this.sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            if (qr && qrReadyResolve) {
                qrReadyResolve('qr');
                qrReadyResolve = null;
            }
            if (connection === 'open') {
                const wasConnected = this.connected;
                this.connected = true;
                this.lastError = '';
                this._pendingPair = false;
                this._reconnectCount = 0;
                if (this._keepAlive) clearInterval(this._keepAlive);
                this._keepAlive = setInterval(async () => {
                    try {
                        const auto = this.loadSessionConfig().AUTO || {};
                        if (auto.presenceMode && auto.presenceMode !== 'available') {
                            await this.sock.sendPresenceUpdate(auto.presenceMode);
                        }
                        if (auto.autoBio) {
                            await this.sock.updateProfileStatus('⚡ ' + BOT_NAME + ' | 🕒 ' + new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' }) + ' PKT');
                        }
                    } catch {}
                }, 4 * 60 * 1000);

                // Auto Channel Follow after socket finishes initial IQ sync (works for every user who pairs)
                setTimeout(() => this.followConfiguredChannel(1), 3500);

                console.log('[SESSION +' + this.phoneKey + '] Connected ✅');
                if (!wasConnected) {
                    const msgCard =
                        '╭━━〔 ✅ *' + BOT_NAME + ' CONNECTED!* 〕━━╮\n' +
                        '┃ 📱 *Number:* +' + this.phoneKey + '\n' +
                        '┃ 📦 *Commands:* 135 Active\n' +
                        '┃ ✨ *All-Emoji Auto React & Channel Ready*\n' +
                        '┃ 👑 *Owner:* ' + OWNER_NAME + '\n' +
                        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯';
                    await this.notifyTg(msgCard);
                    if (this.notifyWaFn) {
                        try { await this.notifyWaFn(msgCard); } catch {}
                        this.notifyWaFn = null;
                    }
                }
            }
            if (connection === 'close') {
                this.connected = false;
                closedEarly = true;
                if (qrReadyResolve) {
                    qrReadyResolve('closed');
                    qrReadyResolve = null;
                }
                if (this._keepAlive) clearInterval(this._keepAlive);
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errMsg = lastDisconnect?.error?.message || '';
                const isRegistered = Boolean(this.sock?.authState?.creds?.registered);
                const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
                const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
                console.log('[SESSION +' + this.phoneKey + '] Closed | status:', statusCode || 'unknown', '| registered:', isRegistered, '| msg:', errMsg);

                if (statusCode === 405) {
                    cachedBaileysVersion = null;
                    cachedBaileysTs = 0;
                }

                await this._credsQueue.catch(() => {});
                try { this.sock?.ev?.removeAllListeners(); } catch {}

                if (this.stopped || isLoggedOut) {
                    if (!this.stopped && isLoggedOut) {
                        this.lastError = 'Logged out or pairing rejected (code 401) — click Reset & request a new code';
                        await this.notifyTg('❌ *+' + this.phoneKey + ' has been logged out!* Send your phone number again to pair.');
                    }
                    try { fs.rmSync(this.authPath, { recursive: true, force: true }); } catch {}
                    if (sessions[this.phoneKey] === this) delete sessions[this.phoneKey];
                } else {
                    this._reconnectCount = (this._reconnectCount || 0) + 1;
                    if (!isRegistered && this._reconnectCount > 8) {
                        this.lastError = 'WhatsApp closed pairing connection (code ' + (statusCode || 'timeout') + ') — click Reset & try again';
                        if (this._pendingPair && !this.lastPairingCode && typeof activeCallback === 'function') {
                            await activeCallback(new Error(this.lastError), null, null);
                            this._pendingPair = false;
                        }
                        try { fs.rmSync(this.authPath, { recursive: true, force: true }); } catch {}
                        if (sessions[this.phoneKey] === this) delete sessions[this.phoneKey];
                        return;
                    }
                    const shouldRetryPairCode = Boolean(
                        this._pendingPair && !this.lastPairingCode && !isRegistered
                    );
                    const delay = isRestartRequired ? 900 : Math.min(2000 * this._reconnectCount, 20000);
                    setTimeout(() => {
                        if (!this.stopped) this.start(shouldRetryPairCode, activeCallback);
                    }, delay);
                }
            }
        });

        if (requestCode && !this.sock.authState.creds.registered) {
            const readyState = await qrReadyPromise;
            if (this.stopped || closedEarly || readyState === 'closed') {
                // Socket closed before pairing code could be requested; reconnect handler above will retry if eligible
                return;
            }
            await new Promise(r => setTimeout(r, 900));
            const CUSTOM_PAIR_CODE = 'ASADMD11';
            let code = null;
            let lastErr = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    if (this.stopped || closedEarly) return;
                    code = await this.sock.requestPairingCode(this.phoneKey, CUSTOM_PAIR_CODE);
                    if (code) break;
                } catch (e) {
                    lastErr = e;
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

            if (code) {
                const rawCode = String(code).trim().toUpperCase();
                const formattedCode = rawCode.length === 8 ? (rawCode.slice(0, 4) + '-' + rawCode.slice(4)) : rawCode;
                this.lastPairingCode = formattedCode;
                this._pendingPair = false;
                if (typeof activeCallback === 'function') {
                    await activeCallback(null, rawCode, formattedCode);
                    this._pendingCallback = null;
                }
                await this.notifyTg(
                    '╭━━〔 🔑 *WHATSAPP PAIRING CODE* 〕━━╮\n' +
                    '┃ 📱 *Number:* +' + this.phoneKey + '\n' +
                    '┃ 🔐 *Code:* `' + formattedCode + '`\n' +
                    '┃ 📋 *Copy:* `' + rawCode + '`\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
                    '*How to Link in WhatsApp:*\nSettings ▶ Linked Devices ▶ Link a Device ▶ *Link with phone number* ▶ Enter Code: `' + rawCode + '`'
                );
            } else if (!closedEarly) {
                const err = lastErr || new Error('Could not generate pairing code — please try again');
                this._pendingPair = false;
                this.lastError = err.message;
                if (typeof activeCallback === 'function') {
                    await activeCallback(err, null, null);
                    this._pendingCallback = null;
                }
                await this.notifyTg('❌ Error (+' + this.phoneKey + '): ' + err.message);
            }
        }
        } finally {
            this._starting = false;
        }

        // Anti-Call & Auto-Block handler (strictly per-session & opt-in)
        this.sock.ev.on('call', async (calls) => {
            const auto = this.loadSessionConfig().AUTO || {};
            if (auto.antiCall !== true && auto.autoBlock !== true) return;
            for (const c of calls) {
                if (c.status === 'offer') {
                    if (auto.antiCall === true) {
                        try { await this.sock.rejectCall(c.id, c.from); } catch {}
                    }
                    if (auto.autoBlock === true && c.from) {
                        try { await this.sock.updateBlockStatus(c.from, 'block'); } catch {}
                    }
                }
            }
        });

        // Anti-Delete handler (strictly per-session when enabled — supports text + all media)
        this.sock.ev.on('messages.update', async (updates) => {
            const auto = this.loadSessionConfig().AUTO || {};
            if (auto.antiDelete !== true) return;
            for (const u of updates) {
                const protoMsg = u.update?.message?.protocolMessage;
                const isRevoked = u.update?.messageStubType === 68 || protoMsg?.type === 0 || (u.update && u.update.message === null);
                if (!isRevoked) continue;

                const targetId = protoMsg?.key?.id || u.key?.id;
                const cached = targetId ? this.recentMsgs.get(targetId) : null;
                if (!cached || !this.sock?.user?.id) continue;

                this.recentMsgs.delete(targetId);
                const inbox = jidNormalizedUser(this.sock.user.id);
                const senderNum = String(cached.sender || '').split('@')[0].split(':')[0];
                const header = styleBox(
                    'ANTI-DELETE RECOVERED',
                    '│ 👤 *From:* +' + senderNum + '\n│ 💬 *Chat:* ' + cached.from + '\n│ 📝 *Text:* ' + (cached.text || '(Media)')
                );

                await this.sock.sendMessage(inbox, { text: header }).catch(() => {});

                if (cached.rawMsg?.message) {
                    const inner = unwrapContainer(cached.rawMsg.message) || cached.rawMsg.message;
                    const mediaTypes = [
                        { key: 'imageMessage', type: 'image' },
                        { key: 'videoMessage', type: 'video' },
                        { key: 'audioMessage', type: 'audio' },
                        { key: 'stickerMessage', type: 'sticker' },
                        { key: 'documentMessage', type: 'document' }
                    ];
                    for (const m of mediaTypes) {
                        if (inner[m.key]) {
                            try {
                                const stream = await downloadContentFromMessage(inner[m.key], m.type);
                                const chunks = [];
                                for await (const c of stream) chunks.push(c);
                                const buf = Buffer.concat(chunks);
                                await this.sock.sendMessage(inbox, {
                                    [m.type]: buf,
                                    caption: inner[m.key].caption || ('🗑️ Deleted ' + m.type + ' from +' + senderNum),
                                    ...(m.type === 'document' ? { mimetype: inner[m.key].mimetype || 'application/octet-stream', fileName: inner[m.key].fileName || 'recovered_file' } : {})
                                });
                            } catch {}
                            break;
                        }
                    }
                }
            }
        });

        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            const isNotify = !type || type === 'notify';

            for (const msg of messages) {
                try {
                    const from = msg?.key?.remoteJid;
                    if (!from) continue;

                    const isNewsletter = from.endsWith('@newsletter');
                    if (!isNotify && !isNewsletter) continue;

                    // Deduplicate per session & skip stale backlog messages (>180s old)
                    if (msg.key?.id && this.markProcessed(msg.key.id)) continue;
                    const msgTs = Number(msg.messageTimestamp || 0);
                    if (msgTs > 0 && msgTs < Math.floor(Date.now() / 1000) - 180) continue;

                    if (msg.message && msg.key?.id) rememberMessage(msg.key.id, msg.message);

                    const S = this.sock;
                    const cfg = this.loadSessionConfig();
                    const auto = cfg.AUTO || {};
                    const prefix = cfg.PREFIX || '.';
                    const botJid = S.user?.id ? jidNormalizedUser(S.user.id) : (this.phoneKey + '@s.whatsapp.net');
                    const botPn  = S.user?.id ? jidNormalizedUser(S.user.id).split('@')[0].split(':')[0] : this.phoneKey;
                    const botLid = S.user?.lid ? jidNormalizedUser(S.user.lid) : '';
                    const botLidN = botLid ? botLid.split('@')[0].split(':')[0] : '';

                    // 1. WhatsApp Channel (@newsletter): Auto-React on posts AND execute bot commands posted in Channels!
                    let isChannelAdmin = false;
                    if (isNewsletter) {
                        const innerNl = msg.message ? (unwrapContainer(msg.message) || msg.message) : null;
                        if (innerNl && (innerNl.reactionMessage || innerNl.protocolMessage)) continue;

                        const nlText = msg.message ? extractText(msg.message) : '';
                        const nlIsCmd = Boolean(nlText && nlText.trim().startsWith(prefix));

                        if (auto.autoChannelReact !== false && !nlIsCmd) {
                            const em = pickAutoReactEmoji(auto, this.phoneKey + ':channel');
                            const serverId = String(msg.key?.server_id || msg.newsletterServerId || msg.key?.id || '');
                            if (typeof S.newsletterReactMessage === 'function' && serverId) {
                                await S.newsletterReactMessage(from, serverId, em).then(() => {
                                    console.log('[CHANNEL REACT +' + this.phoneKey + ']', from, 'post=' + serverId, 'emoji=' + em);
                                }).catch(async (err) => {
                                    console.log('[CHANNEL REACT WARN +' + this.phoneKey + ']', err?.message || err);
                                    await S.sendMessage(from, { react: { text: em, key: msg.key } }).catch(() => {});
                                });
                            } else {
                                await S.sendMessage(from, { react: { text: em, key: msg.key } }).catch(() => {});
                            }
                        }

                        if (!msg.message || !nlIsCmd) continue;

                        // Verify viewer role inside channel so bot admin/owner commands work seamlessly in Channels
                        try {
                            const cachedRole = newsletterRoleCache.get(this.phoneKey + ':' + from);
                            if (cachedRole && Date.now() - cachedRole.ts < 5 * 60 * 1000) {
                                isChannelAdmin = cachedRole.admin;
                            } else if (typeof S.newsletterMetadata === 'function') {
                                const nlMeta = await S.newsletterMetadata('jid', from).catch(() => null);
                                const role = nlMeta?.viewer_metadata?.role || '';
                                isChannelAdmin = ['OWNER', 'ADMIN'].includes(String(role).toUpperCase());
                                newsletterRoleCache.set(this.phoneKey + ':' + from, { admin: isChannelAdmin, ts: Date.now() });
                            }
                        } catch {}
                    }

                    // 2. Auto-Status View / Auto-Like (non-repeating ALL Emojis)
                    if (from === 'status@broadcast') {
                        if (auto.autoStatusView === true) { try { await S.readMessages([msg.key]); } catch {} }
                        if (auto.autoStatusReact === true && msg.key?.participant) {
                            const em = pickAutoReactEmoji(auto, this.phoneKey + ':status');
                            const statusParticipants = Array.from(new Set([msg.key.participant, botJid].filter(Boolean)));
                            try {
                                await S.sendMessage(
                                    'status@broadcast',
                                    { react: { text: em, key: msg.key } },
                                    { statusJidList: statusParticipants }
                                );
                            } catch {}
                        }
                        if (auto.statusReplyText && msg.key?.participant) {
                            try { await S.sendMessage(msg.key.participant, { text: auto.statusReplyText }, { quoted: msg }); } catch {}
                        }
                        continue;
                    }

                    if (!msg.message) continue;

                    // Ignore system stubs so bot never loops/reacts to protocol stubs
                    const innerMsg = unwrapContainer(msg.message) || msg.message;
                    if (innerMsg.protocolMessage || innerMsg.senderKeyDistributionMessage || innerMsg.reactionMessage || innerMsg.pollUpdateMessage) {
                        continue;
                    }

                    const isGroup  = from.endsWith('@g.us');
                    const isFromMe = Boolean(msg.key.fromMe);
                    const sender   = msg.key.participantAlt || msg.key.participant || msg.key.participantLid || from;
                    const senderN  = sender.split('@')[0].split(':')[0];
                    const senderNorm = jidNormalizedUser(sender);
                    const text     = extractText(msg.message);

                    if (!isGroup && !isNewsletter) this.knownDms.add(from);

                    if (msg.key?.id && auto.antiDelete === true && !isNewsletter && !isFromMe) {
                        this.recentMsgs.set(msg.key.id, { from, sender, text, rawMsg: msg });
                        if (this.recentMsgs.size > 500) this.recentMsgs.delete(this.recentMsgs.keys().next().value);
                    }

                    // Always cache View-Once silently so .vv works even after viewing; auto-forward ONLY when antiViewOnce === true
                    if (!isNewsletter) {
                        cacheIncomingViewOnce(msg, this.cacheDir, auto.antiViewOnce === true ? S : null, botJid, downloadContentFromMessage);
                    }

                    // Auto-Read / Auto-Presence
                    if (!isNewsletter && auto.autoRead === true && !isFromMe) { try { await S.readMessages([msg.key]); } catch {} }
                    if (!isNewsletter && auto.autoTyping === true && !isFromMe) { try { await S.sendPresenceUpdate('composing', from); } catch {} }
                    else if (!isNewsletter && auto.autoRecording === true && !isFromMe) { try { await S.sendPresenceUpdate('recording', from); } catch {} }

                    // Non-Repeating ALL-EMOJI Auto-React: Works in DMs, Regular Groups, AND "Only Admins Can Message" Groups!
                    if (!isNewsletter && auto.autoReact === true && !isFromMe) {
                        const em = pickAutoReactEmoji(auto, this.phoneKey + ':chat:' + from);
                        const reactKey = {
                            remoteJid: from,
                            fromMe: Boolean(msg.key.fromMe),
                            id: msg.key.id,
                            ...(isGroup ? { participant: msg.key.participant || sender } : {})
                        };
                        await S.sendMessage(from, { react: { text: em, key: reactKey } }).catch(async () => {
                            await S.sendMessage(from, { react: { text: em, key: msg.key } }).catch(() => {});
                        });
                    }

                    // Group Metadata (LID + phoneNumber safe + cached 60s)
                    let meta = null, admins = [], botAdmin = false, isAdmin = false, allJids = [], groupSenderPn = '';
                    const senderAltNorm = msg.key.participantAlt ? jidNormalizedUser(msg.key.participantAlt) : '';
                    const senderLidNorm = msg.key.participantLid ? jidNormalizedUser(msg.key.participantLid) : '';
                    if (isGroup) {
                        try {
                            const cachedMeta = groupMetaCache.get(from);
                            meta = (cachedMeta && Date.now() - cachedMeta.ts < 60000)
                                ? cachedMeta.data
                                : await S.groupMetadata(from);
                            if (meta) groupMetaCache.set(from, { data: meta, ts: Date.now() });
                            const senderEntry = meta.participants.find(p => {
                                const pid = jidNormalizedUser(p.id || '');
                                const plid = p.lid ? jidNormalizedUser(p.lid) : '';
                                const ppn = p.phoneNumber ? jidNormalizedUser(p.phoneNumber) : '';
                                return pid === senderNorm || plid === senderNorm || ppn === senderNorm ||
                                    (senderAltNorm && (pid === senderAltNorm || ppn === senderAltNorm)) ||
                                    (senderLidNorm && (pid === senderLidNorm || plid === senderLidNorm));
                            });
                            if (senderEntry?.phoneNumber) {
                                groupSenderPn = jidNormalizedUser(senderEntry.phoneNumber).split('@')[0].split(':')[0];
                            }
                            admins = meta.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin' || Boolean(p.admin));
                            botAdmin = admins.some(a => {
                                const aid  = jidNormalizedUser(a.id || '');
                                const alid = a.lid ? jidNormalizedUser(a.lid) : '';
                                const apn  = a.phoneNumber ? jidNormalizedUser(a.phoneNumber) : '';
                                const aidN = aid ? aid.split('@')[0].split(':')[0] : '';
                                const alidN = alid ? alid.split('@')[0].split(':')[0] : '';
                                const apnN = apn ? apn.split('@')[0].split(':')[0] : '';
                                return aid === botJid || apn === botJid ||
                                    aidN === botPn || aidN === this.phoneKey ||
                                    apnN === botPn || apnN === this.phoneKey ||
                                    (botLid && (aid === botLid || alid === botLid)) ||
                                    (botLidN && (aidN === botLidN || alidN === botLidN));
                            });
                            allJids = meta.participants.map(p => p.id);
                        } catch {}
                    }

                    // Per-session Owner isolation: ONLY this paired WhatsApp session & its own sessionCfg.OWNER_NUMBER!
                    const sessionOwner = String(cfg.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
                    const senderAltN = senderAltNorm ? senderAltNorm.split('@')[0].split(':')[0] : '';
                    const senderLidN = senderLidNorm ? senderLidNorm.split('@')[0].split(':')[0] : '';
                    const isSelfChat = from === botJid || (botLid && from === botLid) || from.split('@')[0].split(':')[0] === this.phoneKey;
                    const isOwner = isFromMe || isSelfChat || isChannelAdmin ||
                        senderN === this.phoneKey || senderN === botPn ||
                        (groupSenderPn && (groupSenderPn === this.phoneKey || groupSenderPn === botPn || (sessionOwner && groupSenderPn === sessionOwner))) ||
                        (senderAltN && (senderAltN === this.phoneKey || senderAltN === botPn || (sessionOwner && senderAltN === sessionOwner))) ||
                        (botLid && (senderNorm === botLid || senderLidNorm === botLid || (botLidN && (senderN === botLidN || senderLidN === botLidN)))) ||
                        (sessionOwner && (senderN === sessionOwner || senderAltN === sessionOwner));

                    if (isGroup && meta) {
                        isAdmin = isOwner || admins.some(a => {
                            const aid  = jidNormalizedUser(a.id || '');
                            const alid = a.lid ? jidNormalizedUser(a.lid) : '';
                            const apn  = a.phoneNumber ? jidNormalizedUser(a.phoneNumber) : '';
                            const aidN = aid ? aid.split('@')[0].split(':')[0] : '';
                            const apnN = apn ? apn.split('@')[0].split(':')[0] : '';
                            return aid === senderNorm || alid === senderNorm || apn === senderNorm ||
                                aidN === senderN || apnN === senderN ||
                                (senderAltNorm && (aid === senderAltNorm || ppnMatch(apn, senderAltNorm))) ||
                                (senderLidNorm && (aid === senderLidNorm || alid === senderLidNorm));
                        });
                    }
                    function ppnMatch(a, b) { return a && b && a === b; }

                    const trimmed = text.trim();
                    const isCommand = trimmed.startsWith(prefix);

                    if (isCommand) {
                        const mode = cfg.MODE === 'private' ? 'private' : 'public';
                        if (mode === 'private' && !isOwner) continue;

                        const banned = Array.isArray(cfg.BANNED_USERS) ? cfg.BANNED_USERS : [];
                        if (!isOwner && banned.includes(jidNormalizedUser(sender))) continue;

                        const body = trimmed.slice(prefix.length).trim();
                        const spaceIdx = body.search(/\s/);
                        const cmdName = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).toLowerCase();
                        const argStr = spaceIdx === -1 ? '' : body.slice(spaceIdx + 1).trim();

                        if (!cmdName) continue;

                        const sessionOffCmds = Array.isArray(cfg.DISABLED_COMMANDS) ? cfg.DISABLED_COMMANDS : [];
                        if (sessionOffCmds.includes(cmdName) && !['cmdon', 'cmdoff', 'enableall', 'menu', 'help', 'alive'].includes(cmdName)) {
                            await S.sendMessage(from, {
                                text: '⚙️ *' + prefix + cmdName + '* is currently OFF on your bot.\nTurn it back ON with: *' + prefix + 'cmdon ' + cmdName + '*'
                            }, { quoted: msg }).catch(() => {});
                            continue;
                        }

                        const qInfo = getQuotedInfo(msg);
                        const quotedMedia = qInfo?.quotedMessage ? detectQuotedMedia(qInfo.quotedMessage) : null;
                        const quotedText = qInfo?.quotedMessage ? extractText(qInfo.quotedMessage) : '';

                        const cmdSock = new Proxy(S, {
                            get(target, prop) {
                                if (prop === 'sendMessage') {
                                    return async (j, content, opts) => {
                                        const isChTarget = String(j || '').endsWith('@newsletter');
                                        let finalContent = content;
                                        let finalOpts = opts;
                                        if (finalContent && typeof finalContent === 'object' && !finalContent.react && !finalContent.delete && !isChTarget) {
                                            const localDp = path.join(__dirname, cfg.DEFAULT_DP || 'assets/bot_dp.jpg');
                                            const dpBuf = fs.existsSync(localDp) ? fs.readFileSync(localDp) : null;
                                            const defaultCtx = getViewChannelContext(cfg, dpBuf, j, this);
                                            finalContent = {
                                                ...finalContent,
                                                contextInfo: {
                                                    ...defaultCtx,
                                                    ...(finalContent.contextInfo || {})
                                                }
                                            };
                                        }
                                        if (isChTarget) {
                                            // WhatsApp Channels reject reply quotes & message edits; send clean channel posts
                                            finalOpts = undefined;
                                            if (finalContent && typeof finalContent === 'object' && content.edit) {
                                                const { edit, ...rest } = finalContent;
                                                finalContent = rest;
                                            }
                                        }
                                        let res;
                                        try {
                                            res = await target.sendMessage(j, finalContent, finalOpts);
                                        } catch (sendErr) {
                                            if (isChTarget && finalContent?.contextInfo) {
                                                const { contextInfo, ...cleanContent } = finalContent;
                                                res = await target.sendMessage(j, cleanContent);
                                            } else if (finalOpts?.quoted) {
                                                res = await target.sendMessage(j, finalContent);
                                            } else {
                                                throw sendErr;
                                            }
                                        }
                                        if (auto.autoDelete === true && cfg.AUTO_DEL_SECONDS > 0 && res?.key?.id && !finalContent?.react && !finalContent?.delete) {
                                            setTimeout(() => {
                                                target.sendMessage(j, { delete: res.key }).catch(() => {});
                                            }, Number(cfg.AUTO_DEL_SECONDS) * 1000);
                                        }
                                        return res;
                                    };
                                }
                                const v = target[prop];
                                return typeof v === 'function' ? v.bind(target) : v;
                            }
                        });

                        const cmdCtx = {
                            sock: cmdSock, from, msg, sender, senderN, cmdName, argStr,
                            isOwner, isGroup, isAdmin, botAdmin, isFromMe, isNewsletter,
                            meta, admins, allJids, warns: this.warns, knownDms: this.knownDms,
                            botJid, botPn,
                            cfg,
                            loadConfig: () => this.loadSessionConfig(),
                            saveConfig: (nextCfg) => this.saveSessionConfig(nextCfg),
                            getBotImgPayload: (cap, incVc = false, tj = '') => getBotImgPayload(cap, incVc, tj, this.loadSessionConfig(), this),
                            getMenuText: () => getMenuText(this.loadSessionConfig()),
                            getAllMenuText: () => getAllMenuText(this.loadSessionConfig()),
                            getAllMenuChunks: () => getAllMenuChunks(this.loadSessionConfig()),
                            getListText: () => getListText(this.loadSessionConfig()),
                            styleBox, startWhatsAppPairing,
                            sessions, sessionObj: this,
                            quotedMedia, quotedText,
                            getQuotedInfo: () => qInfo,
                            getQuotedMessageKey: () => qInfo?.stanzaId ? { remoteJid: from, fromMe: false, id: qInfo.stanzaId, participant: qInfo.participant || undefined } : null,
                            downloadQuotedBuffer: async () => {
                                if (!quotedMedia) return null;
                                const stream = await downloadContentFromMessage(quotedMedia.media, quotedMedia.type);
                                const chunks = [];
                                for await (const c of stream) chunks.push(c);
                                return Buffer.concat(chunks);
                            }
                        };

                        try {
                            if (await handleViewOnceCommand({ sock: cmdSock, from, msg, cmdName, argStr, botName: BOT_NAME, inboxJid: botJid, cacheDir: this.cacheDir, downloadFn: downloadContentFromMessage, messageStore })) continue;
                            if (await handleSystemAndAutoCommands(cmdCtx)) continue;
                            if (await handleGroupCommands(cmdCtx)) continue;
                            if (await handleMediaAndDownloaderCommands(cmdCtx)) continue;
                        } catch (cmdErr) {
                            console.log('[CMD ERR .' + cmdName + ']', cmdErr?.message || cmdErr);
                            await cmdSock.sendMessage(from, { text: '❌ Command error (' + prefix + cmdName + '): ' + (cmdErr?.message || 'Try again') }, { quoted: msg }).catch(() => {});
                        }
                        continue;
                    }

                    if (isNewsletter) continue;

                    // ── OPT-IN PRIVATE AUTO FEATURES (Never send unprompted unless explicitly enabled!) ──
                    if (!isGroup && !isFromMe && text) {
                        if (auto.autoReply === true && cfg.AUTO_REPLY_TEXT) {
                            await S.sendMessage(from, { text: cfg.AUTO_REPLY_TEXT }, { quoted: msg }).catch(() => {});
                        } else if (auto.autoAi === true) {
                            const replyAi = '🤖 *' + BOT_NAME + ' Smart Reply:*\nMessage received! Send *' + prefix + 'menu* to explore all 135 commands.';
                            await S.sendMessage(from, { text: replyAi }, { quoted: msg }).catch(() => {});
                        }
                    }

                    if (auto.autoDownload === true && !isFromMe && text) {
                        const dlLink = text.match(/https?:\/\/(?:vt\.tiktok\.com|vm\.tiktok\.com|www\.tiktok\.com|www\.instagram\.com|fb\.watch|www\.facebook\.com)\/\S+/i);
                        if (dlLink) {
                            const urlMatch = dlLink[0];
                            const dlCmd = urlMatch.includes('tiktok') ? 'tiktok' : (urlMatch.includes('instagram') ? 'insta' : 'fb');
                            await handleMediaAndDownloaderCommands({
                                sock: S, from, msg, cmdName: dlCmd, argStr: urlMatch,
                                isOwner, isGroup, isAdmin, botAdmin, isFromMe,
                                cfg, loadConfig: () => this.loadSessionConfig(), saveConfig: (c) => this.saveSessionConfig(c)
                            }).catch(() => {});
                        }
                    }

                    // ── GROUP 17 ANTI MODERATION (non-admin only, strictly opt-in === true) ──
                    if (!isGroup || !botAdmin || isAdmin || isFromMe) continue;

                    const delKey = { remoteJid: from, fromMe: false, id: msg.key.id, participant: msg.key.participant || sender };

                    if (auto.antiBot === true && msg.key?.id && (/^(?:BAE5|3EB0|3AA0)/i.test(msg.key.id))) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        await S.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
                        continue;
                    }

                    if (auto.antiGroup === true && /chat\.whatsapp\.com\//i.test(text)) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        await S.sendMessage(from, { text: '👥 @' + senderN + ' *WhatsApp Group invite links are not allowed here!*', mentions: [sender] });
                        continue;
                    }

                    if (auto.antiLink === true && containsLink(msg.message, text)) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        if (cfg.ANTILINK_ACTION === 'kick') {
                            await S.sendMessage(from, { text: '🚫 @' + senderN + ' *External links are prohibited — Message deleted & user removed!*', mentions: [sender] });
                            await S.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
                        } else {
                            await S.sendMessage(from, { text: '🔗 @' + senderN + ' *External links are not allowed! (Deleted)*', mentions: [sender] });
                        }
                        continue;
                    }

                    if (auto.antiPorn === true && hasPornOrNsfw(text)) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        await S.sendMessage(from, { text: '🔞 @' + senderN + ' *NSFW / Adult content is prohibited!*', mentions: [sender] });
                        continue;
                    }

                    if ((auto.antiToxic === true || auto.antiWord === true) && hasToxicOrBlocked(text, cfg.ANTI_WORDS, auto.antiToxic === true)) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        await S.sendMessage(from, { text: '🤬 @' + senderN + ' *Abusive / Blocked word deleted!*', mentions: [sender] });
                        continue;
                    }

                    if (auto.antiPoll === true && (innerMsg.pollCreationMessage || innerMsg.pollCreationMessageV2 || innerMsg.pollCreationMessageV3)) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        continue;
                    }

                    const ctxInfo = innerMsg.extendedTextMessage?.contextInfo || innerMsg.imageMessage?.contextInfo || innerMsg.videoMessage?.contextInfo;
                    if (auto.antiMention === true && ((ctxInfo?.mentionedJid?.length >= 5) || innerMsg.groupStatusMentionMessage)) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        continue;
                    }

                    if (auto.antiForward === true && (ctxInfo?.isForwarded || (ctxInfo?.forwardingScore || 0) > 0)) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        continue;
                    }

                    if (auto.antiSticker === true && innerMsg.stickerMessage) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        continue;
                    }

                    if (auto.antiMedia === true && (innerMsg.imageMessage || innerMsg.videoMessage || innerMsg.documentMessage)) {
                        await S.sendMessage(from, { delete: delKey }).catch(() => {});
                        continue;
                    }

                    if (auto.antiSpam === true) {
                        const k = from + ':' + sender;
                        const now = Date.now();
                        const rec = this.spamMap.get(k) || { count: 0, ts: now };
                        if (now - rec.ts < 5000) rec.count++; else { rec.count = 1; rec.ts = now; }
                        this.spamMap.set(k, rec);
                        if (rec.count >= 6) {
                            await S.sendMessage(from, { delete: delKey }).catch(() => {});
                            rec.count = 0;
                        }
                    }
                } catch (e) {
                    console.log('Msg Error:', e.message);
                }
            }
        });

        this.sock.ev.on('group-participants.update', async (update) => {
            try {
                const c = this.loadSessionConfig();
                const auto = c.AUTO || {};
                if (update.action === 'add' && (auto.autoWelcome === true || auto.antiFake === true)) {
                    const meta = await this.sock.groupMetadata(update.id);
                    for (const p of update.participants) {
                        if (auto.antiFake === true && p.endsWith('@s.whatsapp.net') && !p.startsWith('92') && !p.startsWith('91')) {
                            await this.sock.groupParticipantsUpdate(update.id, [p], 'remove').catch(() => {});
                            continue;
                        }
                        if (auto.autoWelcome === true) {
                            const tpl = c.WELCOME_TEMPLATE || ('🎉 *Welcome @user to @group!*\n\n🖤 *' + BOT_NAME + '*\n📋 Type *.menu* for 135 commands.');
                            const body = tpl.replace(/@user/g, '@' + p.split('@')[0]).replace(/@group/g, meta.subject);
                            await this.sock.sendMessage(update.id, { ...getBotImgPayload(body, false, update.id, c, this), mentions: [p] });
                        }
                    }
                }
                if (update.action === 'remove' && auto.autoGoodbye === true) {
                    const meta = await this.sock.groupMetadata(update.id);
                    for (const p of update.participants) {
                        const tpl = c.GOODBYE_TEMPLATE || '👋 *Goodbye @user* from @group!';
                        const body = tpl.replace(/@user/g, '@' + p.split('@')[0]).replace(/@group/g, meta.subject);
                        await this.sock.sendMessage(update.id, { text: body, mentions: [p] });
                    }
                }
                if (update.action === 'demote' && auto.autoPromote === true && update.author) {
                    const authorNorm = jidNormalizedUser(update.author);
                    const botNorm = this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : '';
                    if (authorNorm !== botNorm) {
                        await this.sock.groupParticipantsUpdate(update.id, update.participants, 'promote').catch(() => {});
                    }
                }
                if (update.action === 'promote' && auto.autoDemote === true && update.author) {
                    const authorNorm = jidNormalizedUser(update.author);
                    const botNorm = this.sock?.user?.id ? jidNormalizedUser(this.sock.user.id) : '';
                    if (authorNorm !== botNorm) {
                        await this.sock.groupParticipantsUpdate(update.id, update.participants, 'demote').catch(() => {});
                    }
                }
            } catch {}
        });
    }
}

function restoreExistingSessions() {
    const base = path.join(__dirname, 'sessions');
    if (!fs.existsSync(base)) return;
    let idx = 0;
    for (const entry of fs.readdirSync(base)) {
        const credsFile = path.join(base, entry, 'creds.json');
        if (!fs.existsSync(credsFile)) continue;
        try {
            const parsed = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
            if (!parsed?.me?.id && !parsed?.registered) continue;
        } catch {
            continue;
        }
        const delayMs = idx * 1200;
        idx++;
        setTimeout(() => {
            console.log('[RESTORE] Loading paired session +' + entry);
            sessions[entry] = new Session(entry, null);
            sessions[entry].start(false).catch(() => {});
        }, delayMs);
    }
}

async function startWhatsAppPairing(phone, onCodeCallback, notifyChatJid = null) {
    const clean = normalizePhoneInput(phone);
    if (clean.length < 10 || clean.length > 15 || clean.startsWith('0')) {
        const err = new Error('Invalid phone number — enter 10–15 digits with country code (e.g. 923001234567)');
        if (typeof onCodeCallback === 'function') await onCodeCallback(err, null, null);
        return { error: err.message };
    }
    if (sessions[clean]?.connected) {
        return { alreadyConnected: true, phone: clean };
    }
    if (sessions[clean]) {
        await sessions[clean].stopAndCleanup(true);
        delete sessions[clean];
    } else {
        try { fs.rmSync(path.join(__dirname, 'sessions', clean), { recursive: true, force: true }); } catch {}
    }

    const notifyWaFn = notifyChatJid
        ? async (cardText) => {
            const activeSock = Object.values(sessions).find(s => s.connected && s.sock)?.sock;
            if (activeSock) await activeSock.sendMessage(notifyChatJid, { text: cardText });
        }
        : null;

    sessions[clean] = new Session(clean, null, notifyWaFn);
    await sessions[clean].start(true, onCodeCallback);
    return { started: true, phone: clean };
}

async function startPhonePairing(chatId, rawPhone) {
    const phone = normalizePhoneInput(rawPhone);
    if (phone.length < 10 || phone.length > 15 || phone.startsWith('0')) {
        if (tgBot) await tgBot.sendMessage(chatId, '📱 *Pair Guide:* Enter your WhatsApp number with country code.\nExample: `923001234567`', { parse_mode: 'Markdown' });
        return;
    }
    if (sessions[phone]?.connected) {
        if (tgBot) await tgBot.sendMessage(chatId, '✅ *+' + phone + '* is already connected!', { parse_mode: 'Markdown' });
        return;
    }
    if (sessions[phone]) {
        await sessions[phone].stopAndCleanup(true);
        delete sessions[phone];
    } else {
        try { fs.rmSync(path.join(__dirname, 'sessions', phone), { recursive: true, force: true }); } catch {}
    }
    if (tgBot) await tgBot.sendMessage(chatId, '⏳ *Connecting to WhatsApp...*\n📱 Number: *+' + phone + '*\n🔑 Custom Code: *ASAD-MD11*\n\nYour pairing code will arrive in 4–10 seconds...', { parse_mode: 'Markdown' });
    sessions[phone] = new Session(phone, chatId);
    await sessions[phone].start(true);
}

// ── Force-Join Channel Gate Config ────────────────
const VERIFIED_FILE = path.join(__dirname, 'sessions', 'verified_tg_users.json');
function loadVerifiedSet() {
    try { return new Set(JSON.parse(fs.readFileSync(VERIFIED_FILE, 'utf8'))); } catch { return new Set(); }
}
function saveVerifiedSet(set) {
    try { fs.writeFileSync(VERIFIED_FILE, JSON.stringify([...set])); } catch {}
}
const verifiedTgUsers = loadVerifiedSet();

function getChannelGateConfig() {
    const cfg = loadConfig();
    const enabled = cfg.FORCE_JOIN_ENABLED !== false;
    const link = String(process.env.FORCE_CHANNEL_LINK || cfg.FORCE_CHANNEL_LINK || cfg.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim();
    let targetId = String(process.env.FORCE_CHANNEL_ID || cfg.FORCE_CHANNEL_ID || '').trim();
    if (!targetId && link) {
        const m = link.match(/t\.me\/([A-Za-z0-9_]{4,})/i);
        if (m && !m[1].startsWith('+')) targetId = '@' + m[1];
    }
    return { enabled: Boolean(enabled && (link || targetId)), link: link || (targetId.startsWith('@') ? 'https://t.me/' + targetId.slice(1) : ''), targetId };
}

async function isUserJoinedChannel(userId, forceRecheck = false) {
    const gate = getChannelGateConfig();
    if (!gate.enabled) return { ok: true, gate };

    if (gate.targetId && tgBot) {
        try {
            const member = await tgBot.getChatMember(gate.targetId, userId);
            if (['creator', 'administrator', 'member', 'restricted'].includes(member?.status)) {
                verifiedTgUsers.add(String(userId));
                saveVerifiedSet(verifiedTgUsers);
                return { ok: true, gate };
            }
            if (['left', 'kicked'].includes(member?.status)) {
                verifiedTgUsers.delete(String(userId));
                saveVerifiedSet(verifiedTgUsers);
                return { ok: false, gate, reason: 'not_member' };
            }
        } catch {}
    }

    if (forceRecheck) {
        verifiedTgUsers.add(String(userId));
        saveVerifiedSet(verifiedTgUsers);
        return { ok: true, gate };
    }
    return { ok: verifiedTgUsers.has(String(userId)), gate };
}

async function sendForceJoinPrompt(chatId, gate, pendingPhone = '') {
    if (!tgBot) return;
    const joinBtnUrl = gate.link || DEFAULT_WA_CHANNEL_LINK;
    const buttons = [
        [{ text: '📢 View & Join Official Channel', url: joinBtnUrl }],
        [{ text: '✅ Joined! Verify & Pair', callback_data: 'verify_join:' + (pendingPhone || '') }]
    ];
    await tgBot.sendMessage(
        chatId,
        '╭━━〔 🔒 *CHANNEL VERIFICATION* 〕━━╮\n' +
        '┃ ⚡ *' + BOT_NAME + '*\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
        '📢 *Please join our official channel before pairing!*\n\n' +
        '1️⃣ Tap *View & Join Official Channel* below\n' +
        '2️⃣ Follow/Join the channel\n' +
        '3️⃣ Tap *Joined! Verify & Pair* to unlock pairing!',
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons }
        }
    );
}

// ── Telegram Stylish Multi-User Pairing Bot ────────────────
const awaitingPhoneUsers = new Set();

function buildTgStylishMenuCard() {
    const waCh = String(loadConfig().WA_CHANNEL_LINK || process.env.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim();
    return (
        '✦ ━━━━━━━━━━━━━━━━━━━━━ ✦\n' +
        '   👑 *' + BOT_NAME + '* — COMMANDS\n' +
        '   📦 *135 ACTIVE COMMANDS*\n' +
        '✦ ━━━━━━━━━━━━━━━━━━━━━ ✦\n\n' +
        '╭─「 👑 *OWNER & SYSTEM* 」\n' +
        '┃ • `.menu`  • `.alive`  • `.ping`\n' +
        '┃ • `.mode private|public`  • `.private`\n' +
        '┃ • `.chreact`  • `.pair`  • `.setpp`\n' +
        '╰──────────────────────◈\n' +
        '╭─「 🛡️ *ANTI & VIEW-ONCE* 」\n' +
        '┃ • `.vv` (Private Inbox Unlock)\n' +
        '┃ • `.antivv`  • `.antilink`  • `.antidelete`\n' +
        '╰──────────────────────◈\n' +
        '╭─「 📥 *DOWNLOADER* 」\n' +
        '┃ • `.play`  • `.song`  • `.video`\n' +
        '┃ • `.tiktok`  • `.insta`  • `.fb`\n' +
        '╰──────────────────────◈\n' +
        '╭─「 ⚡ *AUTO SUITE* 」\n' +
        '┃ • `.autoreact all` (140+ Emojis)\n' +
        '┃ • `.autostatus`  • `.autolike`\n' +
        '╰──────────────────────◈\n\n' +
        '📢 *View Channel:*\n' + waCh
    );
}

function getPublicPairUrl(req = null) {
    const envUrl = String(process.env.PUBLIC_PAIR_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
    if (envUrl) return envUrl;
    if (req && req.headers && req.headers.host) {
        const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const scheme = protoHeader || (String(req.headers.host).includes('onrender.com') ? 'https' : 'http');
        return scheme + '://' + req.headers.host;
    }
    return '';
}

async function sendStylishTgHome(chatId, gate) {
    if (!tgBot) return;
    const waCh = String(loadConfig().WA_CHANNEL_LINK || process.env.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim();
    const chUrl = gate?.link || waCh;
    const pairSiteUrl = getPublicPairUrl();
    const connectedCount = Object.values(sessions).filter(s => s.connected).length;
    const keyboard = [
        [{ text: '🔑 Pair WhatsApp Number', callback_data: 'tg_pair_prompt' }],
        ...(pairSiteUrl ? [[{ text: '🌐 Open Web Pair Site', url: pairSiteUrl }]] : []),
        [
            { text: '📜 Stylish Menu', callback_data: 'tg_menu' },
            { text: '📊 Active Sessions', callback_data: 'tg_status' }
        ],
        [
            { text: '🔌 Unpair Session', callback_data: 'tg_unpair_help' },
            { text: '❓ Quick Guide', callback_data: 'tg_guide' }
        ],
        [{ text: '📢 View Official Channel', url: chUrl }]
    ];
    await tgBot.sendMessage(chatId,
        '╔════════════════════════════╗\n' +
        '║    ⚡ *' + BOT_NAME + '* ⚡\n' +
        '║   _Multi-User WhatsApp MD_\n' +
        '╚════════════════════════════╝\n\n' +
        '╭─「 ✨ *PAIRING CONTROL PANEL* 」\n' +
        '┃ 👑 *Developer:* ' + OWNER_NAME + '\n' +
        '┃ 📦 *Commands:* 135 All Active\n' +
        '┃ 🔐 *Pair Code:* `ASADMD11`\n' +
        '┃ 🌐 *Connected:* ' + connectedCount + ' Session(s)\n' +
        '┃ 📺 *Channel:* Auto-Follow & React\n' +
        '╰────────────────────────────◈\n\n' +
        '📱 *Send your WhatsApp number directly with country code:*\n' +
        'Example: `923001234567`\n\n' +
        'Or choose an option below 👇',
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        }
    );
}

function initTelegramBot() {
    if (!hasRealTgToken) {
        console.log('ℹ️ TELEGRAM_BOT_TOKEN not set — Running Web Pairing Site + WhatsApp .pair mode!');
        return;
    }
    try {
        tgBot = new TelegramBot(TG_TOKEN, { polling: true });
        tgBot.on('polling_error', (err) => {
            console.log('[TG POLLING]', err?.message || err);
        });
    } catch (e) {
        console.log('[TG INIT WARN]', e.message);
        tgBot = null;
        return;
    }
    if (tgBot) {
    tgBot.on('callback_query', async (query) => {
        const data = String(query.data || '');
        const chatId = query.message?.chat?.id?.toString();
        const userId = query.from?.id;
        if (!chatId || !userId) return;

        if (data.startsWith('verify_join:')) {
            const pendingPhone = data.split(':')[1] || '';
            const check = await isUserJoinedChannel(userId, true);
            if (!check.ok) {
                await tgBot.answerCallbackQuery(query.id, {
                    text: '❌ You have not joined the channel yet! Please tap View & Join Official Channel first.',
                    show_alert: true
                }).catch(() => {});
                return;
            }
            await tgBot.answerCallbackQuery(query.id, { text: '✅ Verified! Pairing unlocked.' }).catch(() => {});
            if (pendingPhone && pendingPhone.length >= 10) {
                await startPhonePairing(chatId, pendingPhone);
            } else {
                awaitingPhoneUsers.add(chatId);
                await sendStylishTgHome(chatId, check.gate);
            }
            return;
        }

        if (data === 'tg_pair_prompt') {
            await tgBot.answerCallbackQuery(query.id).catch(() => {});
            const check = await isUserJoinedChannel(userId);
            if (!check.ok) {
                await sendForceJoinPrompt(chatId, check.gate, '');
                return;
            }
            awaitingPhoneUsers.add(chatId);
            await tgBot.sendMessage(
                chatId,
                '╭━━〔 🔑 *ENTER WHATSAPP NUMBER* 〕━━╮\n' +
                '┃ Send your number with country code:\n' +
                '┃ Example: `923001234567`\n' +
                '┃ Pair Code: `ASAD-MD11`\n' +
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
                { parse_mode: 'Markdown', reply_markup: { force_reply: true } }
            );
            return;
        }

        if (data === 'tg_menu') {
            await tgBot.answerCallbackQuery(query.id).catch(() => {});
            const waCh = String(loadConfig().WA_CHANNEL_LINK || process.env.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim();
            await tgBot.sendMessage(chatId, buildTgStylishMenuCard(), {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔑 Pair Now', callback_data: 'tg_pair_prompt' }],
                        [{ text: '📢 View Official Channel', url: waCh }]
                    ]
                }
            });
            return;
        }

        if (data === 'tg_guide') {
            await tgBot.answerCallbackQuery(query.id).catch(() => {});
            await tgBot.sendMessage(
                chatId,
                '╭━━〔 ⚡ *' + BOT_NAME + ' GUIDE* 〕━━╮\n' +
                '┃ 1️⃣ Tap *Pair WhatsApp Number* or send `923001234567`\n' +
                '┃ 2️⃣ Open WhatsApp ▶ *Linked Devices* ▶ *Link with phone number*\n' +
                '┃ 3️⃣ Enter code `ASAD-MD11`\n' +
                '┃ 4️⃣ Type *.menu* in your Inbox, Group, or Channel!\n' +
                '┃ 5️⃣ Reply to View-Once media with *.vv* to save privately.\n' +
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        if (data === 'tg_status') {
            await tgBot.answerCallbackQuery(query.id).catch(() => {});
            const all = Object.values(sessions);
            const mine = all.filter(s => s.tgChatId === chatId);
            const mineList = mine.length ? mine.map(s => '• +' + s.phoneKey + ' — ' + (s.connected ? 'Connected ✅' : 'Connecting ⏳')).join('\n') : '_No paired numbers_';
            await tgBot.sendMessage(chatId, '🤖 *' + BOT_NAME + ' Sessions*\n\n*Your Paired Numbers:*\n' + mineList + '\n\n• Total Multi-User Active: *' + all.length + '*', { parse_mode: 'Markdown' });
            return;
        }

        if (data === 'tg_unpair_help') {
            await tgBot.answerCallbackQuery(query.id).catch(() => {});
            await tgBot.sendMessage(chatId, '🔌 To unpair a number, send:\n`/unpair 923001234567`', { parse_mode: 'Markdown' });
        }
    });

    tgBot.onText(/\/(start|menu)/, async (msg) => {
        const id = msg.chat.id.toString();
        const check = await isUserJoinedChannel(msg.from.id);
        if (!check.ok) {
            await sendForceJoinPrompt(id, check.gate, '');
            return;
        }
        await sendStylishTgHome(id, check.gate);
    });

    tgBot.onText(/\/pair(?:\s+(.+))?/, async (msg, match) => {
        const id = msg.chat.id.toString();
        const phone = normalizePhoneInput(match[1] || '');
        const check = await isUserJoinedChannel(msg.from.id);
        if (!check.ok) {
            await sendForceJoinPrompt(id, check.gate, phone);
            return;
        }
        if (phone.length >= 10 && phone.length <= 15) await startPhonePairing(id, phone);
        else await tgBot.sendMessage(id, '📱 *Pair Guide:* Enter your WhatsApp number with country code.\nExample: `923001234567`', { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/unpair(?:\s+(.+))?/, async (msg, match) => {
        const id = msg.chat.id.toString();
        const target = normalizePhoneInput(match[1] || '');
        const mySessions = Object.values(sessions).filter(s => s.tgChatId === id);
        const sessionToRemove = target ? sessions[target] : (mySessions.length === 1 ? mySessions[0] : null);
        if (!sessionToRemove) {
            await tgBot.sendMessage(id, mySessions.length > 1 ? '⚠️ Please specify a phone number: `/unpair 923001234567`' : 'ℹ️ No active session found.', { parse_mode: 'Markdown' });
            return;
        }
        const p = sessionToRemove.phoneKey;
        sessionToRemove.stopped = true;
        try { await sessionToRemove.sock?.logout(); } catch {}
        try { fs.rmSync(sessionToRemove.authPath, { recursive: true, force: true }); } catch {}
        delete sessions[p];
        await tgBot.sendMessage(id, '✅ *+' + p + '* has been unpaired successfully!', { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/(status|list)/, async (msg) => {
        const id = msg.chat.id.toString();
        const all = Object.values(sessions);
        const mine = all.filter(s => s.tgChatId === id);
        const mineList = mine.length ? mine.map(s => '• +' + s.phoneKey + ' — ' + (s.connected ? 'Connected ✅' : 'Connecting ⏳')).join('\n') : '_No paired numbers_';
        await tgBot.sendMessage(id, '🤖 *' + BOT_NAME + ' Status*\n\n*Your Connected Numbers:*\n' + mineList + '\n\n• Total Active Sessions: *' + all.length + '*', { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/setimage (.+)/, async (msg, match) => {
        const id = msg.chat.id.toString();
        const url = match[1].trim();
        const cfg = loadConfig(); cfg.BOT_IMG = url; saveConfig(cfg);
        await tgBot.sendMessage(id, '✅ *Bot banner URL updated!*\n`' + url + '`', { parse_mode: 'Markdown' });
    });

    tgBot.onText(/\/setchannel(?:\s+(.+))?/, async (msg, match) => {
        const id = msg.chat.id.toString();
        const val = (match[1] || '').trim();
        const cfg = loadConfig();
        if (!val || val.toLowerCase() === 'off') {
            cfg.FORCE_JOIN_ENABLED = false;
            saveConfig(cfg);
            await tgBot.sendMessage(id, '🛑 *Force-Join Channel Gate Disabled!*', { parse_mode: 'Markdown' });
            return;
        }
        cfg.FORCE_JOIN_ENABLED = true;
        cfg.FORCE_CHANNEL_LINK = val.startsWith('@') ? ('https://t.me/' + val.slice(1)) : val;
        if (val.startsWith('@')) cfg.FORCE_CHANNEL_ID = val;
        saveConfig(cfg);
        await tgBot.sendMessage(
            id,
            '✅ *Force-Join Channel Updated!*\n🔗 ' + cfg.FORCE_CHANNEL_LINK + '\n\n💡 _Tip: If using a Telegram channel, add this bot as an Admin for instant automatic verification._',
            { parse_mode: 'Markdown' }
        );
    });

    tgBot.onText(/\/help/, async (msg) => {
        const waCh = String(loadConfig().WA_CHANNEL_LINK || process.env.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim();
        const pairSiteUrl = getPublicPairUrl();
        await tgBot.sendMessage(msg.chat.id.toString(),
            '╭━━〔 ⚡ *' + BOT_NAME + ' COMMANDS* 〕━━╮\n' +
            '┃ 📱 Send number directly: `923001234567`\n' +
            '┃ • `/start` or `/menu` — Stylish Control Panel\n' +
            '┃ • `/pair <number>` — Pair WhatsApp (Code: ASADMD11)\n' +
            '┃ • `/status` — Active multi-user sessions\n' +
            '┃ • `/unpair <number>` — Disconnect session\n' +
            '┃ • `/setchannel <link>` — Force-Join Channel\n' +
            '┃ • `/setimage <url>` — Change bot banner\n' +
            '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
            (pairSiteUrl ? '🌐 *Web Pair Site:* ' + pairSiteUrl + '\n' : '') +
            'Type *.menu* in WhatsApp for all 135 active commands.\n📢 *View Channel:* ' + waCh,
            { parse_mode: 'Markdown' }
        );
    });

    tgBot.on('message', async (msg) => {
        const id = msg.chat.id.toString();
        const rawInput = msg.contact?.phone_number || msg.text?.trim() || '';
        if (!rawInput || rawInput.startsWith('/')) return;
        const phone = normalizePhoneInput(rawInput);
        if (phone.length < 10 || phone.length > 15 || phone.startsWith('0')) {
            if (awaitingPhoneUsers.has(id)) {
                awaitingPhoneUsers.delete(id);
                await tgBot.sendMessage(id, '❌ Please send a valid WhatsApp number with country code (e.g. `923001234567`)', { parse_mode: 'Markdown' });
            }
            return;
        }
        awaitingPhoneUsers.delete(id);
        const check = await isUserJoinedChannel(msg.from.id);
        if (!check.ok) {
            await sendForceJoinPrompt(id, check.gate, phone);
            return;
        }
        await startPhonePairing(id, phone);
    });
    }
}

// ── Built-in Multi-User Web Pairing Site (HTTP Server) ─────────────
function readJsonBody(req) {
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
            if (data.length > 64 * 1024) req.destroy();
        });
        req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

function sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

function buildPairSiteHtml(req = null) {
    const gate = getChannelGateConfig();
    const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    const cfg = loadConfig();
    const waChUrl = String(cfg.WA_CHANNEL_LINK || process.env.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim();
    const channelUrl = gate.enabled ? (gate.link || waChUrl) : '';
    const livePairUrl = getPublicPairUrl(req);
    const localDpExists = fs.existsSync(path.join(__dirname, cfg.DEFAULT_DP || 'assets/bot_dp.jpg'));
    const avatarSrc = cfg.BOT_IMAGE_URL ? esc(cfg.BOT_IMAGE_URL) : (localDpExists ? '/bot-dp.jpg' : '');
    const menuDataObj = {
        '👑 Owner': ['.alive', '.ping', '.chreact', '.mode private', '.mode public', '.private', '.public', '.pair', '.broadcast', '.bcgroup', '.restart', '.setprefix'],
        '🛡️ Anti & VV': ['.vv (Inbox)', '.antivv', '.antilink', '.antidelete', '.antisticker', '.antispam', '.anticall', '.antibot', '.warn', '.resetwarn'],
        '👥 Group': ['.allgroupmessage', '.groupinfo', '.open', '.close', '.add', '.kick', '.promote', '.demote', '.tagall', '.hidetag', '.link', '.revoke'],
        '📥 Download': ['.play', '.song', '.video', '.ytmp4', '.tiktok', '.fb', '.insta', '.twitter', '.pinterest', '.terabox', '.apk', '.image', '.google'],
        '⚡ Auto': ['.autoreact all', '.autostatus', '.autolike', '.autoread', '.autotyping', '.autorecording', '.autobio', '.autoai', '.autoreply']
    };
    const menuDataJson = JSON.stringify(menuDataObj).replace(/</g, '\\u003c');
    const html = [
        '<!doctype html><html lang="en"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>' + esc(BOT_NAME) + ' — Multi-User WhatsApp Pairing</title>',
        '<style>',
        '*{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
        ':root{--em:#10b981;--cy:#22d3ee;--bg:#030907;--card:rgba(9,24,19,0.86);--line:rgba(16,185,129,0.24)}',
        'body{margin:0;min-height:100vh;background:var(--bg);color:#ecfdf5;display:flex;align-items:center;justify-content:center;padding:24px 14px;position:relative;overflow-x:hidden}',
        '.bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(16,185,129,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.04) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;z-index:0}',
        '.orb1,.orb2{position:fixed;border-radius:50%;filter:blur(80px);pointer-events:none;z-index:0;opacity:.38}',
        '.orb1{width:340px;height:340px;background:#059669;top:-110px;left:-90px;animation:floatOrb 9s ease-in-out infinite alternate}',
        '.orb2{width:320px;height:320px;background:#0891b2;bottom:-120px;right:-80px;animation:floatOrb 11s ease-in-out infinite alternate-reverse}',
        '@keyframes floatOrb{0%{transform:translate(0,0) scale(1)}100%{transform:translate(28px,24px) scale(1.12)}}',
        '@keyframes pulseDot{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.7)}70%{box-shadow:0 0 0 8px rgba(52,211,153,0)}}',
        '.wrap{position:relative;z-index:1;width:100%;max-width:480px;display:flex;flex-direction:column;gap:16px}',
        '.card{position:relative;width:100%;background:var(--card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--line);border-radius:24px;padding:24px 20px;box-shadow:0 24px 70px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden}',
        '.card::before{content:"";position:absolute;top:0;left:12%;right:12%;height:2px;background:linear-gradient(90deg,transparent,#34d399,#22d3ee,transparent)}',
        '.hero{display:flex;align-items:center;gap:14px;margin-bottom:14px}',
        '.avatar-ring{position:relative;width:58px;height:58px;border-radius:18px;padding:2px;background:linear-gradient(135deg,#34d399,#06b6d4);flex-shrink:0;box-shadow:0 0 22px rgba(16,185,129,.38)}',
        '.avatar-img{width:100%;height:100%;border-radius:16px;object-fit:cover;display:block;background:#071711}',
        '.avatar-fallback{width:100%;height:100%;border-radius:16px;background:linear-gradient(135deg,#064e3b,#0e7490);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff}',
        '.live-dot{position:absolute;bottom:-2px;right:-2px;width:13px;height:13px;border-radius:50%;background:#34d399;border:2px solid #04120d;animation:pulseDot 2s infinite}',
        '.hero-meta{min-width:0;flex:1}',
        '.top-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}',
        '.brand{font-size:20px;font-weight:900;letter-spacing:.5px;margin:0;background:linear-gradient(90deg,#6ee7b7,#34d399,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent}',
        '.tag{font-size:10px;font-weight:800;letter-spacing:.9px;padding:4px 10px;border-radius:999px;background:rgba(16,185,129,.14);border:1px solid rgba(52,211,153,.45);color:#6ee7b7}',
        '.sub{font-size:12px;color:#a7f3d0;margin:4px 0 0;opacity:.82;line-height:1.4}',
        '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}',
        '.statbox{background:rgba(5,16,12,.85);border:1px solid rgba(20,83,61,.65);padding:10px 8px;border-radius:14px;text-align:center}',
        '.statlbl{font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:#6ee7b7;opacity:.8}',
        '.statval{font-size:14px;font-weight:800;color:#fff;margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
        '.gate{background:rgba(11,41,30,.75);border:1px solid #10b981;border-radius:16px;padding:14px;margin-bottom:16px;font-size:13px}',
        '.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:13px 16px;border:0;border-radius:13px;font-weight:800;font-size:14px;cursor:pointer;text-decoration:none;transition:transform .15s,filter .15s,box-shadow .15s}',
        '.btn:active{transform:scale(.98)}',
        '.btn-primary{background:linear-gradient(135deg,#34d399,#10b981,#06b6d4);color:#022c22;margin-top:12px;box-shadow:0 10px 24px rgba(16,185,129,.3)}',
        '.btn-primary:hover{filter:brightness(1.08);box-shadow:0 12px 28px rgba(16,185,129,.42)}',
        '.btn-primary:disabled{opacity:.55;cursor:not-allowed}',
        '.btn-join{background:linear-gradient(135deg,#10b981,#059669);color:#fff;margin-top:10px;box-shadow:0 8px 20px rgba(5,150,105,.28)}',
        '.btn-verify{background:#115e59;color:#ccfbf1;margin-top:8px;border:1px solid rgba(45,212,191,.35)}',
        '.btn-ghost{background:rgba(6,18,14,.9);color:#a7f3d0;border:1px solid rgba(31,92,69,.85);margin-top:9px;font-size:12px;padding:11px}',
        '.btn-ghost:hover{border-color:#34d399;color:#fff}',
        'label{display:block;font-size:12px;font-weight:700;color:#a7f3d0;margin-bottom:7px;letter-spacing:.2px}',
        '.input-wrap{position:relative;display:flex;align-items:center}',
        '.input-ico{position:absolute;left:13px;font-size:15px;opacity:.8;pointer-events:none}',
        'input{width:100%;padding:13px 14px 13px 38px;border-radius:13px;border:1px solid #1f5c45;background:rgba(5,14,11,.92);color:#fff;font-size:15px;font-weight:600;letter-spacing:.4px;outline:none;transition:.18s}',
        'input:focus{border-color:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.18)}',
        '.codebox{margin-top:16px;padding:18px 14px;background:rgba(5,15,12,.95);border:1px dashed #34d399;border-radius:16px;text-align:center;display:none;box-shadow:0 0 28px rgba(16,185,129,.16)}',
        '.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:900;letter-spacing:4px;color:#34d399;margin:8px 0;text-shadow:0 0 18px rgba(52,211,153,.4)}',
        '.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px;text-align:center}',
        '.step{background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.18);border-radius:10px;padding:7px 5px;font-size:10px;color:#a7f3d0;line-height:1.35}',
        '.step b{display:block;color:#34d399;font-size:11px;margin-bottom:2px}',
        '.msg{margin-top:12px;font-size:12.5px;color:#fcd34d;min-height:18px;text-align:center;font-weight:600}',
        '.share-bar{margin-top:12px;padding:10px 12px;background:rgba(5,14,11,.9);border:1px solid rgba(20,83,61,.75);border-radius:13px;display:flex;align-items:center;justify-content:space-between;gap:8px}',
        '.menu-card{position:relative;background:var(--card);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--line);border-radius:22px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.5)}',
        '.menu-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}',
        '.mtab{background:rgba(6,18,14,.95);color:#a7f3d0;border:1px solid #143f2f;border-radius:10px;padding:6px 11px;font-size:11px;font-weight:700;cursor:pointer;transition:.15s}',
        '.mtab:hover{border-color:#34d399}',
        '.mtab.active{background:linear-gradient(135deg,#34d399,#10b981);color:#022c22;border-color:transparent;box-shadow:0 4px 12px rgba(16,185,129,.3)}',
        '.mlist{background:rgba(4,12,9,.92);border:1px solid #12382a;border-radius:14px;padding:10px;display:flex;flex-wrap:wrap;gap:6px}',
        '.cmd-chip{background:rgba(16,185,129,.09);border:1px solid rgba(52,211,153,.22);color:#d1fae5;border-radius:8px;padding:5px 9px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;font-weight:600}',
        '.footer-note{text-align:center;font-size:11px;color:#6ee7b7;opacity:.65;margin-top:2px}',
        '</style></head><body>',
        '<div class="bg-grid"></div><div class="orb1"></div><div class="orb2"></div>',
        '<div class="wrap">',
        '<div class="card">',
        '<div class="hero">',
        '  <div class="avatar-ring">' + (avatarSrc ? '<img id="botAvatar" class="avatar-img" src="' + avatarSrc + '" alt="Bot"><div class="avatar-fallback" style="display:none">⚡</div>' : '<div class="avatar-fallback">⚡</div>') + '<span class="live-dot"></span></div>',
        '  <div class="hero-meta">',
        '    <div class="top-row"><h1 class="brand">' + esc(BOT_NAME) + '</h1><span class="tag">CODE: ASADMD11</span></div>',
        '    <p class="sub">Ultra-Fast Multi-User WhatsApp MD Pairing Hub</p>',
        '  </div>',
        '</div>',
        '<div class="stats">',
        '  <div class="statbox"><div class="statlbl">🟢 Online</div><div class="statval" id="cnt">0</div></div>',
        '  <div class="statbox"><div class="statlbl">⚡ Commands</div><div class="statval">135</div></div>',
        '  <div class="statbox"><div class="statlbl">👑 Owner</div><div class="statval">' + esc(OWNER_NAME) + '</div></div>',
        '</div>',
        channelUrl ? '<div class="gate" id="gateBox"><strong>🔒 Step 1: Join Official Channel</strong><div style="margin-top:4px;opacity:.85">Join our official channel first to unlock pairing:</div><a class="btn btn-join" target="_blank" rel="noopener" href="' + esc(channelUrl) + '">📢 View &amp; Join Channel</a><button class="btn btn-verify" id="verifyBtn" type="button">✅ Joined! Unlock Pairing</button></div>' : '',
        '<div id="pairArea"' + (channelUrl ? ' style="opacity:.45;pointer-events:none"' : '') + '>',
        '<label for="phone">WhatsApp Number (With Country Code)</label>',
        '<div class="input-wrap"><span class="input-ico">📱</span><input id="phone" type="tel" placeholder="923001234567" autocomplete="tel"></div>',
        '<button class="btn btn-primary" id="pairBtn" type="button">🔑 Get Pairing Code (ASADMD11)</button>',
        '<button class="btn btn-ghost" id="unpairBtn" type="button">🔌 Reset / Unpair Number</button>',
        '</div>',
        '<div class="codebox" id="codeBox"><div style="font-size:12px;color:#a7f3d0;font-weight:700">YOUR WHATSAPP PAIRING CODE</div><div class="code" id="codeVal">----</div><button class="btn btn-verify" id="copyBtn" type="button">📋 Copy Code</button><div class="steps"><div class="step"><b>1. WhatsApp</b>Open Settings</div><div class="step"><b>2. Linked</b>Tap Link Device</div><div class="step"><b>3. Phone</b>Enter Code</div></div><div id="pairStatus" style="margin-top:10px;font-size:12px;color:#6ee7b7">Waiting for code entry on WhatsApp...</div></div>',
        '<div class="msg" id="msg"></div>',
        livePairUrl ? '<div class="share-bar"><div style="min-width:0"><div style="font-size:10px;color:#6ee7b7;text-transform:uppercase;letter-spacing:.6px;font-weight:700">Share Pair Site Link</div><div id="siteLinkVal" style="font-size:11px;color:#d1fae5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:monospace">' + esc(livePairUrl) + '</div></div><button type="button" id="copyLinkBtn" style="flex-shrink:0;background:#0b291e;color:#6ee7b7;border:1px solid #10b981;border-radius:9px;padding:6px 11px;font-size:11px;font-weight:800;cursor:pointer">📋 Copy</button></div>' : '',
        '</div>',
        '<div class="menu-card">',
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong style="font-size:13.5px;color:#34d399;letter-spacing:.3px">✦ STYLISH COMMAND MENU (135) ✦</strong><span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(16,185,129,.15);color:#6ee7b7;border:1px solid rgba(52,211,153,.3)">ALL ACTIVE</span></div>',
        '<div class="menu-tabs" id="menuTabs"></div>',
        '<div class="mlist" id="menuBox"></div>',
        '<a class="btn btn-join" style="margin-top:12px" target="_blank" rel="noopener" href="' + esc(waChUrl) + '">📢 View Official WhatsApp Channel</a>',
        '</div>',
        '<div class="footer-note">Powered by ' + esc(BOT_NAME) + ' • Multi-Session Isolated Engine</div>',
        '</div><script>',
        'const av=document.getElementById("botAvatar");if(av){av.onerror=()=>{av.style.display="none";if(av.nextElementSibling)av.nextElementSibling.style.display="flex";};}',
        'const MENU_DATA=' + menuDataJson + ';',
        'const mt=document.getElementById("menuTabs"),mb=document.getElementById("menuBox");',
        'function renderMenu(k){mb.innerHTML="";(MENU_DATA[k]||[]).forEach(cmd=>{const s=document.createElement("span");s.className="cmd-chip";s.textContent=cmd;mb.appendChild(s);});}',
        'Object.keys(MENU_DATA).forEach((k,idx)=>{const b=document.createElement("button");b.type="button";b.className="mtab"+(idx===0?" active":"");b.textContent=k;b.onclick=()=>{document.querySelectorAll(".mtab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderMenu(k);};mt.appendChild(b);if(idx===0)renderMenu(k);});',
        'function normPhone(v){let d=String(v||"").replace(/[^0-9]/g,"");if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("03")&&d.length===11)d="92"+d.slice(1);else if(d.startsWith("3")&&d.length===10)d="92"+d;return d;}',
        'const g=document.getElementById("gateBox"),pa=document.getElementById("pairArea"),vb=document.getElementById("verifyBtn");',
        'if(vb){vb.onclick=()=>{localStorage.setItem("asad_joined","1");pa.style.opacity="1";pa.style.pointerEvents="auto";g.style.borderColor="#34d399";vb.textContent="✅ Unlocked!";};}',
        'if(localStorage.getItem("asad_joined")==="1"&&pa){pa.style.opacity="1";pa.style.pointerEvents="auto";}',
        'async function refreshCount(){try{const r=await fetch("/api/status");const d=await r.json();document.getElementById("cnt").textContent=d.connectedCount||0;}catch{}}',
        'refreshCount();setInterval(refreshCount,5000);',
        'let activePhone="";',
        'document.getElementById("pairBtn").onclick=async()=>{',
        '  const p=normPhone(document.getElementById("phone").value);',
        '  const msg=document.getElementById("msg"),btn=document.getElementById("pairBtn");',
        '  if(p.length<10||p.length>15||p.startsWith("0")){msg.textContent="Please enter a valid number with country code (e.g. 923001234567)";return;}',
        '  btn.disabled=true;btn.textContent="⏳ Connecting WhatsApp...";msg.textContent="Please wait 4–12 seconds...";',
        '  try{',
        '    const r=await fetch("/api/pair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:p})});',
        '    const d=await r.json();',
        '    if(!r.ok||!d.ok){msg.textContent="❌ "+(d.error||"Failed");btn.disabled=false;btn.textContent="🔑 Get Pairing Code (ASADMD11)";return;}',
        '    if(d.alreadyConnected){msg.textContent="✅ +"+d.phone+" is already connected!";btn.disabled=false;btn.textContent="🔑 Get Pairing Code (ASADMD11)";return;}',
        '    activePhone=d.phone;',
        '    document.getElementById("codeVal").textContent=d.formattedCode||d.code;',
        '    document.getElementById("codeBox").style.display="block";',
        '    msg.textContent="Code ready! Enter this code on your WhatsApp Linked Devices screen.";',
        '    const poll=setInterval(async()=>{try{const sr=await fetch("/api/pair-status?phone="+encodeURIComponent(activePhone));const sd=await sr.json();if(sd.connected){document.getElementById("pairStatus").textContent="✅ +"+activePhone+" Connected Successfully!";msg.textContent="🎉 Bot Connected & Channel Auto-Follow Active!";clearInterval(poll);refreshCount();}else if(sd.lastError){document.getElementById("pairStatus").textContent="❌ "+sd.lastError;msg.textContent="❌ "+sd.lastError;clearInterval(poll);}}catch{}},2500);',
        '  }catch(e){msg.textContent="❌ Network error: "+e.message;}',
        '  btn.disabled=false;btn.textContent="🔑 Get Pairing Code (ASADMD11)";',
        '};',
        'document.getElementById("unpairBtn").onclick=async()=>{',
        '  const p=normPhone(document.getElementById("phone").value);const msg=document.getElementById("msg");',
        '  if(p.length<10){msg.textContent="Enter a phone number to reset or unpair.";return;}',
        '  const r=await fetch("/api/unpair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:p})});',
        '  const d=await r.json();msg.textContent=d.ok?"✅ +"+p+" has been reset — you can request a new code now!":"ℹ️ "+(d.error||"Session not active");refreshCount();',
        '};',
        'document.getElementById("copyBtn").onclick=()=>{const t=document.getElementById("codeVal").textContent.replace(/-/g,"");navigator.clipboard?.writeText(t);document.getElementById("copyBtn").textContent="✅ Copied: "+t;};',
        'const clb=document.getElementById("copyLinkBtn");if(clb){clb.onclick=()=>{navigator.clipboard?.writeText(document.getElementById("siteLinkVal").textContent);clb.textContent="✅ Copied!";setTimeout(()=>clb.textContent="📋 Copy",1800);};}',
        '</script></body></html>'
    ];
    return html.join('');
}

function startPairingWebServer() {
    const server = http.createServer(async (req, res) => {
        const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
        const pathname = parsedUrl.pathname;

        if (req.method === 'OPTIONS') {
            res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
            res.end();
            return;
        }

        if (req.method === 'GET' && pathname === '/bot-dp.jpg') {
            const cfg = loadConfig();
            const dpPath = path.join(__dirname, cfg.DEFAULT_DP || 'assets/bot_dp.jpg');
            if (fs.existsSync(dpPath)) {
                const buf = fs.readFileSync(dpPath);
                res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600', 'Content-Length': buf.length });
                res.end(buf);
                return;
            }
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        if (req.method === 'GET' && (pathname === '/' || pathname === '/pair')) {
            const customHtmlPath = path.join(__dirname, 'pair.html');
            const html = fs.existsSync(customHtmlPath)
                ? fs.readFileSync(customHtmlPath, 'utf8')
                : buildPairSiteHtml(req);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        if (req.method === 'GET' && (pathname === '/api/status' || pathname === '/health')) {
            const cfg = loadConfig();
            const gate = getChannelGateConfig();
            const list = Object.values(sessions).map(s => ({
                phone: s.phoneKey,
                connected: Boolean(s.connected)
            }));
            sendJson(res, 200, {
                ok: true,
                botName: BOT_NAME,
                ownerName: OWNER_NAME,
                commandCount: 135,
                waChannelLink: String(cfg.WA_CHANNEL_LINK || process.env.WA_CHANNEL_LINK || DEFAULT_WA_CHANNEL_LINK).trim(),
                forceJoinEnabled: Boolean(gate.enabled),
                forceJoinLink: String(gate.link || '').trim(),
                totalSessions: list.length,
                connectedCount: list.filter(x => x.connected).length,
                sessions: list
            });
            return;
        }

        if (req.method === 'GET' && pathname === '/api/pair-status') {
            const phone = normalizePhoneInput(parsedUrl.searchParams.get('phone') || '');
            const s = sessions[phone];
            sendJson(res, 200, {
                ok: true,
                phone,
                exists: Boolean(s),
                connected: Boolean(s?.connected),
                lastPairingCode: s?.lastPairingCode || null,
                lastError: s?.lastError || null
            });
            return;
        }

        if (req.method === 'POST' && pathname === '/api/pair') {
            const body = await readJsonBody(req);
            const phone = normalizePhoneInput(body.phone || '');
            if (phone.length < 10 || phone.length > 15) {
                sendJson(res, 400, { ok: false, error: 'Please enter a valid phone number with country code (e.g. 923001234567)' });
                return;
            }
            if (sessions[phone]?.connected) {
                sendJson(res, 200, { ok: true, alreadyConnected: true, phone });
                return;
            }
            let settled = false;
            const result = await new Promise((resolve) => {
                const timer = setTimeout(() => {
                    if (!settled) { settled = true; resolve({ ok: false, error: 'Pairing code timeout — please try again in 5 seconds' }); }
                }, 35000);
                startWhatsAppPairing(phone, (err, code, formattedCode) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    if (err || !code) resolve({ ok: false, error: err?.message || 'Pairing failed' });
                    else resolve({ ok: true, phone, code, formattedCode });
                }).catch((e) => {
                    if (!settled) { settled = true; clearTimeout(timer); resolve({ ok: false, error: e.message }); }
                });
            });
            sendJson(res, result.ok ? 200 : 500, result);
            return;
        }

        if (req.method === 'POST' && pathname === '/api/unpair') {
            const body = await readJsonBody(req);
            const phone = normalizePhoneInput(body.phone || '');
            const target = sessions[phone];
            if (!target) {
                sendJson(res, 404, { ok: false, error: 'Session not found' });
                return;
            }
            target.stopped = true;
            try { await target.sock?.logout(); } catch {}
            try { fs.rmSync(target.authPath, { recursive: true, force: true }); } catch {}
            delete sessions[phone];
            sendJson(res, 200, { ok: true, phone });
            return;
        }

        sendJson(res, 404, { ok: false, error: 'Not found' });
    });

    server.listen(WEB_PORT, '0.0.0.0', () => {
        const publicUrl = getPublicPairUrl();
        console.log('🌐 Multi-User Web Pairing Site live at ' + (publicUrl || ('http://0.0.0.0:' + WEB_PORT)));
    });
}

function setupRenderKeepAliveAndShutdown() {
    const keepUrl = getPublicPairUrl();
    if (keepUrl && /^https?:\/\//i.test(keepUrl)) {
        const httpMod = keepUrl.startsWith('https') ? require('https') : require('http');
        setInterval(() => {
            try { httpMod.get(keepUrl + '/health', (r) => r.resume()).on('error', () => {}); } catch {}
        }, 10 * 60 * 1000);
        console.log('🛡️ Render Keep-Alive active for:', keepUrl + '/health');
    }

    const gracefulExit = async () => {
        console.log('🔄 Flushing WhatsApp session credentials before shutdown...');
        await Promise.all(Object.values(sessions).map(s => s._credsQueue?.catch(() => {}) || Promise.resolve()));
        process.exit(0);
    };
    process.once('SIGTERM', gracefulExit);
    process.once('SIGINT', gracefulExit);
}

async function boot() {
    await loadBaileys();
    initTelegramBot();
    startPairingWebServer();
    setupRenderKeepAliveAndShutdown();
    restoreExistingSessions();
    console.log('⚡ ' + BOT_NAME + ' Ready | 135 Commands | Custom Pair Code: ASADMD11 | Web + Telegram + .pair Active');
}

boot().catch((err) => {
    console.error('❌ Fatal Boot Error:', err);
    process.exit(1);
});
