'use strict';

/**
 * 📥 𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇 - Complete Downloader Suite
 * Handles Section 4: DOWNLOAD (28 commands)
 */

const axios = require('axios');
const yt = require('../youtube');
const { toAudio } = require('../converter');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const AX = { timeout: 45000, headers: { 'User-Agent': UA, Accept: '*/*' } };

async function callMultiApi(endpoints) {
    for (const fn of endpoints) {
        try {
            const res = await fn();
            if (res) return res;
        } catch {}
    }
    return null;
}

async function handleMediaAndDownloaderCommands(ctx) {
    const { sock, from, msg, cmdName, argStr } = ctx;
    const reply = (text) => sock.sendMessage(from, {
        text: '╭─「 ⚡ *' + "𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇" + '* 」\n' + text + '\n╰──────────────────────◈'
    }, { quoted: msg });

    // 1. AUDIO / SONG DOWNLOADER (.play .song .ytmp3 .ytaudio .spotify .soundcloud)
    if (['play', 'song', 'ytmp3', 'ytaudio', 'spotify', 'soundcloud'].includes(cmdName)) {
        let query = argStr.trim();
        if (!query) { await reply('❌ Enter a song name or link! Example: .' + cmdName + ' Pasoori'); return true; }
        try { await sock.sendMessage(from, { react: { text: '🎵', key: msg.key } }); } catch {}

        if (/open\.spotify\.com\/track\//i.test(query)) {
            try {
                const sp = await axios.get('https://open.spotify.com/oembed?url=' + encodeURIComponent(query), { timeout: 10000 });
                if (sp?.data?.title) query = sp.data.title + ' audio';
            } catch {}
        }
        if (/soundcloud\.com\//i.test(query)) {
            const slug = query.split('?')[0].split('/').filter(Boolean).pop() || '';
            if (slug) query = slug.replace(/[-_]+/g, ' ');
        }

        let targetUrl = yt.normalizeUrl(query);
        let title = query;
        let thumb = '';
        let duration = '';
        if (!targetUrl) {
            const found = await yt.search(query);
            if (!found) { await reply('❌ Song not found! Please try a different title.'); return true; }
            targetUrl = found.url;
            title = found.title || title;
            thumb = found.thumbnail || '';
            duration = found.duration || '';
        } else {
            thumb = yt.thumbnailFor(yt.extractVideoId(targetUrl));
        }

        const cardCaption =
            '╭━━〔 🎵 *NOW PLAYING* 〕━━╮\n' +
            '┃ 📌 *Title:* ' + title + '\n' +
            (duration ? '┃ ⏱️ *Duration:* ' + duration + '\n' : '') +
            '┃ ⏳ _Downloading MP3 audio..._\n' +
            '╰━━━━━━━━━━━━━━━━━━━━━━╯';

        if (thumb) {
            await sock.sendMessage(from, { image: { url: thumb }, caption: cardCaption }, { quoted: msg }).catch(() => reply(cardCaption));
        } else {
            await reply(cardCaption);
        }

        const dl = await yt.download('audio', targetUrl);
        if (!dl.ok) {
            const reason = (dl.errors || []).slice(0, 2).join(' | ');
            await reply('❌ Audio download failed!\n' + (reason ? '_Details: ' + reason + '_' : 'Please try again in a moment.'));
            return true;
        }
        let buf = dl.buffer;
        try { buf = await toAudio(buf); } catch {}
        const safeName = (dl.title || title).replace(/[^a-zA-Z0-9 _.-]/g, '').slice(0, 50) || 'song';
        await sock.sendMessage(from, {
            audio: buf,
            mimetype: 'audio/mpeg',
            fileName: safeName + '.mp3',
            ptt: false
        }, { quoted: msg });
        return true;
    }

    // 2. VIDEO DOWNLOADER (.video .ytmp4 .ytvideo)
    if (['video', 'ytmp4', 'ytvideo'].includes(cmdName)) {
        if (!argStr.trim()) { await reply('❌ Enter a video title or YouTube link! Example: .' + cmdName + ' Faded'); return true; }
        try { await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } }); } catch {}
        let targetUrl = yt.normalizeUrl(argStr);
        let title = argStr.trim();
        if (!targetUrl) {
            const found = await yt.search(argStr.trim());
            if (!found) { await reply('❌ Video not found!'); return true; }
            targetUrl = found.url;
            title = found.title || title;
        }
        const dl = await yt.download('video', targetUrl);
        if (!dl.ok) { await reply('❌ Video download failed. Please try again.'); return true; }
        const cap = '🎬 *' + (dl.title || title) + '*\n👑 ' + "𝛥𝑆𝛥𝐷";
        if (dl.buffer.length > yt.LIMITS.videoInlineMaxBytes) {
            await sock.sendMessage(from, { document: dl.buffer, mimetype: 'video/mp4', fileName: 'video.mp4', caption: cap }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { video: dl.buffer, mimetype: 'video/mp4', caption: cap }, { quoted: msg });
        }
        return true;
    }

    // 3. YOUTUBE SEARCH (.yts)
    if (cmdName === 'yts') {
        if (!argStr.trim()) { await reply('❌ Usage: .yts <query>'); return true; }
        let ytsLib = null;
        try { ytsLib = require('yt-search'); } catch {}
        if (!ytsLib) { await reply('❌ yt-search module is not installed.'); return true; }
        const res = await ytsLib(argStr.trim());
        const list = (res?.videos || []).slice(0, 6);
        if (!list.length) { await reply('❌ No results found.'); return true; }
        const text = '🔍 *YOUTUBE SEARCH: ' + argStr.trim() + '*\n\n' + list.map((v, i) => (i + 1) + '. *' + v.title + '* (' + (v.timestamp || 'N/A') + ')\n   ' + v.url).join('\n\n');
        await reply(text);
        return true;
    }

    // 4. TIKTOK (.tiktok .tiktokdl)
    if (cmdName === 'tiktok' || cmdName === 'tiktokdl') {
        if (!argStr.includes('tiktok.com')) { await reply('❌ Please provide a valid TikTok link! Example: .' + cmdName + ' https://vt.tiktok.com/...'); return true; }
        try { await sock.sendMessage(from, { react: { text: '📥', key: msg.key } }); } catch {}
        const d = await callMultiApi([
            async () => { const r = await axios.get('https://www.tikwm.com/api/?url=' + encodeURIComponent(argStr.trim()), AX); return r?.data?.data || null; },
            async () => { const r = await axios.get('https://api.siputzx.my.id/api/d/tiktok?url=' + encodeURIComponent(argStr.trim()), AX); const x = r?.data?.data; return x ? { play: x.urls?.[0] || x.video, music: x.music, title: x.title || '' } : null; },
            async () => { const r = await axios.get('https://apis.davidcyriltech.my.id/download/tiktok?url=' + encodeURIComponent(argStr.trim()), AX); const x = r?.data?.result; return x ? { play: x.video || x.nowm, music: x.music, title: x.desc || '' } : null; }
        ]);
        if (!d) { await reply('❌ TikTok download failed. Please check the URL.'); return true; }
        if (Array.isArray(d.images) && d.images.length) {
            for (const img of d.images.slice(0, 6)) {
                await sock.sendMessage(from, { image: { url: img }, caption: '📸 *TikTok Slide*' }, { quoted: msg });
            }
        } else if (d.play) {
            await sock.sendMessage(from, { video: { url: d.play }, caption: '✅ *TikTok No-Watermark*\n📌 ' + (d.title || '') }, { quoted: msg });
        } else {
            await reply('❌ Could not extract video URL.');
        }
        return true;
    }

    // 5. INSTAGRAM (.insta .igdl .instagram)
    if (['insta', 'igdl', 'instagram'].includes(cmdName)) {
        if (!argStr.trim()) { await reply('❌ Please provide an Instagram link or username!'); return true; }
        const url = argStr.trim().startsWith('http') ? argStr.trim() : 'https://www.instagram.com/' + argStr.trim().replace(/^@/, '') + '/';
        const items = await callMultiApi([
            async () => { const r = await axios.get('https://api.siputzx.my.id/api/d/igdl?url=' + encodeURIComponent(url), AX); return r?.data?.data; },
            async () => { const r = await axios.get('https://api.vreden.my.id/api/igdownload?url=' + encodeURIComponent(url), AX); return r?.data?.result; },
            async () => { const r = await axios.get('https://apis.davidcyriltech.my.id/instagram?url=' + encodeURIComponent(url), AX); return r?.data?.result; },
            async () => { const r = await axios.get('https://api.ryzendesu.vip/api/downloader/igdl?url=' + encodeURIComponent(url), AX); return r?.data?.data; }
        ]);
        if (!Array.isArray(items) || !items.length) { await reply('❌ No public Instagram media found.'); return true; }
        for (const it of items.slice(0, 5)) {
            const mUrl = it.url || it.download_url || it.src;
            if (!mUrl) continue;
            const isVid = it.type === 'video' || /\.(mp4|mov)/i.test(mUrl);
            await sock.sendMessage(from, isVid ? { video: { url: mUrl }, caption: '✅ *Instagram Video*' } : { image: { url: mUrl }, caption: '✅ *Instagram Photo*' }, { quoted: msg });
        }
        return true;
    }

    // 6. FACEBOOK (.fb .fbdl)
    if (['fb', 'fbdl'].includes(cmdName)) {
        if (!/^https?:\/\//i.test(argStr.trim())) { await reply('❌ Please provide a valid Facebook video link! Example: .' + cmdName + ' https://www.facebook.com/...'); return true; }
        try { await sock.sendMessage(from, { react: { text: '📘', key: msg.key } }); } catch {}
        const target = argStr.trim();
        const mediaUrl = await callMultiApi([
            async () => { const r = await axios.get('https://api.siputzx.my.id/api/d/fbdl?url=' + encodeURIComponent(target), AX); return r?.data?.data?.[0]?.url || r?.data?.data?.hd || r?.data?.data?.sd; },
            async () => { const r = await axios.get('https://api.vreden.my.id/api/fbdl?url=' + encodeURIComponent(target), AX); return r?.data?.data?.hd || r?.data?.data?.sd || r?.data?.result?.url; },
            async () => { const r = await axios.get('https://apis.davidcyriltech.my.id/facebook?url=' + encodeURIComponent(target), AX); return r?.data?.video?.hd || r?.data?.video?.sd; },
            async () => { const r = await axios.get('https://api.ryzendesu.vip/api/downloader/fbdl?url=' + encodeURIComponent(target), AX); return r?.data?.data?.[0]?.url; }
        ]);
        if (!mediaUrl) { await reply('❌ Could not resolve Facebook download URL.'); return true; }
        await sock.sendMessage(from, { video: { url: mediaUrl }, caption: '✅ *Downloaded via ' + cmdName.toUpperCase() + '*' }, { quoted: msg }).catch(() => reply('🔗 *Direct Link:* ' + mediaUrl));
        return true;
    }

    // 6b. X / TWITTER (.twitter .xdl)
    if (['twitter', 'xdl'].includes(cmdName)) {
        if (!/^https?:\/\//i.test(argStr.trim())) { await reply('❌ Please provide a valid X/Twitter link! Example: .' + cmdName + ' https://x.com/...'); return true; }
        try { await sock.sendMessage(from, { react: { text: '🐦', key: msg.key } }); } catch {}
        const target = argStr.trim();
        const twMatch = target.match(/(?:twitter\.com|x\.com)\/([^/]+\/status\/\d+)/i);
        const mediaOut = await callMultiApi([
            async () => {
                if (!twMatch) return null;
                const r = await axios.get('https://api.vxtwitter.com/' + twMatch[1], AX);
                const item = r?.data?.media_extended?.[0];
                if (item?.url) return { url: item.url, type: item.type === 'image' ? 'image' : 'video', caption: r?.data?.text || '' };
                return null;
            },
            async () => {
                if (!twMatch) return null;
                const r = await axios.get('https://api.fxtwitter.com/' + twMatch[1], AX);
                const vid = r?.data?.tweet?.media?.videos?.[0]?.url;
                const img = r?.data?.tweet?.media?.photos?.[0]?.url;
                if (vid) return { url: vid, type: 'video', caption: r?.data?.tweet?.text || '' };
                if (img) return { url: img, type: 'image', caption: r?.data?.tweet?.text || '' };
                return null;
            },
            async () => {
                const r = await axios.get('https://api.siputzx.my.id/api/d/twitter?url=' + encodeURIComponent(target), AX);
                const u = r?.data?.data?.downloadLink || r?.data?.data?.video_hd || r?.data?.data?.video_sd || r?.data?.data?.[0]?.url;
                return u ? { url: u, type: 'video', caption: '' } : null;
            },
            async () => {
                const r = await axios.get('https://apis.davidcyriltech.my.id/twitter?url=' + encodeURIComponent(target), AX);
                const u = r?.data?.video_hd || r?.data?.video_sd || r?.data?.download;
                return u ? { url: u, type: 'video', caption: '' } : null;
            }
        ]);
        if (!mediaOut?.url) { await reply('❌ Could not resolve X/Twitter media URL.'); return true; }
        const cap = '✅ *Downloaded from X/Twitter*' + (mediaOut.caption ? '\n📝 ' + mediaOut.caption.slice(0, 200) : '');
        if (mediaOut.type === 'image') {
            await sock.sendMessage(from, { image: { url: mediaOut.url }, caption: cap }, { quoted: msg }).catch(() => reply('🔗 *Direct Link:* ' + mediaOut.url));
        } else {
            await sock.sendMessage(from, { video: { url: mediaOut.url }, caption: cap }, { quoted: msg }).catch(() => reply('🔗 *Direct Link:* ' + mediaOut.url));
        }
        return true;
    }

    // 7. PINTEREST & IMAGE SEARCH (.pinterest .pin .image)
    if (['pinterest', 'pin', 'image'].includes(cmdName)) {
        if (!argStr.trim()) { await reply('❌ Enter a search query or Pinterest link! Example: .' + cmdName + ' Nature'); return true; }
        const q = argStr.trim();
        if (/^https?:\/\/(?:www\.)?(?:pinterest\.|pin\.it)/i.test(q)) {
            const pinDl = await callMultiApi([
                async () => { const r = await axios.get('https://api.siputzx.my.id/api/d/pinterest?url=' + encodeURIComponent(q), AX); return r?.data?.data?.url || r?.data?.data?.image || r?.data?.data?.[0]?.url; },
                async () => { const r = await axios.get('https://apis.davidcyriltech.my.id/pinterest?url=' + encodeURIComponent(q), AX); return r?.data?.result?.url || r?.data?.url; }
            ]);
            if (pinDl) {
                const isVid = /\.(mp4|mov)/i.test(pinDl);
                await sock.sendMessage(from, isVid ? { video: { url: pinDl }, caption: '📌 *Pinterest Video*' } : { image: { url: pinDl }, caption: '📌 *Pinterest Pin*' }, { quoted: msg });
                return true;
            }
        }
        const r = await axios.get('https://api.siputzx.my.id/api/s/pinterest?query=' + encodeURIComponent(q), AX).catch(() => null);
        const list = r?.data?.data || [];
        if (list.length) {
            const pick = list[Math.floor(Math.random() * Math.min(list.length, 6))];
            const imgUrl = pick.images_url || pick.image || pick.url;
            if (imgUrl) {
                try {
                    await sock.sendMessage(from, { image: { url: imgUrl }, caption: '🖼️ *Image:* ' + q }, { quoted: msg });
                    return true;
                } catch {}
            }
        }
        // Fallback Wikipedia & Wikimedia Commons image search with required User-Agent
        const wikiHeaders = { 'User-Agent': 'ASAD-MD-Bot/5.0 (https://whatsapp.com)', 'Api-User-Agent': 'ASAD-MD-Bot/5.0' };
        const wiki = await axios.get('https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) + '&prop=pageimages&format=json&piprop=original&gsrlimit=5', { timeout: 15000, headers: wikiHeaders }).catch(() => null);
        const pages = Object.values(wiki?.data?.query?.pages || {});
        const imgFound = pages.find(p => p?.original?.source)?.original?.source;
        if (imgFound) {
            await sock.sendMessage(from, { image: { url: imgFound }, caption: '🖼️ *Image:* ' + q }, { quoted: msg });
            return true;
        }
        const commons = await axios.get('https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(q) + '&prop=imageinfo&iiprop=url&format=json&gsrlimit=5', { timeout: 15000, headers: wikiHeaders }).catch(() => null);
        const cPages = Object.values(commons?.data?.query?.pages || {});
        const cUrl = cPages.find(p => /\.(jpe?g|png|webp)$/i.test(p?.imageinfo?.[0]?.url || ''))?.imageinfo?.[0]?.url;
        if (cUrl) {
            await sock.sendMessage(from, { image: { url: cUrl }, caption: '🖼️ *Image:* ' + q }, { quoted: msg });
        } else {
            await reply('❌ No image found. Please try a different keyword.');
        }
        return true;
    }

    // 8. GOOGLE SEARCH (.google)
    if (cmdName === 'google') {
        if (!argStr.trim()) { await reply('❌ Usage: .google <search query>'); return true; }
        const q = argStr.trim();
        const ddg = await axios.get('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1', AX).catch(() => null);
        let abs = ddg?.data?.AbstractText || '';
        const related = (ddg?.data?.RelatedTopics || []).filter(t => t?.Text && t?.FirstURL).slice(0, 5);
        if (!abs && !related.length) {
            const wikiS = await axios.get('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(q) + '&format=json&srlimit=4', { timeout: 15000, headers: { 'User-Agent': 'ASAD-MD-Bot/5.0' } }).catch(() => null);
            const hits = wikiS?.data?.query?.search || [];
            if (hits.length) {
                abs = hits.map((h, i) => (i + 1) + '. *' + h.title + '*\n   ' + String(h.snippet || '').replace(/<[^>]+>/g, '')).join('\n\n');
            }
        }
        let body = '🌐 *SEARCH RESULTS: ' + q + '*\n\n';
        if (abs) body += '📝 ' + abs + '\n\n';
        if (related.length) {
            body += related.map((r, i) => (i + 1) + '. ' + r.Text + '\n   🔗 ' + r.FirstURL).join('\n\n') + '\n\n';
        }
        body += '🔗 *Google Link:* https://www.google.com/search?q=' + encodeURIComponent(q);
        await reply(body);
        return true;
    }

    // 9. GOOGLE DRIVE, MEDIAFIRE, TERABOX, APK (.gdrive .mediafire .terabox .apk .apkdl)
    if (cmdName === 'gdrive') {
        const m = argStr.match(/(?:file\/d\/|id=)([A-Za-z0-9_-]{15,})/);
        if (!m) { await reply('❌ Please provide a valid Google Drive link!'); return true; }
        const dlUrl = 'https://drive.google.com/uc?export=download&id=' + m[1];
        await reply('💽 *Google Drive Direct Link:*\n' + dlUrl);
        return true;
    }

    if (cmdName === 'apk' || cmdName === 'apkdl') {
        if (!argStr.trim()) { await reply('❌ Enter an app name! Example: .' + cmdName + ' WhatsApp'); return true; }
        const q = encodeURIComponent(argStr.trim());
        await reply('📱 *APK DOWNLOAD LINKS (' + argStr.trim() + ')*\n\n• *APKPure:* https://apkpure.com/search?q=' + q + '\n• *APKMirror:* https://www.apkpure.net/search?q=' + q + '\n• *Play Store:* https://play.google.com/store/search?q=' + q + '&c=apps');
        return true;
    }

    if (cmdName === 'mediafire' || cmdName === 'terabox') {
        if (!argStr.trim()) { await reply('❌ Please provide a valid ' + cmdName.toUpperCase() + ' link!'); return true; }
        const urlArg = argStr.trim();
        if (cmdName === 'mediafire' && urlArg.includes('mediafire.com')) {
            const page = await axios.get(urlArg, AX).catch(() => null);
            const m = String(page?.data || '').match(/id="downloadButton"[^>]+href="(https?:\/\/[^"]+)"/i);
            if (m) {
                await reply('💾 *MediaFire Direct Link:*\n' + m[1]);
                return true;
            }
        }
        const dl = await callMultiApi(cmdName === 'terabox' ? [
            async () => { const r = await axios.get('https://api.siputzx.my.id/api/d/terabox?url=' + encodeURIComponent(urlArg), AX); return r?.data?.data?.[0]?.downloadLink || r?.data?.data?.downloadLink || r?.data?.data?.[0]?.url; },
            async () => { const r = await axios.get('https://apis.davidcyriltech.my.id/terabox?url=' + encodeURIComponent(urlArg), AX); return r?.data?.download_link || r?.data?.result?.[0]?.download_link; }
        ] : [
            async () => { const r = await axios.get('https://api.siputzx.my.id/api/d/mediafire?url=' + encodeURIComponent(urlArg), AX); return r?.data?.data?.downloadLink; },
            async () => { const r = await axios.get('https://apis.davidcyriltech.my.id/mediafire?url=' + encodeURIComponent(urlArg), AX); return r?.data?.downloadLink || r?.data?.result?.link; }
        ]);
        await reply(dl ? '📥 *Direct Download:*\n' + dl : '📦 *Target Link:* ' + urlArg + '\n(Public link required for direct extraction)');
        return true;
    }

    return false;
}

module.exports = { handleMediaAndDownloaderCommands };
