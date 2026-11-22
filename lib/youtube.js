'use strict';

/**
 * ⚡ 𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇 - Multi-Engine YouTube Search & Downloader
 * Engines: yt-dlp -> @vreden/youtube_scraper -> youtubei.js (Innertube) -> @distube/ytdl-core -> Live REST APIs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

let axios = null, yts = null, ytdl = null, vredenYt = null;
try { axios = require('axios'); } catch {}
try { yts = require('yt-search'); } catch {}
try { ytdl = require('@distube/ytdl-core'); } catch {}
try { vredenYt = require('@vreden/youtube_scraper'); } catch {}

let innertubePromise = null;
async function getInnertube() {
    if (!innertubePromise) {
        innertubePromise = (async () => {
            const mod = await import('youtubei.js');
            const Innertube = mod.Innertube || mod.default;
            return Innertube.create({ generate_session_locally: true });
        })().catch(() => null);
    }
    return innertubePromise;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const LIMITS = {
    audioMaxBytes: 50 * 1024 * 1024,
    videoMaxBytes: 64 * 1024 * 1024,
    videoInlineMaxBytes: 16 * 1024 * 1024,
    audioMinBytes: 5 * 1024,
    videoMinBytes: 20 * 1024,
    maxAudioSeconds: 60 * 60,
    maxVideoSeconds: 30 * 60
};

const PROVIDERS = [
    { name: 'siputzx',
      audio: 'https://api.siputzx.my.id/api/d/ytmp3?url=',
      video: 'https://api.siputzx.my.id/api/d/ytmp4?url=' },
    { name: 'vreden',
      audio: 'https://api.vreden.my.id/api/ytmp3?url=',
      video: 'https://api.vreden.my.id/api/ytmp4?url=' },
    { name: 'davidcyril',
      audio: 'https://apis.davidcyriltech.my.id/download/ytmp3?url=',
      video: 'https://apis.davidcyriltech.my.id/download/ytmp4?url=' },
    { name: 'keith',
      audio: 'https://apis-keith.vercel.app/download/dlmp3?url=',
      video: 'https://apis-keith.vercel.app/download/dlmp4?url=' },
    { name: 'ryzendesu',
      audio: 'https://api.ryzendesu.vip/api/downloader/ytmp3?url=',
      video: 'https://api.ryzendesu.vip/api/downloader/ytmp4?url=' },
    { name: 'eliteprotech',
      audio: 'https://eliteprotech-apis.zone.id/download/ytmp3?url=',
      video: 'https://eliteprotech-apis.zone.id/download/ytmp4?url=' }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const errMsg = e => String(e && e.message ? e.message : e).slice(0, 90);

function withTimeout(promise, ms, label) {
    let timer;
    const t = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(label || 'timeout')), ms); });
    return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

function collectStream(stream, ms, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0, done = false, timer = null;
        const finish = (err, val) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (err) { try { stream.destroy(); } catch {} reject(err); }
            else resolve(val);
        };
        timer = setTimeout(() => finish(new Error('timeout')), ms);
        stream.on('data', c => {
            size += c.length;
            if (size > maxBytes) return finish(new Error('file too large'));
            chunks.push(c);
        });
        stream.on('end', () => finish(null, Buffer.concat(chunks)));
        stream.on('error', e => finish(e));
    });
}

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i;
function extractVideoId(text) {
    const m = String(text || '').match(YT_RE);
    return m ? m[1] : null;
}

function normalizeUrl(text) {
    const id = extractVideoId(text);
    return id ? 'https://www.youtube.com/watch?v=' + id : null;
}

function thumbnailFor(id) {
    return id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '';
}

async function searchHtmlFallback(query) {
    if (!axios) return null;
    try {
        const r = await axios.get('https://www.youtube.com/results?search_query=' + encodeURIComponent(query), {
            timeout: 15000,
            headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }
        });
        const m = String(r.data || '').match(/"videoId":"([\w-]{11})"[\s\S]{0,600}?"title":\{"runs":\[\{"text":"([^"]+)"/);
        if (m) {
            return {
                url: 'https://www.youtube.com/watch?v=' + m[1],
                title: m[2].replace(/\\u0026/g, '&'),
                thumbnail: thumbnailFor(m[1]),
                duration: '',
                seconds: 0,
                author: ''
            };
        }
    } catch {}
    return null;
}

async function search(query) {
    if (yts) {
        for (let i = 0; i < 2; i++) {
            try {
                const res = await withTimeout(yts(query), 15000, 'search timeout');
                const list = (res && res.videos) || [];
                const v = list.find(x => x && x.url && x.seconds > 0) || list.find(x => x && x.url);
                if (v) return {
                    url: v.url, title: v.title, thumbnail: v.thumbnail,
                    duration: v.timestamp || '', seconds: v.seconds || 0,
                    author: (v.author && v.author.name) || ''
                };
                break;
            } catch {
                await sleep(600);
            }
        }
    }
    try {
        const yt = await getInnertube();
        if (yt) {
            const res = await withTimeout(yt.search(query, { type: 'video' }), 15000, 'innertube search timeout');
            const v = (res && res.videos || []).find(x => x && x.id);
            if (v) return {
                url: 'https://www.youtube.com/watch?v=' + v.id,
                title: String(v.title?.text || v.title || query),
                thumbnail: thumbnailFor(v.id),
                duration: v.duration?.text || '',
                seconds: v.duration?.seconds || 0,
                author: v.author?.name || ''
            };
        }
    } catch {}
    return searchHtmlFallback(query);
}

const SKIP_KEY = /thumb|image|img|cover|poster|avatar|channel|author|icon|logo|banner/i;
const GOOD_KEY = /download|dl|link|url|file|mp3|mp4|audio|video|stream/i;

function pickDownloadUrl(data, ytUrl) {
    const found = [];
    const walk = (node, key, depth) => {
        if (node == null || depth > 7) return;
        if (typeof node === 'string') {
            const s = node.trim();
            if (!/^https?:\/\//i.test(s)) return;
            if (SKIP_KEY.test(key)) return;
            if (/(?:youtube\.com|youtu\.be|ytimg\.com)\//i.test(s)) return;
            if (/\.(?:jpg|jpeg|png|webp|gif|svg)(\?|#|$)/i.test(s)) return;
            if (ytUrl && s === ytUrl) return;
            let score = 0;
            if (GOOD_KEY.test(key)) score += 2;
            if (/\.(mp3|mp4|m4a|webm|opus|aac)(\?|#|$)/i.test(s)) score += 3;
            if (/download|dl|file|stream|googlevideo/i.test(s)) score += 1;
            found.push({ url: s, score });
            return;
        }
        if (Array.isArray(node)) { node.forEach(n => walk(n, key, depth + 1)); return; }
        if (typeof node === 'object') for (const k of Object.keys(node)) walk(node[k], k, depth + 1);
    };
    walk(data, '', 0);
    if (!found.length) return null;
    found.sort((a, b) => b.score - a.score);
    return found[0].url;
}

function pickTitle(d) {
    const queue = [[d, 0]];
    while (queue.length) {
        const [node, depth] = queue.shift();
        if (!node || typeof node !== 'object' || depth > 5) continue;
        if (!Array.isArray(node) && typeof node.title === 'string' && node.title.trim()) return node.title.trim();
        for (const k of Object.keys(node)) queue.push([node[k], depth + 1]);
    }
    return '';
}

function parseApiResponse(data, ytUrl) {
    if (data == null) return null;
    if (typeof data === 'string') {
        const s = data.trim();
        return /^https?:\/\/\S+$/i.test(s) ? { dl: s, title: '' } : null;
    }
    if (data.status === false || data.success === false || data.ok === false) {
        throw new Error('API error');
    }
    const dl = pickDownloadUrl(data, ytUrl);
    return dl ? { dl, title: pickTitle(data) } : null;
}

async function fetchBuffer(url, kind) {
    const max = kind === 'audio' ? LIMITS.audioMaxBytes : LIMITS.videoMaxBytes;
    const r = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: kind === 'audio' ? 90000 : 150000,
        maxContentLength: max, maxBodyLength: max, maxRedirects: 5,
        headers: { 'User-Agent': UA, Accept: '*/*' }
    });
    return Buffer.from(r.data);
}

