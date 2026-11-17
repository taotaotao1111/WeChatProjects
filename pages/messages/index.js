import { selectAlumniTab, setPendingContactCount } from '../../common/alumni-tab';
import { loadMessages, respondToContact, updateContactWechat, usingCloud } from '../../services/alumni/data';

const tabs = [
  { key: 'incoming', label: '收到的申请' },
  { key: 'outgoing', label: '发出的申请' },
  { key: 'notices', label: '系统通知' },
];

Page({
  data: {
    tabs,
    active: 'incoming',
    usingCloud,
    incoming: [],
    outgoing: [],
    notices: [],
    pendingCount: 0,
    responding: false,
    loading: true,
    loadFailed: false,
  },

  onShow() {
    selectAlumniTab(this, false);
    const app = getApp();
    if (app.globalData.messagesTab) {
      this.setData({ active: app.globalData.messagesTab });
      app.globalData.messagesTab = '';
    }
    this.refresh();
  },

  async refresh() {
    this.setData({ loading: true });
    const request = this.messageRefresh = Promise.resolve().then(loadMessages);
    try {
      const messages = await request;
      if (this.messageRefresh !== request) return;
      const pendingCount = messages.incoming.filter((item) => item.status === 'pending').length;
      setPendingContactCount(this, pendingCount);
      this.setData({ ...messages, pendingCount, loadFailed: false });
    } catch (error) {
      if (this.messageRefresh === request) this.setData({ loadFailed: true });
    } finally {
      if (this.messageRefresh === request) this.setData({ loading: false });
    }
  },

  async onPullDownRefresh() {
    await this.refresh();
    wx.stopPullDownRefresh();
  },

  selectTab(event) { this.setData({ active: event.currentTarget.dataset.key }); },

  copyWeChat(event) {
    const { id, direction } = event.currentTarget.dataset;
    const requests = direction === 'outgoing' ? this.data.outgoing : this.data.incoming;
    const request = requests.find((item) => item.id === id && item.status === 'accepted');
    if (request?.wechatId) wx.setClipboardData({ data: request.wechatId });
  },

  async respond(event) {
    if (this.data.responding) return;
    const { id, status } = event.currentTarget.dataset;
    this.setData({ responding: true });
    try {
      let wechatId = '';
      if (usingCloud && status === 'accepted') {
        const { confirm, content } = await wx.showModal({
          title: '同意联系',
          editable: true,
          placeholderText: '微信号选填，仅这位申请人可见',
          confirmText: '确认同意',
        });
        if (!confirm) return;
        wechatId = content || '';
      }
      await respondToContact(id, status, wechatId);
      const pendingCount = Math.max(0, this.data.pendingCount - 1);
      setPendingContactCount(this, pendingCount);
      this.setData({ pendingCount });
      await this.refresh();
    } catch (error) {
      wx.showToast({ title: error.message || '处理失败，请重试', icon: 'none' });
    } finally {
      this.setData({ responding: false });
    }
  },

  async shareWechat(event) {
    if (this.data.responding) return;
    const { id } = event.currentTarget.dataset;
    const request = this.data.outgoing.find((item) => item.id === id);
    if (!usingCloud || !request || request.status === 'declined') return;
    this.setData({ responding: true });
    try {
      const { confirm, content } = await wx.showModal({
        title: request.hasSharedWechatId ? '更新微信号' : '补填微信号',
        editable: true,
        placeholderText: request.status === 'accepted' ? '仅帖子发布者可见' : '发布者同意申请后才可见',
        confirmText: '保存',
      });
      if (!confirm) return;
      await updateContactWechat(id, content || '');
      await this.refresh();
      wx.showToast({ title: '微信号已保存', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ responding: false });
    }
  },
});
