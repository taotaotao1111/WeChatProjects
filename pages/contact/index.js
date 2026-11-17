import { MAX_MESSAGE_LENGTH } from '../../services/alumni/contacts';
import { loadPost, requestContact, usingCloud } from '../../services/alumni/data';

Page({
  data: {
    post: null,
    message: '',
    usingCloud,
    maxLength: MAX_MESSAGE_LENGTH,
    messageLength: 0,
    canSubmit: false,
    submitted: false,
    submitting: false,
    loading: true,
    error: '',
  },

  async onLoad({ id }) {
    try {
      const { post, request } = id ? await loadPost(id) : {};
      if (post && !post.own && !post.expired) this.setData({ post, submitted: Boolean(request) });
    } catch (error) {
      this.setData({ error: '读取失败，请返回后重试。' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onMessageInput(event) {
    const message = event.detail.value;
    this.setData({
      message,
      messageLength: message.length,
      canSubmit: !!message.trim() && message.length <= MAX_MESSAGE_LENGTH,
      error: '',
    });
  },

  async submit() {
    const { post, message, submitted, submitting, canSubmit } = this.data;
    if (!post || submitted || submitting || !canSubmit) return;

    this.setData({ submitting: true, error: '' });
    try {
      await requestContact(post.id, message);
      this.setData({ submitted: true });
      wx.showToast({ title: '申请已提交', icon: 'success' });
      this.returnToDetail();
    } catch (error) {
      this.setData({ error: error.message || '保存申请失败，请重试。' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  returnToDetail() {
    const { post } = this.data;
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
    } else if (post) {
      wx.redirectTo({ url: '/pages/detail/index?id=' + post.id });
    }
  },
});
