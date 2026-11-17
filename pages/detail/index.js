import { loadPost, saveFavorite, usingCloud } from '../../services/alumni/data';

Page({
  data: {
    post: null,
    contactRequest: null,
    usingCloud,
    loading: true,
    loadError: false,
    saved: false,
    saving: false,
  },

  onLoad({ id }) {
    this.postId = id;
  },

  onShow() {
    this.reloadPost();
  },

  async reloadPost() {
    this.setData({ loading: true, loadError: false });
    try {
      const { post, request, saved } = this.postId ? await loadPost(this.postId) : {};
      this.setData({ post: post || null, contactRequest: request || null, saved: Boolean(saved) });
    } catch (error) {
      this.setData({ loadError: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  openHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  async savePost() {
    const { post, saved, saving, loading } = this.data;
    if (!post || saving || loading) return;
    this.setData({ saving: true });
    try {
      this.setData({ saved: await saveFavorite(post.id, !saved) });
    } catch (error) {
      wx.showToast({ title: '收藏失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  openContact() {
    const { post, contactRequest, loading, loadError } = this.data;
    if (!post || post.own || post.expired || contactRequest || loading || loadError) return;
    wx.navigateTo({ url: '/pages/contact/index?id=' + post.id });
  },
});
