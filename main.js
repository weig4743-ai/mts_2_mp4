/**
 * DV 相机 MTS 转 MP4（极速封装 + 去隔行重编码）
 * 浏览器端 iPhone 专用，转码完成后直接下载 MP4 文件
 */

const { createFFmpeg, fetchFile } = FFmpeg;

// 初始化 FFmpeg
const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const uploader = document.getElementById('uploader');
const status = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progBox = document.getElementById('prog-box');

// 辅助：读取大文件为 ArrayBuffer
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

    // 内存预警
    if (file.size > 800 * 1024 * 1024) {
        status.innerHTML = "⚠️ 文件较大，iPhone 内存可能不足，请保持屏幕常亮并勿切换后台。";
    }

    try {
        // 1. 加载 FFmpeg 引擎
        if (!ffmpeg.isLoaded()) {
            status.innerText = "⏳ 正在唤醒转码引擎...";
            await ffmpeg.load();
        }

        // 2. 清理旧文件
        try {
            ffmpeg.FS('unlink', 'input.mts');
            ffmpeg.FS('unlink', 'output.mp4');
        } catch (e) {}

        // 3. 写入文件到 FFmpeg FS
        status.innerText = "📂 正在载入 DV 视频原始数据...";
        progBox.style.display = 'block';
        const arrayBuffer = await readFileAsArrayBuffer(file);
        ffmpeg.FS('writeFile', 'input.mts', new Uint8Array(arrayBuffer));

        // 4. 设置进度条
        ffmpeg.setProgress(({ ratio }) => {
            const p = Math.floor(ratio * 95);
            progressBar.style.width = `${p}%`;
        });

        // 5. 极速封装尝试
        status.innerText = "🚀 正在进行极速封装 (流拷贝)...";
        let success = true;
        try {
            await ffmpeg.run(
                '-i', 'input.mts',
                '-c:v', 'copy',             // 不重编码
                '-c:a', 'aac',              // 音频转 AAC
                '-map_metadata', '0',
                '-movflags', 'faststart',   // 快速启动
                'output.mp4'
            );
        } catch (err) {
            console.log("极速模式失败，尝试标准兼容模式...");
            success = false;
        }

        // 6. 深度转码（去隔行 + H.264）
        if (!success) {
            status.innerText = "⚠️ 极速模式不兼容，正在深度转码并修复隔行...";
            await ffmpeg.run(
                '-i', 'input.mts',
                '-vf', 'yadif',            // 去隔行
                '-c:v', 'libx264',         // H.264
                '-preset', 'ultrafast',    // 尽可能快
                '-tune', 'fastdecode',     // 优化 iPhone 播放
                '-crf', '26',
                '-pix_fmt', 'yuv420p',     // iOS 兼容
                '-c:a', 'aac',
                '-movflags', 'faststart',
                'output.mp4'
            );
        }

        // 7. 导出并下载
        status.innerText = "🎉 转码完成，正在准备下载...";
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        // 创建 a 标签触发下载
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.replace(/\.[^/.]+$/, '') + '.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        progressBar.style.width = '100%';
        status.innerHTML = `✅ 转换成功！MP4 文件已下载到本地。`;

        // 8. 清理内存
        ffmpeg.FS('unlink', 'input.mts');
        // output.mp4 暂不清理，直到用户刷新或下一次转换

    } catch (err) {
        console.error(err);
        status.innerHTML = "❌ 转换失败：内存不足或格式不支持。<br>建议刷新页面或尝试更小的片段。";
    }
});
