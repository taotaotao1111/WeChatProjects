import { selectAlumniTab } from '../../common/alumni-tab';

import { loadProfile, usingCloud } from '../../services/alumni/data';
import { demoAuthor } from '../../services/alumni/profile';

Page({
  data: {
    author: usingCloud ? null : demoAuthor,
    usingCloud,
    verification: null,
    publications: [],
    favorites: [],
    requestCount: 0,
    loadFailed: false,
  },

  async onShow() {
    selectAlumniTab(this);
    try {
      this.setData({ ...await loadProfile(), loadFailed: false });
    } catch (error) {
      this.setData({ loadFailed: true });
    }
  },

  openRequests() {
    const app = getApp();
    app.globalData.messagesTab = 'outgoing';
    wx.switchTab({
      url: '/pages/messages/index',
      fail: () => { app.globalData.messagesTab = ''; },
    });
  },
});
