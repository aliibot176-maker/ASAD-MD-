'use strict';

/**
 * 👁️ 𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇 - Private Inbox View-Once (.vv / .readviewonce / .rvo) Engine
 * - Unlocks View-Once media directly from quotedMessage metadata (even pre-bot messages)
 * - Auto-caches live incoming View-Once media per session
 * - Always delivers unlocked media privately to your own WhatsApp Inbox (botJid) unless "here" is passed
 */

const fs = require('fs');
const path = require('path');

let _baileysDl = null;
async function getDownloadFn(passedFn) {
    if (typeof passedFn === 'function') return passedFn;
    if (!_baileysDl) {
        const mod = await import('@whiskeysockets/baileys');
        _baileysDl = mod.downloadContentFromMessage;
    }
    return _baileysDl;
}

function unwrapContainer(node) {
    let cur = node;
    for (let i = 0; i < 8; i++) {
        if (!cur || typeof cur !== 'object') break;
        if (cur.ephemeralMessage?.message) { cur = cur.ephemeralMessage.message; continue; }
        if (cur.viewOnceMessage?.message) { cur = cur.viewOnceMessage.message; continue; }
        if (cur.viewOnceMessageV2?.message) { cur = cur.viewOnceMessageV2.message; continue; }
        if (cur.viewOnceMessageV2Extension?.message) { cur = cur.viewOnceMessageV2Extension.message; continue; }
        if (cur.documentWithCaptionMessage?.message) { cur = cur.documentWithCaptionMessage.message; continue; }
        if (cur.editedMessage?.message) { cur = cur.editedMessage.message; continue; }
        if (cur.botInvokeMessage?.message) { cur = cur.botInvokeMessage.message; continue; }
        if (cur.associatedChildMessage?.message) { cur = cur.associatedChildMessage.message; continue; }
        break;
    }
    return cur;
}

