<template>
  <div class="modal" v-show="visible" @click.self="close">
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <span>🎬 MV播放</span>
        <button class="modal-close" @click="close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="mv-container">
          <iframe 
            :src="mvUrl" 
            width="100%" 
            height="400" 
            frameborder="0" 
            allowfullscreen
            @load="iframeLoaded"
          ></iframe>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn confirm" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';

export default {
  name: 'MVPlayerModal',
  setup() {
    const visible = ref(false);
    const mvUrl = ref('');
    let currentSongId = null;

    const open = async (songId) => {
      if (!songId) return;
      currentSongId = songId;
      try {
        // 使用全局 requestWithFallback 获取 MV 地址
        const res = await window.requestWithFallback?.(`/mv/url?id=${songId}`, { timeout: 8000 });
        let url = res?.data?.data?.url;
        if (url) {
          // 确保使用 HTTPS
          if (url.startsWith('http://')) url = url.replace('http://', 'https://');
          mvUrl.value = url;
          visible.value = true;
        } else {
          console.warn('该歌曲暂无MV');
          // 可选：显示提示
          alert('该歌曲暂无MV');
        }
      } catch (err) {
        console.error('获取MV失败', err);
        alert('获取MV失败，请稍后重试');
      }
    };

    const close = () => {
      visible.value = false;
      // 清空 iframe src 以停止播放
      mvUrl.value = '';
      currentSongId = null;
    };

    const iframeLoaded = () => {
      // 可选：MV 加载完成后的回调
      console.log('MV iframe loaded');
    };

    return {
      visible,
      mvUrl,
      open,
      close,
      iframeLoaded
    };
  }
};
</script>

<style scoped>
/* 样式已在全局 style.css 中定义，这里只需补充容器样式 */
.mv-container iframe {
  width: 100%;
  min-height: 300px;
  border-radius: 16px;
}
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff9f2;
  border-radius: 32px;
  max-width: 800px;
  width: 90%;
  box-shadow: 0 20px 35px rgba(0,0,0,0.3);
  overflow: hidden;
  animation: modalFadeIn 0.2s ease;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  background: #f5e6d8;
  font-weight: bold;
  font-size: 1.2rem;
  color: #b64926;
}
.modal-close {
  background: none;
  border: none;
  font-size: 1.8rem;
  cursor: pointer;
  color: #9b6a4a;
  line-height: 1;
}
.modal-close:hover {
  color: #d44c2f;
}
.modal-body {
  padding: 20px;
}
.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px 24px;
  justify-content: center;
}
.modal-btn.confirm {
  background: #d44c2f;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 60px;
  font-weight: 600;
  cursor: pointer;
}
@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
