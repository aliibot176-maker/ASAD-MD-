'use strict';

/**
 * 👥 𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇 - Complete Group Management Suite
 * Handles Section 3: GROUP (33 commands)
 */

function resolveTarget(msg, argStr) {
    const m = msg?.message || {};
    for (const k of ['extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']) {
        const ctx = m[k]?.contextInfo;
        if (ctx?.mentionedJid?.[0]) return ctx.mentionedJid[0];
        if (ctx?.participant) return ctx.participant;
    }
    let digits = String(argStr || '').replace(/[^0-9]/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('03') && digits.length === 11) digits = '92' + digits.slice(1);
    else if (digits.startsWith('3') && digits.length === 10) digits = '92' + digits;
    if (digits.length >= 7 && digits.length <= 16) return digits + '@s.whatsapp.net';
    return null;
}

async function handleGroupCommands(ctx) {
    const {
        sock, from, msg, cmdName, argStr, isGroup, isOwner, isAdmin, botAdmin,
        meta, admins, allJids, cfg, saveConfig
    } = ctx;

    const reply = (text) => sock.sendMessage(from, {
        text: '╭─「 ⚡ *' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇" + '* 」\n' + text + '\n╰──────────────────────◈'
    }, { quoted: msg });

    const GROUP_COMMANDS = new Set([
        'allgroupmessage', 'groupinfo', 'ginfo', 'join', 'leave',
        'link', 'grouplink', 'revoke', 'setgname', 'setgdesc', 'setgpp',
        'open', 'close', 'lock', 'unlock', 'add', 'kick', 'remove',
        'promote', 'demote', 'tagall', 'hidetag', 'tag', 'poll', 'vote',
        'welcome', 'goodbye', 'setwelcome', 'setgoodbye',
        'listadmin', 'admins', 'members', 'invite'
    ]);

    if (!GROUP_COMMANDS.has(cmdName)) return false;

    if (cmdName === 'allgroupmessage') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const text = argStr.trim() || ctx.quotedText;
        if (!text) { await reply('❌ Usage: .allgroupmessage <message>'); return true; }
        const groups = await sock.groupFetchAllParticipating();
        const gids = Object.keys(groups || {});
        if (!gids.length) { await reply('ℹ️ No joined groups found.'); return true; }
        await reply('📢 Sending message to *' + gids.length + '* groups...');
        let sent = 0;
        for (const gid of gids) {
            try {
                const participants = (groups[gid]?.participants || []).map(p => p.id);
                await sock.sendMessage(gid, {
                    text: '╭━━〔 📢 *GROUP ANNOUNCEMENT* 〕━━╮\n\n' + text + '\n\n╰━━━〔 ⚡ *' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇" + '* 〕━━━╯',
                    mentions: participants.slice(0, 150)
                });
                sent++;
            } catch {}
            await new Promise(r => setTimeout(r, 700));
        }
        await reply('✅ Message sent to *' + sent + '/' + gids.length + '* groups!');
        return true;
    }

    if (cmdName === 'join') {
        if (!isOwner) { await reply('❌ Owner only command!'); return true; }
        const m = argStr.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/i);
        if (!m) { await reply('❌ Please provide a valid WhatsApp group invite link!'); return true; }
        try {
            const jid = await sock.groupAcceptInvite(m[1]);
            await reply('✅ Joined group: ' + (jid || m[1]));
        } catch (err) {
            await reply('❌ Join failed: ' + err.message);
        }
        return true;
    }

    if (!isGroup) {
        await reply('❌ This command only works inside WhatsApp groups.');
        return true;
    }

    if (cmdName === 'leave') {
        if (!isOwner && !isAdmin) { await reply('❌ Owner or Group Admin only!'); return true; }
        await reply('👋 Goodbye! Leaving the group...');
        await sock.groupLeave(from).catch(() => {});
        return true;
    }

    if (cmdName === 'groupinfo' || cmdName === 'ginfo') {
        const created = meta?.creation ? new Date(meta.creation * 1000).toLocaleDateString() : 'N/A';
        await reply(
            '👥 *GROUP INFORMATION*\n\n' +
            '• *Name:* ' + (meta?.subject || 'N/A') + '\n' +
            '• *ID:* *' + from + '*\n' +
            '• *Members:* ' + (allJids?.length || 0) + '\n' +
            '• *Admins:* ' + (admins?.length || 0) + '\n' +
            '• *Created:* ' + created + '\n' +
            '• *Locked:* ' + (meta?.restrict ? 'Yes' : 'No') + '\n' +
            '• *Muted:* ' + (meta?.announce ? 'Yes' : 'No') + '\n\n' +
            '📝 *Description:*\n' + (meta?.desc || 'No description')
        );
        return true;
    }

    if (cmdName === 'listadmin' || cmdName === 'admins') {
        const list = (admins || []).map((a, i) => (i + 1) + '. @' + a.id.split('@')[0]).join('\n') || 'None';
        await sock.sendMessage(from, {
            text: '👑 *GROUP ADMINS (' + (admins?.length || 0) + ')*\n\n' + list,
            mentions: (admins || []).map(a => a.id)
        }, { quoted: msg });
        return true;
    }

    if (cmdName === 'members') {
        const sample = (allJids || []).slice(0, 60);
        const list = sample.map((j, i) => (i + 1) + '. @' + j.split('@')[0]).join('\n');
        await sock.sendMessage(from, {
            text: '👥 *GROUP MEMBERS (' + (allJids?.length || 0) + ')*\n\n' + list + ((allJids?.length || 0) > 60 ? '\n_...and more_' : ''),
            mentions: sample
        }, { quoted: msg });
        return true;
    }

    if (cmdName === 'vote') {
        const choice = argStr.trim() || 'Option 1';
        await reply('🗳️ *Vote Recorded:* ' + choice);
        return true;
    }

    if (!isAdmin) {
        await reply('❌ Only Group Admins can use this command!');
        return true;
    }

    if (cmdName === 'tagall') {
        let t = (argStr.trim() ? '📣 *' + argStr.trim() + '*\n\n' : '📣 *TAG ALL MEMBERS*\n\n');
        t += (allJids || []).map(j => '@' + j.split('@')[0]).join(' ');
        await sock.sendMessage(from, { text: t + '\n\n⚡ ' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇", mentions: allJids });
        return true;
    }

    if (cmdName === 'hidetag' || cmdName === 'tag') {
        const text = argStr.trim() || ctx.quotedText || '📣 Attention everyone!';
        await sock.sendMessage(from, { text, mentions: allJids });
        return true;
    }

    if (cmdName === 'poll') {
        const parts = argStr.split('|').map(s => s.trim()).filter(Boolean);
        if (parts.length < 3) {
            await reply('❌ Format: .poll Question | Option 1 | Option 2');
            return true;
        }
        await sock.sendMessage(from, {
            poll: { name: parts[0], values: parts.slice(1, 13), selectableCount: 1 }
        });
        return true;
    }

    if (cmdName === 'welcome' || cmdName === 'goodbye') {
        const arg = argStr.trim().toLowerCase();
        cfg.AUTO = cfg.AUTO || {};
        cfg.SAFETY = cfg.SAFETY || {};
        const key = cmdName === 'welcome' ? 'autoWelcome' : 'autoGoodbye';
        const next = arg === 'on' ? true : arg === 'off' ? false : !cfg.AUTO[key];
        cfg.AUTO[key] = next;
        if (cmdName === 'welcome') cfg.SAFETY.autoWelcome = next;
        saveConfig(cfg);
        await reply((next ? '✅ ' : '🛑 ') + '*' + cmdName.toUpperCase() + '* is now ' + (next ? 'ON' : 'OFF'));
        return true;
    }

    if (cmdName === 'setwelcome' || cmdName === 'setgoodbye') {
        if (!argStr.trim()) { await reply('❌ Usage: .' + cmdName + ' Welcome @user to @group!'); return true; }
        const k = cmdName === 'setwelcome' ? 'WELCOME_TEMPLATE' : 'GOODBYE_TEMPLATE';
        cfg[k] = argStr.trim();
        saveConfig(cfg);
        await reply('✅ *' + cmdName + ' template saved!*');
        return true;
    }

    if (!botAdmin) {
        await reply('❌ Please promote the bot to Group Admin first!');
        return true;
    }

    if (cmdName === 'add') {
        const target = resolveTarget(msg, argStr);
        if (!target) { await reply('❌ Please provide a phone number. Example: .add 923001234567'); return true; }
        try {
            await sock.groupParticipantsUpdate(from, [target], 'add');
            await reply('✅ Add request sent for +' + target.split('@')[0]);
        } catch (err) {
            await reply('❌ Add failed: ' + (err?.message || 'User privacy settings restrict group invites'));
        }
        return true;
    }

    if (cmdName === 'kick' || cmdName === 'remove') {
        const target = resolveTarget(msg, argStr);
        if (!target) { await reply('❌ Mention or reply to a user with .' + cmdName); return true; }
        try {
            await sock.groupParticipantsUpdate(from, [target], 'remove');
            await sock.sendMessage(from, { text: '👢 Removed @' + target.split('@')[0], mentions: [target] });
        } catch (err) {
            await reply('❌ Remove failed: ' + err.message);
        }
        return true;
    }

    if (cmdName === 'promote') {
        const target = resolveTarget(msg, argStr);
        if (!target) { await reply('❌ Please mention or reply to a user.'); return true; }
        try {
            await sock.groupParticipantsUpdate(from, [target], 'promote');
            await sock.sendMessage(from, { text: '⬆️ Promoted @' + target.split('@')[0] + ' to Admin!', mentions: [target] });
        } catch (err) {
            await reply('❌ Promote failed: ' + err.message);
        }
        return true;
    }

    if (cmdName === 'demote') {
        const target = resolveTarget(msg, argStr);
        if (!target) { await reply('❌ Please mention or reply to a user.'); return true; }
        try {
            await sock.groupParticipantsUpdate(from, [target], 'demote');
            await sock.sendMessage(from, { text: '⬇️ Demoted @' + target.split('@')[0], mentions: [target] });
        } catch (err) {
            await reply('❌ Demote failed: ' + err.message);
        }
        return true;
    }

    if (cmdName === 'close') {
        await sock.groupSettingUpdate(from, 'announcement');
        await reply('🔒 *Group Closed!* Only Admins can send messages now.');
        return true;
    }

    if (cmdName === 'open') {
        await sock.groupSettingUpdate(from, 'not_announcement');
        await reply('🔓 *Group Opened!* All members can send messages now.');
        return true;
    }

    if (cmdName === 'lock') {
        await sock.groupSettingUpdate(from, 'locked');
        await reply('🔐 *Group Settings Locked!* (Admins only edit info)');
        return true;
    }

    if (cmdName === 'unlock') {
        await sock.groupSettingUpdate(from, 'unlocked');
        await reply('🔓 *Group Settings Unlocked!*');
        return true;
    }

    if (cmdName === 'link' || cmdName === 'grouplink') {
        const code = await sock.groupInviteCode(from);
        await reply('🔗 *Group Invite Link:*\nhttps://chat.whatsapp.com/' + code);
        return true;
    }

    if (cmdName === 'revoke') {
        const code = await sock.groupRevokeInvite(from);
        await reply('♻️ *New Group Invite Link:*\nhttps://chat.whatsapp.com/' + code);
        return true;
    }

    if (cmdName === 'invite') {
        const target = resolveTarget(msg, argStr);
        if (!target) { await reply('❌ Usage: .invite 923001234567'); return true; }
        const code = await sock.groupInviteCode(from);
        await sock.sendMessage(target, { text: '✉️ *Group Invite:* ' + (meta?.subject || 'WhatsApp Group') + '\nhttps://chat.whatsapp.com/' + code });
        await reply('✅ Invite DM sent to +' + target.split('@')[0]);
        return true;
    }

    if (cmdName === 'setgname') {
        if (!argStr.trim()) { await reply('❌ Usage: .setgname New Group Name'); return true; }
        await sock.groupUpdateSubject(from, argStr.trim());
        await reply('✅ *Group name updated!*');
        return true;
    }

    if (cmdName === 'setgdesc') {
        if (!argStr.trim()) { await reply('❌ Usage: .setgdesc New description'); return true; }
        await sock.groupUpdateDescription(from, argStr.trim());
        await reply('✅ *Group description updated!*');
        return true;
    }

    if (cmdName === 'setgpp') {
        if (!ctx.quotedMedia || ctx.quotedMedia.type !== 'image') { await reply('❌ Reply to an image with .setgpp to update the group DP.'); return true; }
        const buf = await ctx.downloadQuotedBuffer();
        await sock.updateProfilePicture(from, buf);
        await reply('✅ *Group DP updated!*');
        return true;
    }

    return true;
}

module.exports = { handleGroupCommands };