function isMedia(buf, kind) {
    if (!buf || !buf.length) return false;
    const min = kind === 'audio' ? LIMITS.audioMinBytes : LIMITS.videoMinBytes;
    if (buf.length < min) return false;
    const first = buf[0];
    if (first === 0x3c || first === 0x7b) return false; // reject HTML '<' or JSON '{'
    return true;
}

async function viaYtDlp(kind, ytUrl) {
    const tmpDir = path.join(__dirname, '../temp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outTpl = path.join(tmpDir, 'ytdlp_' + crypto.randomBytes(5).toString('hex') + '.%(ext)s');
    const args = kind === 'audio'
        ? ['-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--no-playlist', '--max-filesize', '48M', '-o', outTpl, ytUrl]
        : ['-f', 'best[ext=mp4][height<=480]/best[ext=mp4]/best', '--no-playlist', '--max-filesize', '60M', '-o', outTpl, ytUrl];
    await new Promise((resolve, reject) => {
        execFile('yt-dlp', args, { timeout: 90000 }, (err) => err ? reject(err) : resolve());
    });
    const prefix = path.basename(outTpl).split('.')[0];
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(prefix));
    if (!files.length) return null;
    const full = path.join(tmpDir, files[0]);
    try {
        const buffer = fs.readFileSync(full);
        return { buffer, title: '' };
    } finally {
        try { fs.unlinkSync(full); } catch {}
    }
}

