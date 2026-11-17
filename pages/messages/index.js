import { selectAlumniTab } from '../../common/alumni-tab';
import { loadMessages, respondToContact, usingCloud } from '../../services/alumni/data';

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
    responding: false,
    loading: true,
    loadFailed: false,
  },

  onShow() {
    selectAlumniTab(this);
    const app = getApp();
    if (app.globalData.messagesTab) {
      this.setData({ active: app.globalData.messagesTab });
      app.globalData.messagesTab = '';
    }
    this.refresh();
  },

  async refresh() {
    this.setData({ loading: true });
    try {
      this.setData({ ...await loadMessages(), loadFailed: false });
    } catch (error) {
      this.setData({ loadFailed: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectTab(event) { this.setData({ active: event.currentTarget.dataset.key }); },

  async respond(event) {
    if (this.data.responding) return;
    const { id, status } = event.currentTarget.dataset;
    this.setData({ responding: true });
    try {
      await respondToContact(id, status);
      await this.refresh();
    } catch (error) {
      wx.showToast({ title: error.message || '处理失败，请重试', icon: 'none' });
    } finally {
      this.setData({ responding: false });
    }
  },
});
