import { loadVerification, verify, usingCloud } from '../../services/alumni/data';

Page({
  data: {
    certification: null,
    usingCloud,
    loading: true,
    submitting: false,
    degreeOptions: ['请选择', '本科', '硕士', '博士'],
    degreeIndex: 0,
    error: '',
  },

  async onLoad() {
    try {
      this.setData({ certification: await loadVerification() });
    } catch (error) {
      this.setData({ error: '读取失败，请稍后重试。' });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectDegree(event) {
    this.setData({ degreeIndex: Number(event.detail.value), error: '' });
  },

  async submit(event) {
    const { certification, degreeOptions, degreeIndex, loading, submitting } = this.data;
    if ((certification && certification.status !== 'rejected') || loading || submitting) return;
    this.setData({ submitting: true });
    try {
      this.setData({
        certification: await verify({
          ...event.detail.value,
          degree: degreeIndex ? degreeOptions[degreeIndex] : '',
        }),
        error: '',
      });
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    } catch (error) {
      this.setData({ error: error.message || '提交失败，请重试。' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
