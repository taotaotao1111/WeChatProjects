import { publish, usingCloud } from '../../services/alumni/data';
import { categories, districts, industries, validityDays } from '../../services/alumni/posts';

Page({
  data: {
    kind: '',
    usingCloud,
    categoryIndex: 0,
    industryIndex: 0,
    districtIndex: 0,
    validityIndex: 2,
    categories,
    industries,
    districts,
    validityOptions: validityDays.map((days) => days + ' 天'),
    descriptionLength: 0,
    submitting: false,
    error: '',
  },

  onLoad({ kind }) {
    this.submissionId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    if (kind === 'opportunity' || kind === 'request') {
      this.setData({ kind });
      wx.setNavigationBarTitle({ title: kind === 'opportunity' ? '发布资源' : '发布需求' });
    }
  },

  selectField(event) {
    this.setData({ [event.currentTarget.dataset.field]: Number(event.detail.value), error: '' });
  },

  onDescriptionInput(event) {
    this.setData({ descriptionLength: event.detail.value.length });
  },

  async submit(event) {
    const { kind, submitting, categoryIndex, industryIndex, districtIndex, validityIndex } = this.data;
    if (!kind || submitting) return;

    this.setData({ submitting: true, error: '' });
    let post;
    try {
      post = await publish(kind, {
        ...event.detail.value,
        category: categories[categoryIndex],
        industry: industries[industryIndex],
        district: districts[districtIndex],
        days: validityDays[validityIndex],
      }, this.submissionId);
    } catch (error) {
      const message = error.message || '发布失败，请重试';
      this.setData({ submitting: false, error: message });
      wx.showToast({ title: message, icon: 'none' });
      return;
    }

    wx.redirectTo({
      url: '/pages/detail/index?id=' + post.id,
      fail: () => wx.switchTab({ url: '/pages/index/index' }),
    });
  },
});
