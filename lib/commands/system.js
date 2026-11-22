'use strict';

/**
 * 👑 𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇 - Owner, Anti & Auto Controls Suite
 * Handles Section 1 (OWNER - 38), Section 2 (ANTI - 17), Section 5 (AUTO - 18) + Menu Triggers
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const { exec } = require('child_process');

function safeJidNormalizedUser(jid) {
    const s = String(jid || '');
    if (!s) return '';
    const [left, domain] = s.split('@');
    if (!domain) return s;
    const user = left.split(':')[0];
    return user + '@' + (domain === 'c.us' ? 's.whatsapp.net' : domain);
}

function formatUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return [d ? d + 'd' : '', h ? h + 'h' : '', m ? m + 'm' : '', s + 's'].filter(Boolean).join(' ');
}

function parseTargetJid(msg, argText) {
    const m = msg?.message || {};
    for (const k of ['extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']) {
        const ctx = m[k]?.contextInfo;
        if (ctx?.mentionedJid?.[0]) return ctx.mentionedJid[0];
        if (ctx?.participant) return ctx.participant;
    }
    const digits = String(argText || '').replace(/[^0-9]/g, '');
    if (digits.length >= 7 && digits.length <= 16) return digits + '@s.whatsapp.net';
    return null;
}

const AUTO_TOGGLE_MAP = {
    // Section 2: ANTI (17)
    antibot: 'antiBot',
    antivv: 'antiViewOnce',
    antiviewonce: 'antiViewOnce',
    antidelete: 'antiDelete',
    antisticker: 'antiSticker',
    antispam: 'antiSpam',
    antifake: 'antiFake',
    antiporn: 'antiPorn',
    antibadword: 'antiToxic',
    anticall: 'antiCall',
    antigroup: 'antiGroup',
    antipoll: 'antiPoll',
    antimention: 'antiMention',
    antiforward: 'antiForward',
    antimedia: 'antiMedia',

    // Section 5: AUTO (18)
    autostatus: 'autoStatusView',
    autostatusview: 'autoStatusView',
    autolike: 'autoStatusReact',
    autoread: 'autoRead',
    autotyping: 'autoTyping',
    autorecording: 'autoRecording',
    autobio: 'autoBio',
    autoblock: 'autoBlock',
    autounblock: 'autoUnblock',
    autowelcome: 'autoWelcome',
    autogoodbye: 'autoGoodbye',
    autopromote: 'autoPromote',
    autodemote: 'autoDemote',
    autoai: 'autoAi',
    autodownload: 'autoDownload'
};

async function handleSystemAndAutoCommands(ctx) {
    const {
        sock, from, msg, cmdName, argStr, isOwner, isGroup, isAdmin, botAdmin,
        warns, knownDms, botJid, botPn, cfg, loadConfig, saveConfig, getBotImgPayload,
        getMenuText, getAllMenuText, getAllMenuChunks, getListText, sessions, sessionObj
    } = ctx;

    const reply = (text) => sock.sendMessage(from, {
        text: '╭─「 ⚡ *' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇" + '* 」\n' + text + '\n╰──────────────────────◈'
    }, { quoted: msg });

    // ── MENU & HELP COMMANDS ──────────────────────────────────
    if (cmdName === 'menu' || cmdName === 'help') {
        const menuTxt = getMenuText();
        await sock.sendMessage(from, getBotImgPayload(menuTxt, true, from), { quoted: msg }).catch(async () => {
            await sock.sendMessage(from, getBotImgPayload(menuTxt, false, from), { quoted: msg }).catch(async () => {
                await sock.sendMessage(from, { text: menuTxt }, { quoted: msg });
            });
        });
        return true;
    }
    if (cmdName === 'allmenu') {
        const chunks = typeof getAllMenuChunks === 'function' ? getAllMenuChunks() : [getAllMenuText()];
        for (let i = 0; i < chunks.length; i++) {
            if (i === 0) {
                await sock.sendMessage(from, getBotImgPayload(chunks[i], true, from), { quoted: msg }).catch(async () => {
                    await sock.sendMessage(from, { text: chunks[i] }, { quoted: msg });
                });
            } else {
                await sock.sendMessage(from, { text: chunks[i] });
            }
        }
        return true;
    }
    if (cmdName === 'list') {
        const listTxt = getListText();
        await sock.sendMessage(from, getBotImgPayload(listTxt, true, from), { quoted: msg }).catch(async () => {
            await sock.sendMessage(from, { text: listTxt }, { quoted: msg });
        });
        return true;
    }

    // ══════════════════════════════════════════════════════════
    // SECTION 1: OWNER COMMANDS
    // ══════════════════════════════════════════════════════════
    if (cmdName === 'alive') {
        const aliveTxt =
            '╭━━〔 💫 *' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇" + ' ONLINE* 〕━━╮\n' +
            '┃ 👑 *Owner:* ' + (cfg.OWNER_NAME || "𝛥𝑆𝛥𝐷") + '\n' +
            '┃ 🪐 *Uptime:* ' + formatUptime(process.uptime()) + '\n' +
            '┃ 🎛️ *Mode:* ' + (cfg.MODE || 'public').toUpperCase() + '\n' +
            '┃ ⌨️ *Prefix:* ' + (cfg.PREFIX || '.') + '\n' +
            '┃ 😻 *Channel React:* ' + ((cfg.AUTO?.autoChannelReact !== false) ? 'ALWAYS ON ✅' : 'OFF') + '\n' +
            '┃ 🔐 *Active Sessions:* ' + Object.keys(sessions).length + '\n' +
            '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n' +
            '📢 *View Channel:* ' + (cfg.WA_CHANNEL_LINK || 'https://whatsapp.com/channel/0029VbATSM74dTnMw4evnN13');
        await sock.sendMessage(from, getBotImgPayload(aliveTxt, true, from), { quoted: msg }).catch(async () => {
            await sock.sendMessage(from, { text: aliveTxt }, { quoted: msg });
        });
        return true;
    }

    if (cmdName === 'ping') {
        const t0 = Date.now();
        const sent = await sock.sendMessage(from, { text: '🌠 Checking speed...' }, { quoted: msg });
        const ms = Date.now() - t0;
        const usedMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        const card =
            '╭━━〔 🌠 *' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇" + ' PING* 〕━━╮\n' +
            '┃ 🚀 *Speed:* ' + ms + ' ms\n' +
            '┃ 🪐 *Uptime:* ' + formatUptime(process.uptime()) + '\n' +
            '┃ 💾 *RAM:* ' + usedMb + ' MB\n' +
            '┃ 🔗 *Sessions:* ' + Object.keys(sessions).length + '\n' +
            '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯';
        await sock.sendMessage(from, { text: card, edit: sent?.key }).catch(() => reply(card));
        return true;
    }

    if (cmdName === 'chreact') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const arg = argStr.trim().toLowerCase();
        cfg.AUTO = cfg.AUTO || {};
        if (arg === 'off' || arg === 'disable') {
            cfg.AUTO.autoChannelReact = false;
            saveConfig(cfg);
            await reply('🛑 *CHANNEL AUTO REACT OFF* (Applies to your connected WhatsApp only)');
            return true;
        }
        cfg.AUTO.autoChannelReact = true;
        cfg.AUTO.allEmojiReact = true;
        saveConfig(cfg);
        if (sessionObj && typeof sessionObj.followConfiguredChannel === 'function') {
            sessionObj._channelFollowed = false;
            sessionObj.followConfiguredChannel(1).catch(() => {});
        }
        await reply('😻 *CHANNEL AUTO REACT ON (Your Bot Only)!*\nEvery WhatsApp Channel post will receive non-repeating reactions from all 140+ emojis.');
        return true;
    }

    if (cmdName === 'uptime') {
        await reply('🪐 *Bot Uptime:* ' + formatUptime(process.uptime()) + '\n📅 *Started:* ' + new Date(Date.now() - process.uptime() * 1000).toLocaleString('en-US', { timeZone: 'Asia/Karachi' }) + ' PKT');
        return true;
    }

    if (cmdName === 'restart') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        await reply('🔁 *Restarting your WhatsApp bot session...* (1-3 sec)');
        if (sessionObj && typeof sessionObj.restartSelf === 'function') {
            setTimeout(() => sessionObj.restartSelf().catch(() => {}), 800);
        } else {
            setTimeout(() => process.exit(0), 1000);
        }
        return true;
    }

    if (cmdName === 'shutdown') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        await reply('💥 *Shutting down session cleanly...*');
        if (sessionObj) {
            sessionObj.stopped = true;
            setTimeout(() => { try { sessionObj.sock?.end(); } catch {} }, 800);
        }
        return true;
    }

    if (cmdName === 'update') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const fresh = loadConfig();
        await reply('🆙 *Config Reloaded & Active!*\n• *Prefix:* ' + (fresh.PREFIX || '.') + '\n• *Mode:* ' + (fresh.MODE || 'public').toUpperCase() + '\n• *Channel React:* ' + ((fresh.AUTO?.autoChannelReact !== false) ? 'ON ✅' : 'OFF') + '\n• *Host:* ' + os.platform() + ' ' + os.arch());
        return true;
    }

    if (cmdName === 'mode' || cmdName === 'private' || cmdName === 'public') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const m = (cmdName === 'private' || cmdName === 'public') ? cmdName : argStr.trim().toLowerCase();
        if (m === 'public' || m === 'private') {
            cfg.MODE = m;
            saveConfig(cfg);
            const note = m === 'private'
                ? '\n👑 *Private Access:* You (Owner) can run ALL commands in your Private Inbox, any Group, or your Channel!'
                : '\n🌐 *Public Access:* Everyone can run public bot commands.';
            await reply('🎛️ *Bot Mode Updated:* ' + m.toUpperCase() + note);
        } else {
            const p = cfg.PREFIX || '.';
            await reply('🎛️ *Current Mode:* ' + (cfg.MODE || 'public').toUpperCase() + '\nSwitch mode with: *' + p + 'mode public* or *' + p + 'mode private* (or *' + p + 'public* / *' + p + 'private*)');
        }
        return true;
    }

    if (cmdName === 'setprefix') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const p = argStr.trim().slice(0, 3);
        if (!p) { await reply('❌ Usage: .setprefix !'); return true; }
        cfg.PREFIX = p;
        saveConfig(cfg);
        await reply('⌨️ *Prefix Updated:* ' + p);
        return true;
    }

    if (cmdName === 'setowner') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const parts = argStr.trim().split(/\s+/);
        const num = String(parts[0] || '').replace(/[^0-9]/g, '');
        if (num.length < 10 || num.length > 15) {
            await reply('❌ Usage: .setowner 923001234567 [Owner Name]');
            return true;
        }
        cfg.OWNER_NUMBER = num;
        if (parts.slice(1).join(' ').trim()) cfg.OWNER_NAME = parts.slice(1).join(' ').trim();
        saveConfig(cfg);
        await reply('👑 *Owner Updated!*\n• *Number:* +' + num + '\n• *Name:* ' + (cfg.OWNER_NAME || "𝛥𝑆𝛥𝐷"));
        return true;
    }

    if (cmdName === 'pair' || cmdName === 'paircode') {
        let phone = argStr.replace(/[\u200e\u200f\u202a-\u202e\s+()-]/g, '').replace(/[^0-9]/g, '');
        if (phone.startsWith('00')) phone = phone.slice(2);
        if (phone.startsWith('03') && phone.length === 11) phone = '92' + phone.slice(1);
        else if (phone.startsWith('3') && phone.length === 10) phone = '92' + phone;
        if (phone.length < 10 || phone.length > 15 || phone.startsWith('0')) {
            await reply('🔗 *Pair Guide:* Enter a valid WhatsApp number with country code.\nExample: *' + (cfg.PREFIX || '.') + cmdName + ' 923001234567*\n\n👥 Unlimited users can pair their WhatsApp simultaneously!');
            return true;
        }
        if (sessions[phone]?.connected) {
            await reply('✅ *+' + phone + '* is already connected!');
            return true;
        }
        await reply('⏳ *Connecting & Generating WhatsApp Pairing Code for +' + phone + '...*');
        if (typeof ctx.startWhatsAppPairing === 'function') {
            await ctx.startWhatsAppPairing(phone, async (err, code, formattedCode) => {
                if (err || !code) {
                    await reply('❌ Pairing code failed (+' + phone + '): ' + (err?.message || 'Socket timeout — please try again'));
                    return;
                }
                const displayCode = formattedCode || (String(code).length === 8 ? (code.slice(0, 4) + '-' + code.slice(4)) : code);
                await sock.sendMessage(from, {
                    text:
                        '╭━━〔 🔑 *WHATSAPP PAIRING CODE* 〕━━╮\n' +
                        '┃ 📱 *Number:* +' + phone + '\n' +
                        '┃ 🔐 *Code:* *' + displayCode + '*\n' +
                        '┃ 📋 *Copy:* ' + code + '\n' +
                        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n' +
                        'Open WhatsApp > *Linked Devices* > *Link a Device* > *Link with phone number* and enter this code.'
                }, { quoted: msg });
            }, from);
        }
        return true;
    }

    if (cmdName === 'getsessions') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const ownPhone = sessionObj?.phoneKey || botPn;
        const envRootOwner = String(process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        const isRootHost = Boolean(envRootOwner && ownPhone === envRootOwner);
        const visible = isRootHost
            ? Object.values(sessions)
            : Object.values(sessions).filter(s => s.phoneKey === ownPhone);
        const list = visible.map(s => '• +' + s.phoneKey + ' — ' + (s.connected ? 'Online ✅' : 'Connecting ⏳')).join('\n') || 'None';
        await reply('🗂️ *YOUR ACTIVE SESSION (' + visible.length + ')*\n\n' + list + '\n\n🌐 *Total Server Sessions:* ' + Object.keys(sessions).length);
        return true;
    }

    if (cmdName === 'delsession') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const ownPhone = sessionObj?.phoneKey || botPn;
        const envRootOwner = String(process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        const isRootHost = Boolean(envRootOwner && ownPhone === envRootOwner);
        const p = argStr.replace(/[^0-9]/g, '') || ownPhone;
        if (!isRootHost && p !== ownPhone) {
            await reply('🔒 *Isolated Bot:* You can only delete your own paired session (+' + ownPhone + ').');
            return true;
        }
        const target = sessions[p];
        if (!target) { await reply('❌ Session +' + p + ' not found.'); return true; }
        if (typeof target.stopAndCleanup === 'function') await target.stopAndCleanup(true);
        else {
            target.stopped = true;
            try { fs.rmSync(target.authPath, { recursive: true, force: true }); } catch {}
        }
        delete sessions[p];
        await reply('🗑️ *Session +' + p + ' deleted!*');
        return true;
    }

    if (cmdName === 'clearsession') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const ownPhone = sessionObj?.phoneKey || botPn;
        const envRootOwner = String(process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        const isRootHost = Boolean(envRootOwner && ownPhone === envRootOwner);
        if (!isRootHost) {
            await reply('🧹 *Your session cache cleared!* (Other users remain untouched)');
            return true;
        }
        const base = path.join(__dirname, '../../sessions');
        let removed = 0;
        if (fs.existsSync(base)) {
            for (const dir of fs.readdirSync(base)) {
                if (dir === 'verified_tg_users.json') continue;
                if (!sessions[dir] || !sessions[dir].connected) {
                    try { fs.rmSync(path.join(base, dir), { recursive: true, force: true }); removed++; } catch {}
                    delete sessions[dir];
                }
            }
        }
        await reply('🧹 *Cleared ' + removed + ' inactive/broken session(s)!*');
        return true;
    }

    if (cmdName === 'logout') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        await reply('🚪 *Logging out +' + (sessionObj?.phoneKey || botPn) + '...*');
        if (sessionObj) {
            const p = sessionObj.phoneKey;
            sessionObj.stopped = true;
            try { await sock.logout(); } catch {}
            try { fs.rmSync(sessionObj.authPath, { recursive: true, force: true }); } catch {}
            delete sessions[p];
        }
        return true;
    }

    if (cmdName === 'jid') {
        const qInfo = ctx.getQuotedInfo?.();
        const lines = [
            '🆔 *Chat JID:* ' + from,
            '👤 *Your JID:* ' + ctx.sender,
            ...(qInfo?.participant ? ['💬 *Quoted User JID:* ' + qInfo.participant] : [])
        ];
        await reply(lines.join('\n'));
        return true;
    }

    if (cmdName === 'broadcast' || cmdName === 'bcgroup' || cmdName === 'bcuser') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const text = argStr.trim() || ctx.quotedText;
        if (!text) { await reply('❌ Usage: .' + cmdName + ' <message>'); return true; }
        const targets = new Set();
        if (cmdName === 'broadcast' || cmdName === 'bcgroup') {
            try {
                const groups = await sock.groupFetchAllParticipating();
                Object.keys(groups || {}).forEach(id => targets.add(id));
            } catch {}
        }
        if (cmdName === 'broadcast' || cmdName === 'bcuser') {
            if (knownDms) knownDms.forEach(d => targets.add(d));
        }
        let sent = 0;
        for (const jid of targets) {
            try {
                await sock.sendMessage(jid, { text: '╭━━〔 📢 *BROADCAST* 〕━━╮\n\n' + text + '\n\n╰━━━〔 ⚡ *' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇" + '* 〕━━━╯' });
                sent++;
            } catch {}
            await new Promise(r => setTimeout(r, 600));
        }
        await reply('✅ Broadcast sent to *' + sent + '* chat(s)!');
        return true;
    }

    if (cmdName === 'forward') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const qInfo = ctx.getQuotedInfo?.();
        if (!qInfo?.quotedMessage) { await reply('❌ Reply to any message with .forward <jid>.'); return true; }
        const raw = argStr.trim();
        const target = raw.includes('@') ? raw : (raw.replace(/[^0-9]/g, '').length >= 7 ? raw.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : from);
        let sentOk = false;
        try {
            await sock.sendMessage(target, {
                forward: {
                    key: { remoteJid: from, fromMe: false, id: qInfo.stanzaId || '', participant: qInfo.participant || undefined },
                    message: qInfo.quotedMessage
                }
            });
            sentOk = true;
        } catch {}
        if (!sentOk && ctx.quotedMedia && typeof ctx.downloadQuotedBuffer === 'function') {
            try {
                const buf = await ctx.downloadQuotedBuffer();
                if (buf && ctx.quotedMedia.type === 'image') { await sock.sendMessage(target, { image: buf, caption: ctx.quotedText || '' }); sentOk = true; }
                else if (buf && ctx.quotedMedia.type === 'video') { await sock.sendMessage(target, { video: buf, caption: ctx.quotedText || '' }); sentOk = true; }
                else if (buf && ctx.quotedMedia.type === 'audio') { await sock.sendMessage(target, { audio: buf, mimetype: ctx.quotedMedia.media?.mimetype || 'audio/mpeg' }); sentOk = true; }
                else if (buf && ctx.quotedMedia.type === 'sticker') { await sock.sendMessage(target, { sticker: buf }); sentOk = true; }
                else if (buf && ctx.quotedMedia.type === 'document') { await sock.sendMessage(target, { document: buf, mimetype: ctx.quotedMedia.media?.mimetype || 'application/octet-stream', fileName: ctx.quotedMedia.media?.fileName || 'file' }); sentOk = true; }
            } catch {}
        }
        if (!sentOk && ctx.quotedText) {
            await sock.sendMessage(target, { text: ctx.quotedText });
            sentOk = true;
        }
        await reply(sentOk ? ('➡️ *Forwarded to:* ' + target) : '❌ Failed to forward message.');
        return true;
    }

    if (cmdName === 'setbio') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        if (!argStr.trim()) { await reply('❌ Usage: .setbio Powered by ASAD MD'); return true; }
        try {
            await sock.updateProfileStatus(argStr.trim());
            await reply('📝 *Bot bio updated!*');
        } catch (err) {
            await reply('❌ Bio update failed: ' + err.message);
        }
        return true;
    }

    if (cmdName === 'setpp') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        let buf = null;
        if (ctx.quotedMedia && ctx.quotedMedia.type === 'image') buf = await ctx.downloadQuotedBuffer();
        else {
            const localDp = path.join(__dirname, '../../assets/bot_dp.jpg');
            if (fs.existsSync(localDp)) buf = fs.readFileSync(localDp);
        }
        if (!buf) { await reply('❌ Reply to any image with .setpp to set the bot profile photo!'); return true; }
        try {
            const targetPpJid = safeJidNormalizedUser(botJid) || (botPn + '@s.whatsapp.net');
            await sock.updateProfilePicture(targetPpJid, buf);
            await reply('🖼️ *Your Bot Profile Picture (DP) updated!*');
        } catch (err) {
            await reply('❌ DP update failed: ' + err.message);
        }
        return true;
    }

    if (cmdName === 'setname') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        if (!argStr.trim()) { await reply('❌ Usage: .setname ASAD MD BOT'); return true; }
        await sock.updateProfileName(argStr.trim());
        await reply('✏️ *Bot profile name updated to:* ' + argStr.trim());
        return true;
    }

    if (cmdName === 'ban' || cmdName === 'unban' || cmdName === 'banlist') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        cfg.BANNED_USERS = Array.isArray(cfg.BANNED_USERS) ? cfg.BANNED_USERS : [];
        if (cmdName === 'banlist') {
            const list = cfg.BANNED_USERS.map((j, i) => (i + 1) + '. +' + j.split('@')[0]).join('\n') || 'None';
            await reply('📋 *BANNED USERS (' + cfg.BANNED_USERS.length + ')*\n\n' + list);
            return true;
        }
        const target = parseTargetJid(msg, argStr);
        if (!target) { await reply('❌ Mention, reply to a user, or provide a phone number.'); return true; }
        const norm = safeJidNormalizedUser(target);
        if (cmdName === 'ban') {
            if (!cfg.BANNED_USERS.includes(norm)) cfg.BANNED_USERS.push(norm);
            saveConfig(cfg);
            await reply('🚫 *Banned:* +' + norm.split('@')[0]);
        } else {
            cfg.BANNED_USERS = cfg.BANNED_USERS.filter(x => x !== norm);
            saveConfig(cfg);
            await reply('✅ *Unbanned:* +' + norm.split('@')[0]);
        }
        return true;
    }

    if (cmdName === 'block' || cmdName === 'unblock' || cmdName === 'blocklist') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        if (cmdName === 'blocklist') {
            const list = await sock.fetchBlocklist().catch(() => []);
            const body = list.length ? list.map((j, i) => (i + 1) + '. +' + j.split('@')[0]).join('\n') : 'No blocked numbers found.';
            await reply('📃 *BLOCKED NUMBERS (' + list.length + ')*\n\n' + body);
            return true;
        }
        const target = parseTargetJid(msg, argStr);
        if (!target) { await reply('❌ Mention, reply to a user, or provide a phone number.'); return true; }
        await sock.updateBlockStatus(target, cmdName === 'block' ? 'block' : 'unblock');
        await reply((cmdName === 'block' ? '⛔ *Blocked:* +' : '🔓 *Unblocked:* +') + target.split('@')[0]);
        return true;
    }

    if (cmdName === 'warn' || cmdName === 'delwarn') {
        if (!isOwner && !isAdmin) { await reply('❌ Owner or Group Admin only!'); return true; }
        const target = parseTargetJid(msg, argStr);
        if (!target) { await reply('❌ Please mention or reply to a user.'); return true; }
        const key = safeJidNormalizedUser(target) + ':' + from;
        if (cmdName === 'delwarn') {
            warns[key] = Math.max(0, (warns[key] || 0) - 1);
            await sock.sendMessage(from, { text: '🧽 *Warning removed* for @' + target.split('@')[0] + ' (' + warns[key] + '/3)', mentions: [target] }, { quoted: msg });
            return true;
        }
        warns[key] = (warns[key] || 0) + 1;
        if (warns[key] >= 3 && isGroup && botAdmin) {
            await sock.sendMessage(from, { text: '🚫 @' + target.split('@')[0] + ' reached 3/3 warnings → KICKED!', mentions: [target] });
            await sock.groupParticipantsUpdate(from, [target], 'remove').catch(() => {});
            delete warns[key];
        } else {
            await sock.sendMessage(from, { text: '⚠️ @' + target.split('@')[0] + ' Warning ' + warns[key] + '/3', mentions: [target] }, { quoted: msg });
        }
        return true;
    }

    if (cmdName === 'eval') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        if (!argStr) { await reply('❌ Usage: .eval 2 + 2'); return true; }
        try {
            let out = await eval('(async () => { return ' + argStr + '; })()');
            if (typeof out !== 'string') out = util.inspect(out, { depth: 1 });
            await reply('🧠 *EVAL RESULT:*\n' + String(out).slice(0, 3500));
        } catch (err) {
            await reply('❌ Eval Error: ' + err.message);
        }
        return true;
    }

    if (cmdName === 'exec' || cmdName === 'shell') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        if (!argStr) { await reply('❌ Usage: .' + cmdName + ' ls -la'); return true; }
        exec(argStr, { timeout: 20000 }, async (err, stdout, stderr) => {
            const out = (stdout || stderr || err?.message || 'Done').slice(0, 3500);
            await reply('💻 *OUTPUT:*\n' + out);
        });
        return true;
    }

    if (cmdName === 'getcode') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const fileMap = {
            index: 'index.js',
            system: 'lib/commands/system.js',
            group: 'lib/commands/group.js',
            media: 'lib/commands/media.js',
            youtube: 'lib/youtube.js',
            viewonce: 'lib/viewOnce.js',
            converter: 'lib/converter.js',
            package: 'package.json',
            config: 'config.json'
        };
        const q = argStr.trim().toLowerCase().replace(/^\./, '') || 'system';
        const rel = fileMap[q] || 'lib/commands/system.js';
        const targetPath = path.join(__dirname, '../..', rel);
        if (!fs.existsSync(targetPath)) { await reply('❌ File not found: ' + rel); return true; }
        const code = fs.readFileSync(targetPath, 'utf8').slice(0, 3200);
        await reply('📜 *CODE (' + rel + '):*\n\n' + code);
        return true;
    }

    if (cmdName === 'setcmd') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const parts = argStr.split('|');
        const trigger = String(parts[0] || '').trim().toLowerCase().replace(/^\./, '');
        const body = parts.slice(1).join('|').trim() || ctx.quotedText;
        if (!trigger || !body) {
            await reply('❌ Usage: .setcmd salam | Walaikum Assalam!');
            return true;
        }
        cfg.CUSTOM_COMMANDS = cfg.CUSTOM_COMMANDS || {};
        cfg.CUSTOM_COMMANDS[trigger] = body;
        saveConfig(cfg);
        await reply('➕ *Custom Command Added:* ' + (cfg.PREFIX || '.') + trigger);
        return true;
    }

    if (cmdName === 'delcmd') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const trigger = argStr.trim().toLowerCase().replace(/^\./, '');
        if (!trigger) { await reply('❌ Usage: .delcmd <command>'); return true; }
        cfg.CUSTOM_COMMANDS = cfg.CUSTOM_COMMANDS || {};
        if (!cfg.CUSTOM_COMMANDS[trigger]) { await reply('ℹ️ Custom command *' + trigger + '* not found.'); return true; }
        delete cfg.CUSTOM_COMMANDS[trigger];
        saveConfig(cfg);
        await reply('➖ *Custom Command Deleted:* ' + trigger);
        return true;
    }

    // Per-Session Command ON/OFF controls (100% isolated per paired WhatsApp; never affects any other connected bot)
    if (cmdName === 'cmdon' || cmdName === 'cmdoff' || cmdName === 'enableall') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const prefix = cfg.PREFIX || '.';
        cfg.DISABLED_COMMANDS = Array.isArray(cfg.DISABLED_COMMANDS) ? cfg.DISABLED_COMMANDS : [];
        if (cmdName === 'enableall') {
            cfg.DISABLED_COMMANDS = [];
            saveConfig(cfg);
            await reply('✅ *ALL COMMANDS ON FOR YOUR BOT!*\nEvery command on your paired WhatsApp (+' + (sessionObj?.phoneKey || botPn) + ') is active.');
            return true;
        }
        const targetCmd = argStr.trim().toLowerCase().replace(/^\./, '');
        if (!targetCmd) {
            if (cmdName === 'cmdon') {
                cfg.DISABLED_COMMANDS = [];
                saveConfig(cfg);
                await reply('✅ *ALL COMMANDS ON FOR YOUR BOT!*\nUse *' + prefix + 'cmdoff <command>* to turn off any single command on your own WhatsApp only.');
            } else {
                const offList = cfg.DISABLED_COMMANDS.length ? cfg.DISABLED_COMMANDS.map(c => prefix + c).join(', ') : 'None (All commands ON)';
                await reply('⚙️ *Your Bot Command Toggles:*\n• Currently OFF: ' + offList + '\n• Usage: *' + prefix + 'cmdoff <cmd>* or *' + prefix + 'cmdon <cmd>*');
            }
            return true;
        }
        const protectedCmds = new Set(['cmdon', 'cmdoff', 'enableall', 'menu', 'help', 'alive']);
        if (cmdName === 'cmdoff') {
            if (protectedCmds.has(targetCmd)) {
                await reply('🔒 Core command *' + prefix + targetCmd + '* cannot be turned OFF.');
                return true;
            }
            if (!cfg.DISABLED_COMMANDS.includes(targetCmd)) cfg.DISABLED_COMMANDS.push(targetCmd);
            saveConfig(cfg);
            await reply('🛑 *Command Turned OFF (Your Bot Only):* ' + prefix + targetCmd + '\nOther connected bots are unaffected. Turn it back ON anytime with *' + prefix + 'cmdon ' + targetCmd + '*');
            return true;
        }
        cfg.DISABLED_COMMANDS = cfg.DISABLED_COMMANDS.filter(c => c !== targetCmd);
        saveConfig(cfg);
        await reply('✅ *Command Turned ON (Your Bot Only):* ' + prefix + targetCmd);
        return true;
    }

    // ══════════════════════════════════════════════════════════
    // SECTION 2 (ANTI) & SECTION 5 (AUTO) SPECIAL HANDLERS
    // ══════════════════════════════════════════════════════════
    if (cmdName === 'antilink') {
        if (!isOwner && !isAdmin) { await reply('❌ Owner or Admin only!'); return true; }
        const arg = argStr.trim().toLowerCase();
        cfg.AUTO = cfg.AUTO || {};
        cfg.SAFETY = cfg.SAFETY || {};
        if (arg === 'delete' || arg === 'kick') {
            cfg.ANTILINK_ACTION = arg;
            cfg.AUTO.antiLink = true;
            cfg.SAFETY.antiLink = true;
            saveConfig(cfg);
            await reply('🔗 *Anti-Link Action:* ' + arg.toUpperCase() + ' (Enabled)');
            return true;
        }
        const nextVal = arg === 'on' ? true : (arg === 'off' ? false : !cfg.AUTO.antiLink);
        cfg.AUTO.antiLink = nextVal;
        cfg.SAFETY.antiLink = nextVal;
        saveConfig(cfg);
        await reply((nextVal ? '✅ *ON (Your Bot Only):* ' : '🛑 *OFF (Your Bot Only):* ') + (cfg.PREFIX || '.') + 'antilink');
        return true;
    }

    if (cmdName === 'antiword') {
        if (!isOwner && !isAdmin) { await reply('❌ Owner or Admin only!'); return true; }
        const w = argStr.trim().toLowerCase();
        cfg.AUTO = cfg.AUTO || {};
        cfg.ANTI_WORDS = Array.isArray(cfg.ANTI_WORDS) ? cfg.ANTI_WORDS : [];
        if (!w || w === 'on' || w === 'off') {
            const nextVal = w === 'on' ? true : w === 'off' ? false : !cfg.AUTO.antiWord;
            cfg.AUTO.antiWord = nextVal;
            saveConfig(cfg);
            await reply((nextVal ? '✅ *ON (Your Bot Only):* ' : '🛑 *OFF (Your Bot Only):* ') + (cfg.PREFIX || '.') + 'antiword (' + cfg.ANTI_WORDS.length + ' words)');
            return true;
        }
        if (!cfg.ANTI_WORDS.includes(w)) cfg.ANTI_WORDS.push(w);
        cfg.AUTO.antiWord = true;
        saveConfig(cfg);
        await reply('🗣️ *Blocked Word Added (Your Bot):* ' + w);
        return true;
    }

    if (cmdName === 'autoreact') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const arg = argStr.trim().toLowerCase();
        cfg.AUTO = cfg.AUTO || {};
        if (arg === 'all') {
            cfg.AUTO.autoReact = true;
            cfg.AUTO.allEmojiReact = true;
            saveConfig(cfg);
            await reply('😍 *ALL-EMOJI AUTO REACT ON (Your Bot Only)!*\nAll 140+ emojis will react in a non-repeating shuffled sequence on every message.');
            return true;
        }
        const nextVal = arg === 'on' || arg === 'enable' ? true : (arg === 'off' || arg === 'disable' ? false : !cfg.AUTO.autoReact);
        cfg.AUTO.autoReact = nextVal;
        if (nextVal) cfg.AUTO.allEmojiReact = true;
        saveConfig(cfg);
        await reply((nextVal ? '😍 *ON (Your Bot Only):* ' : '🛑 *OFF (Your Bot Only):* ') + (cfg.PREFIX || '.') + 'autoreact (All 140+ Non-Repeating Emojis)');
        return true;
    }

    if (cmdName === 'autodelete') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const a = argStr.trim().toLowerCase();
        cfg.AUTO = cfg.AUTO || {};
        if (a === 'off' || a === '0') {
            cfg.AUTO.autoDelete = false;
            cfg.AUTO_DEL_SECONDS = 0;
            saveConfig(cfg);
            await reply('🛑 *Auto-Delete OFF!*');
            return true;
        }
        const sec = Math.max(3, Math.min(120, parseInt(a, 10) || 15));
        cfg.AUTO.autoDelete = true;
        cfg.AUTO_DEL_SECONDS = sec;
        saveConfig(cfg);
        await reply('🗑️ *Auto-Delete ON:* Bot replies will auto-delete after ' + sec + 's.');
        return true;
    }

    if (cmdName === 'autoreply') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const raw = argStr.trim();
        cfg.AUTO = cfg.AUTO || {};
        if (!raw || raw.toLowerCase() === 'on') {
            cfg.AUTO.autoReply = true;
            cfg.AUTO_REPLY_TEXT = cfg.AUTO_REPLY_TEXT || ('Hello! ⚡ ' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇" + ' is active and ready.');
            saveConfig(cfg);
            await reply('💬 *AUTO REPLY ON!*\nText: ' + cfg.AUTO_REPLY_TEXT);
            return true;
        }
        if (raw.toLowerCase() === 'off') {
            cfg.AUTO.autoReply = false;
            saveConfig(cfg);
            await reply('🛑 *AUTO REPLY OFF!*');
            return true;
        }
        cfg.AUTO.autoReply = true;
        cfg.AUTO_REPLY_TEXT = raw;
        saveConfig(cfg);
        await reply('💬 *Custom Auto-Reply Set & Enabled:*\n' + raw);
        return true;
    }

    if (cmdName === 'autounblock') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const target = parseTargetJid(msg, argStr);
        if (target) {
            await sock.updateBlockStatus(target, 'unblock').catch(() => {});
            await reply('✅ *Unblocked:* +' + target.split('@')[0]);
            return true;
        }
    }

    // Generic toggle handler for all remaining ANTI & AUTO commands (strictly per paired session)
    if (AUTO_TOGGLE_MAP[cmdName]) {
        if (!isOwner && !isAdmin) { await reply('❌ Owner or Admin only command!'); return true; }
        const key = AUTO_TOGGLE_MAP[cmdName];
        const arg = argStr.trim().toLowerCase();
        cfg.AUTO = cfg.AUTO || {};
        const nextVal = arg === 'on' || arg === 'enable' ? true : (arg === 'off' || arg === 'disable' ? false : !cfg.AUTO[key]);
        cfg.AUTO[key] = nextVal;
        saveConfig(cfg);
        await reply((nextVal ? '✅ *ON (Your Bot Only):* ' : '🛑 *OFF (Your Bot Only):* ') + (cfg.PREFIX || '.') + cmdName);
        return true;
    }

    // Custom dynamic commands added via .setcmd
    if (cfg.CUSTOM_COMMANDS && cfg.CUSTOM_COMMANDS[cmdName]) {
        await reply(cfg.CUSTOM_COMMANDS[cmdName]);
        return true;
    }

    return false;
}

module.exports = { handleSystemAndAutoCommands };
