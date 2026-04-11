<template>
  <div class="modal" v-show="visible" @click.self="close">
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <span>🎵 相似歌曲推荐</span>
        <button class="modal-close" @click="close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="similar-list" v-if="songs.length">
          <div 
            v-for="song in songs" 
            :key="song.id" 
            class="similar-item" 
            @click="playSong(song)"
          >
            <img :src="song.picUrl" class="similar-cover" alt="">
            <div class="similar-info">
              <div class="similar-name">{{ song.name }}</div>
              <div class="similar-artist">{{ song.artist }}</div>
            </div>
          </div>
        </div>
        <div v-else class="empty-tip">暂无相似歌曲</div>
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
  name: 'SimilarSongsModal',
  setup() {
    const visible = ref(false);
    const songs = ref([]);
    let currentSongId = null;

    const open = async (songId) => {
      if (!songId) return;
      currentSongId = songId;
      try {
        // 使用全局 requestWithFallback 获取相似歌曲
        const res = await window.requestWithFallback?.(`/simi/song?id=${songId}`, { timeout: 8000 });
        if (res?.data?.songs) {
          songs.value = res.data.songs.map(s => ({
            id: s.id,
            name: s.name,
            artist: s.artists.map(a => a.name).join('/'),
            picUrl: s.album?.picUrl || ''
          }));
        } else {
          songs.value = [];
        }
        visible.value = true;
      } catch (err) {
        console.error('获取相似歌曲失败', err);
        songs.value = [];
        visible.value = true;
      }
    };

    const close = () => {
      visible.value = false;
      songs.value = [];
      currentSongId = null;
    };

    const playSong = (song) => {
      // 触发播放事件，父组件监听后调用 playSongById
      window.dispatchEvent(new CustomEvent('playSimilarSong', { detail: song }));
      close();
    };

    return {
      visible,
      songs,
      open,
      close,
      playSong
    };
  }
};
</script>

<style scoped>
/* 样式已在全局 style.css 中定义，此处仅保留组件特定样式 */
.similar-list {
  max-height: 400px;
  overflow-y: auto;
}
.similar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: 0.2s;
}
.similar-item:hover {
  background: var(--lyrics-active-bg);
}
.similar-cover {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  object-fit: cover;
}
.similar-info {
  flex: 1;
}
.similar-name {
  font-weight: 600;
}
.similar-artist {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.empty-tip {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
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
  max-width: 500px;
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
  padding: 24px 20px;
  text-align: center;
  color: #4f3524;
  line-height: 1.5;
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
  padding: 10px 24px;
  border-radius: 60px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