async function viaVredenScraper(kind, ytUrl) {
    if (!vredenYt) return null;
    const res = kind === 'audio'
        ? await withTimeout(vredenYt.ytmp3(ytUrl, '128'), 28000, 'vreden timeout')
        : await withTimeout(vredenYt.ytmp4(ytUrl, '480'), 35000, 'vreden timeout');
    const dlUrl = res?.download?.url || res?.result?.download?.url || res?.url;
    if (!dlUrl) return null;
    const buffer = await fetchBuffer(dlUrl, kind);
    return { buffer, title: res?.metadata?.title || res?.title || '' };
}

async function viaInnertube(kind, ytUrl) {
    const id = extractVideoId(ytUrl);
    if (!id) return null;
    const yt = await getInnertube();
    if (!yt) return null;
    const stream = await withTimeout(
        yt.download(id, {
            type: kind === 'audio' ? 'audio' : 'video+audio',
            quality: kind === 'audio' ? 'best' : '360p',
            format: 'mp4'
        }),
        30000,
        'innertube download timeout'
    );
    const chunks = [];
    let total = 0;
    const max = kind === 'audio' ? LIMITS.audioMaxBytes : LIMITS.videoMaxBytes;
    for await (const chunk of stream) {
        total += chunk.length;
        if (total > max) throw new Error('file too large');
        chunks.push(chunk);
    }
    return { buffer: Buffer.concat(chunks), title: '' };
}

async function viaYtdl(kind, ytUrl) {
    if (!ytdl || !ytdl.validateURL(ytUrl)) return null;
    const info = await withTimeout(
        ytdl.getInfo(ytUrl, { requestOptions: { headers: { 'User-Agent': UA } } }), 25000, 'getInfo timeout');
    let format;
    if (kind === 'audio') {
        format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
    } else {
        const formats = ytdl.filterFormats(info.formats, f => f.container === 'mp4' && f.hasVideo && f.hasAudio);
        format = formats.find(f => f.qualityLabel === '480p') || formats.find(f => f.qualityLabel === '360p') || formats[0];
    }
    if (!format) return null;
    const max = kind === 'audio' ? LIMITS.audioMaxBytes : LIMITS.videoMaxBytes;
    const buffer = await collectStream(ytdl.downloadFromInfo(info, { format }), kind === 'audio' ? 90000 : 150000, max);
    return { buffer, title: (info.videoDetails && info.videoDetails.title) || '' };
}

async function download(kind, ytUrl) {
    if (!axios) return { ok: false, errors: ['axios missing'] };
    const methods = [
        ['yt-dlp', () => viaYtDlp(kind, ytUrl)],
        ['vreden-scraper', () => viaVredenScraper(kind, ytUrl)],
        ['youtubei.js', () => viaInnertube(kind, ytUrl)],
        ['ytdl-core', () => viaYtdl(kind, ytUrl)],
    ];
    for (const p of PROVIDERS) {
        if (!p[kind]) continue;
        methods.push([p.name, async () => {
            const r = await axios.get(p[kind] + encodeURIComponent(ytUrl), {
                timeout: 25000,
                headers: { 'User-Agent': UA, Accept: 'application/json,*/*' }
            });
            const parsed = parseApiResponse(r.data, ytUrl);
            if (!parsed || !parsed.dl) return null;
            return { buffer: await fetchBuffer(parsed.dl, kind), title: parsed.title };
        }]);
    }
    const errors = [];
    for (const [name, fn] of methods) {
        try {
            const out = await fn();
            if (out && isMedia(out.buffer, kind)) {
                return { ok: true, buffer: out.buffer, title: out.title || '', provider: name };
            }
        } catch (e) {
            errors.push(name + ': ' + errMsg(e));
        }
    }
    return { ok: false, errors };
}

module.exports = { LIMITS, extractVideoId, normalizeUrl, thumbnailFor, search, download };
