/**
 * ⚡ 𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇 - Audio Converter (ffmpeg)
 * Developer: 𝛥𝑆𝛥𝐷
 */
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

function isAlreadyMp3(buf) {
    if (!buf || buf.length < 4) return false;
    // ID3 tag or MPEG Layer-3 frame sync
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    if (buf[0] === 0xFF && (buf[1] === 0xFB || buf[1] === 0xF3 || buf[1] === 0xF2)) return true;
    return false;
}

async function toAudio(buffer, ext) {
    if (isAlreadyMp3(buffer)) return buffer;
    const tmpDir = path.join(__dirname, '../temp');
    if (!fsSync.existsSync(tmpDir)) await fs.mkdir(tmpDir, { recursive: true });

    const id = crypto.randomBytes(8).toString('hex');
    const cleanExt = (ext && /^[a-z0-9]+$/i.test(ext)) ? ext : 'media';
    const inputPath = path.join(tmpDir, id + '_in.' + cleanExt);
    const outputPath = path.join(tmpDir, id + '_out.mp3');

    try {
        await fs.writeFile(inputPath, buffer);
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .noVideo()
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .toFormat('mp3')
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });
        return await fs.readFile(outputPath);
    } finally {
        try {
            if (fsSync.existsSync(inputPath)) await fs.unlink(inputPath);
            if (fsSync.existsSync(outputPath)) await fs.unlink(outputPath);
        } catch {}
    }
}

module.exports = { toAudio, isAlreadyMp3 };
