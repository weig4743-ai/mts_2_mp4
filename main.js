<input type="file" id="uploader" accept=".mts,.m2ts" />
<div id="status">等待选择文件…</div>
<div id="prog-box" style="display:none; width:100%; background:#eee; height:20px; margin-top:5px;">
  <div id="progress-bar" style="width:0%; height:100%; background:#007aff;"></div>
</div>

<script type="module">
import { createFFmpeg, fetchFile } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.mjs';

const ffmpeg = createFFmpeg({ log: true });

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
        status.innerHTML = "⚠️ 文件较大，iPhone 内存可能不足，请保持屏幕常亮并勿切换后台。";
    }

    try {
        if (!ffmpeg.isLoaded()) {
            status.innerText = "⏳ 正在加载转码引擎...";
            await ffmpeg.load();
        }

        // 清理旧文件
        try { ffmpeg.FS('unlink', 'input.mts'); } catch(e) {}
        try { ffmpeg.FS('unlink', 'output.mp4'); } catch(e) {}

        status.innerText = "📂 载入 DV 视频...";
        progBox.style.display = 'block';
        progressBar.style.width = '0%';
        const arrayBuffer = await readFileAsArrayBuffer(file);
        ffmpeg.FS('writeFile', 'input.mts', new Uint8Array(arrayBuffer));

        ffmpeg.setProgress(({ ratio }) => {
            const p = Math.floor(ratio * 95);
            progressBar.style.width = `${p}%`;
        });

        status.innerText = "🚀 尝试极速封装 (流拷贝)...";
        let success = true;

        try {
            await ffmpeg.run(
                '-i', 'input.mts',
                '-c:v', 'copy',          // 极速拷贝，保持 DV 原画质
                '-c:a', 'aac',           // 音频转 AAC
                '-map_metadata', '0',
                '-movflags', 'faststart',
                'output.mp4'
            );
        } catch (err) {
            console.log("⚠️ 极速封装失败，切换 H.264 转码模式...");
            success = false;
        }

        if (!success) {
            status.innerText = "⚠️ 深度转码中，去隔行并修复横纹...";
            await ffmpeg.run(
                '-i', 'input.mts',
                '-vf', 'yadif',          // 去隔行
                '-c:v', 'libx264',       // H.264 编码
                '-preset', 'ultrafast',  
                '-tune', 'fastdecode',   // 加速 iPhone 播放
                '-crf', '26',            // 画质/体积平衡
                '-pix_fmt', 'yuv420p',   // iOS 兼容
                '-c:a', 'aac',
                '-movflags', 'faststart',
                'output.mp4'
            );
        }

        status.innerText = "🎉 转码完成，正在生成下载链接...";
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        // 自动触发下载
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.replace(/\.\w+$/, '.mp4');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        status.innerHTML = "✅ 转码完成，文件已开始下载！";
        progressBar.style.width = '100%';
        progBox.style.display = 'none';

        // 清理输入文件
        try { ffmpeg.FS('unlink', 'input.mts'); } catch(e) {}

    } catch (err) {
        console.error(err);
        status.innerHTML = "❌ 转换失败：内存不足或格式不支持。请刷新页面或尝试更小的视频片段。";
        progBox.style.display = 'none';
    }
});
</script>