function getQuotedInfo(msg) {
    const root = unwrapContainer(msg?.message);
    if (!root) return null;
    const types = ['extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'buttonsResponseMessage', 'templateButtonReplyMessage'];
    for (const t of types) {
        const ctx = root[t]?.contextInfo;
        if (ctx?.quotedMessage || ctx?.stanzaId) {
            return {
                stanzaId: ctx.stanzaId || '',
                participant: ctx.participant || '',
                quotedMessage: ctx.quotedMessage || null
            };
        }
    }
    const fallbackCtx = msg?.message?.extendedTextMessage?.contextInfo;
    if (fallbackCtx?.quotedMessage || fallbackCtx?.stanzaId) {
        return {
            stanzaId: fallbackCtx.stanzaId || '',
            participant: fallbackCtx.participant || '',
            quotedMessage: fallbackCtx.quotedMessage || null
        };
    }
    return null;
}

function extractMediaForVV(rawNode, allowAnyMedia = false) {
    if (!rawNode) return null;
    const hasWrapper = Boolean(
        rawNode.viewOnceMessage ||
        rawNode.viewOnceMessageV2 ||
        rawNode.viewOnceMessageV2Extension ||
        rawNode.ephemeralMessage?.message?.viewOnceMessage ||
        rawNode.ephemeralMessage?.message?.viewOnceMessageV2 ||
        rawNode.ephemeralMessage?.message?.viewOnceMessageV2Extension
    );

    const inner = unwrapContainer(rawNode);
    if (!inner) return null;

    if (inner.imageMessage && (allowAnyMedia || hasWrapper || inner.imageMessage.viewOnce)) {
        return { type: 'image', media: inner.imageMessage, caption: inner.imageMessage.caption || '' };
    }
    if (inner.videoMessage && (allowAnyMedia || hasWrapper || inner.videoMessage.viewOnce)) {
        return { type: 'video', media: inner.videoMessage, caption: inner.videoMessage.caption || '' };
    }
    if (inner.audioMessage && (allowAnyMedia || hasWrapper || inner.audioMessage.viewOnce)) {
        return { type: 'audio', media: inner.audioMessage, caption: '' };
    }
    if (inner.documentMessage && allowAnyMedia) {
        return { type: 'document', media: inner.documentMessage, caption: inner.documentMessage.caption || '' };
    }
    return null;
}

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function cacheIncomingViewOnce(msg, cacheDir, autoForwardSock = null, inboxJid = null, downloadFn = null) {
    try {
        if (!msg?.message || !msg.key?.id) return;
        const found = extractMediaForVV(msg.message, false);
        if (!found || !found.media?.mediaKey) return;

        const dl = await getDownloadFn(downloadFn);
        if (typeof dl !== 'function') return;

        fs.mkdirSync(cacheDir, { recursive: true });
        const stream = await dl(found.media, found.type);
        const buf = await streamToBuffer(stream);
        if (!buf.length) return;

        const id = msg.key.id;
        fs.writeFileSync(path.join(cacheDir, id + '.bin'), buf);
        fs.writeFileSync(path.join(cacheDir, id + '.json'), JSON.stringify({
            type: found.type,
            caption: found.caption || '',
            mimetype: found.media.mimetype || '',
            ptt: Boolean(found.media.ptt),
            sender: msg.key.participant || msg.key.remoteJid || ''
        }));

        if (autoForwardSock && inboxJid) {
            const senderLabel = (msg.key.participant || msg.key.remoteJid || '').split('@')[0].split(':')[0];
            const cap = (found.caption ? found.caption + '\n\n' : '') + '👁️ *Anti-ViewOnce Auto-Saved*\n👤 From: +' + senderLabel;
            if (found.type === 'image') await autoForwardSock.sendMessage(inboxJid, { image: buf, caption: cap }).catch(() => {});
            else if (found.type === 'video') await autoForwardSock.sendMessage(inboxJid, { video: buf, caption: cap }).catch(() => {});
            else await autoForwardSock.sendMessage(inboxJid, { audio: buf, mimetype: found.media.mimetype || 'audio/ogg; codecs=opus', ptt: Boolean(found.media.ptt) }).catch(() => {});
        }

        const metas = fs.readdirSync(cacheDir)
            .filter(f => f.endsWith('.json'))
            .map(f => ({ f, t: fs.statSync(path.join(cacheDir, f)).mtimeMs }))
            .sort((a, b) => a.t - b.t);
        while (metas.length > 120) {
            const old = metas.shift();
            const base = old.f.replace(/\.json$/, '');
            try { fs.unlinkSync(path.join(cacheDir, base + '.json')); } catch {}
            try { fs.unlinkSync(path.join(cacheDir, base + '.bin')); } catch {}
        }
    } catch {}
}

async function handleViewOnceCommand({ sock, from, msg, cmdName, argStr, botName, inboxJid, cacheDir, downloadFn, messageStore }) {
    if (!['vv', 'readviewonce', 'rvo'].includes(cmdName)) {
        return false;
    }

    const sendHere = String(argStr || '').toLowerCase().includes('here');
    const targetJid = sendHere ? from : (inboxJid || from);
    const quoted = getQuotedInfo(msg);

    if (!quoted) {
        await sock.sendMessage(from, {
            text: '👁️ Reply to any *View Once* photo, video, or audio with *.vv* to unlock and save it privately to your WhatsApp Inbox! (Use *.vv here* to send in this chat)\n\n⚡ ' + botName
        }, { quoted: msg });
        return true;
    }

    if (cacheDir && quoted.stanzaId) {
        const metaFile = path.join(cacheDir, quoted.stanzaId + '.json');
        const binFile  = path.join(cacheDir, quoted.stanzaId + '.bin');
        if (fs.existsSync(metaFile) && fs.existsSync(binFile)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
                const buf  = fs.readFileSync(binFile);
                const cap  = (meta.caption ? meta.caption + '\n\n' : '') + '👁️ *View Once Private Save*\n👤 Chat: +' + from.split('@')[0].split(':')[0] + '\n⚡ ' + botName;
                if (meta.type === 'image') await sock.sendMessage(targetJid, { image: buf, caption: cap });
                else if (meta.type === 'video') await sock.sendMessage(targetJid, { video: buf, caption: cap });
                else await sock.sendMessage(targetJid, { audio: buf, mimetype: meta.mimetype || 'audio/ogg; codecs=opus', ptt: Boolean(meta.ptt) });
                if (from !== targetJid) await sock.sendMessage(from, { react: { text: '👁️', key: msg.key } }).catch(() => {});
                return true;
            } catch {}
        }
    }

    let rawQuoted = quoted.quotedMessage;
    if ((!rawQuoted || !extractMediaForVV(rawQuoted, true)?.media?.mediaKey) && messageStore && quoted.stanzaId) {
        const cachedMsg = messageStore.get(quoted.stanzaId);
        if (cachedMsg) rawQuoted = cachedMsg.message || cachedMsg;
    }

    const found = extractMediaForVV(rawQuoted, true);
    if (!found || !found.media?.mediaKey) {
        await sock.sendMessage(from, {
            text: '❌ View-Once media metadata was not found in this reply (if the message was opened and expired before the bot connected, WhatsApp clears its CDN key).\n\n⚡ ' + botName
        }, { quoted: msg });
        return true;
    }

    try {
        const dl = await getDownloadFn(downloadFn);
        const stream = await dl(found.media, found.type);
        const buffer = await streamToBuffer(stream);
        const senderLabel = (quoted.participant || from).split('@')[0].split(':')[0];
        const cap = (found.caption ? found.caption + '\n\n' : '') + '👁️ *View Once Unlocked (Private Inbox)*\n👤 From: +' + senderLabel + '\n⚡ ' + botName;

        if (found.type === 'image') await sock.sendMessage(targetJid, { image: buffer, caption: cap });
        else if (found.type === 'video') await sock.sendMessage(targetJid, { video: buffer, caption: cap });
        else if (found.type === 'document') await sock.sendMessage(targetJid, { document: buffer, mimetype: found.media.mimetype || 'application/octet-stream', fileName: found.media.fileName || 'viewonce_file', caption: cap });
        else await sock.sendMessage(targetJid, { audio: buffer, mimetype: found.media.mimetype || 'audio/ogg; codecs=opus', ptt: Boolean(found.media.ptt) });

        if (from !== targetJid) await sock.sendMessage(from, { react: { text: '👁️', key: msg.key } }).catch(() => {});
    } catch (err) {
        await sock.sendMessage(from, {
            text: '❌ View Once download fail: ' + err.message + '\n\n⚡ ' + botName
        }, { quoted: msg });
    }
    return true;
}

module.exports = {
    unwrapContainer,
    getQuotedInfo,
    extractMediaForVV,
    cacheIncomingViewOnce,
    handleViewOnceCommand
};
