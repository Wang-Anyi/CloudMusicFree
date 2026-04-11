<template>
  <div class="modal" v-show="visible" @click.self="close">
    <div class="modal-content" style="max-width: 500px; max-height: 80vh;">
      <div class="modal-header">
        <span>💬 精彩评论</span>
        <button class="modal-close" @click="close">&times;</button>
      </div>
      <div class="modal-body" style="overflow-y: auto;">
        <div v-if="comments.length" class="comments-list">
          <div v-for="comment in comments" :key="comment.commentId" class="comment-item">
            <img :src="comment.user.avatarUrl" class="comment-avatar" alt="">
            <div class="comment-content">
              <div class="comment-user">{{ comment.user.nickname }}</div>
              <div class="comment-text">{{ comment.content }}</div>
            </div>
          </div>
        </div>
        <div v-else class="empty-tip">暂无评论</div>
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
  name: 'CommentsModal',
  setup() {
    const visible = ref(false);
    const comments = ref([]);

    const open = async (songId) => {
      if (!songId) return;
      try {
        // 这里需要替换为实际的 API 请求函数
        // 示例：使用全局的 requestWithFallback
        const res = await window.requestWithFallback?.(`/comment/music?id=${songId}&limit=20`, { timeout: 8000 });
        if (res?.data?.comments) {
          comments.value = res.data.comments;
        } else {
          comments.value = [];
        }
        visible.value = true;
      } catch (err) {
        console.error('获取评论失败', err);
        comments.value = [];
        visible.value = true;
      }
    };

    const close = () => {
      visible.value = false;
      comments.value = [];
    };

    return {
      visible,
      comments,
      open,
      close
    };
  }
};
</script>

<style scoped>
/* 样式已在全局 style.css 中定义，此处可留空或复用 */
.comments-list {
  max-height: 400px;
  overflow-y: auto;
}
.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}
.comment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  object-fit: cover;
}
.comment-content {
  flex: 1;
}
.comment-user {
  font-weight: 600;
  font-size: 0.85rem;
}
.comment-text {
  font-size: 0.8rem;
  margin-top: 4px;
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
  max-width: 380px;
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
.modal-btn {
  padding: 10px 24px;
  border-radius: 60px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: 0.2s;
}
.modal-btn.confirm {
  background: #d44c2f;
  color: white;
}
@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
