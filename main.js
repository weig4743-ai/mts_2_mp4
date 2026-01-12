/**
 * 浏览器端 DV MTS → H.264 MP4 转码
 * 保持原分辨率 + 去隔行 + AAC 音频 + yuv420p
 * 转码完成后直接下载
 */

const { createFFmpeg } = FFmpeg;

const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const uploader = document.getElementById('uploader');
const status = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progBox = document.getElementById('prog-box');

const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

uploader.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 800 * 1024 * 1024) {
        status.innerHTML = "⚠️ 文件较大，浏览器可能内存不足，请保持屏幕常亮并勿切换后台。";
    }

    try {
        if (!ffmpeg.isLoaded()) {
            status.innerText = "⏳ 正在加载转码引擎...";
            await ffmpeg.load();
        }

        // 清理旧文件
        try { ffmpeg.FS('unlink', 'input.mts'); } catch {}
        try { ffmpeg.FS('unlink', 'output.mp4'); } catch {}

        status.innerText = "📂 正在载入视频文件...";
        progBox.style.display = 'block';
        const arrayBuffer = await readFileAsArrayBuffer(file);
        ffmpeg.FS('writeFile', 'input.mts', new Uint8Array(arrayBuffer));

        ffmpeg.setProgress(({ ratio }) => {
            progressBar.style.width = Math.floor(ratio * 95) + '%';
        });

        status.innerText = "⚡ 正在转码为 H.264 MP4...";
        await ffmpeg.run(
            '-i', 'input.mts',
            '-vf', 'yadif',               // 去隔行
            '-c:v', 'libx264',            // H.264
            '-preset', 'ultrafast',       // 尽可能快
            '-tune', 'fastdecode',        // 优化播放启动速度
            '-crf', '18',                 // 高画质
            '-pix_fmt', 'yuv420p',        // iPhone / 剪映兼容
            '-c:a', 'aac',                // 音频
            '-ar', '48000',               // 采样率
            '-ac', '2',                   // 双声道
            '-movflags', 'faststart',     // 播放器快速启动
            'output.mp4'
        );

        // 导出并下载
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.replace(/\.[^/.]+$/, '') + '.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        progressBar.style.width = '100%';
        status.innerHTML = "✅ 转码完成！MP4 文件已下载到本地。";

        ffmpeg.FS('unlink', 'input.mts');

    } catch (err) {
        console.error(err);
        status.innerHTML = "❌ 转换失败：浏览器内存不足或文件格式不支持。建议刷新或尝试较小文件。";
    }
});
