import { loadModeration, resolveReport, reviewVerification } from '../../services/alumni/data';

Page({
  data: {
    verifications: [],
    reports: [],
    loading: true,
    busy: false,
    error: '',
  },

  onShow() {
    this.reload();
  },

  async reload() {
    this.setData({ loading: true, error: '' });
    try {
      this.setData(await loadModeration());
    } catch (error) {
      this.setData({ error: error.message || '暂时无法读取审核记录', verifications: [], reports: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleDecision(event) {
    if (this.data.busy) return;
    const { id, type, status } = event.currentTarget.dataset;
    this.setData({ busy: true });
    try {
      let note = '';
      if (status === 'rejected') {
        const { confirm, content } = await wx.showModal({
          title: '填写未通过原因', editable: true, placeholderText: '说明需要补充的信息',
        });
        if (!confirm) return;
        note = content || '';
      }
      if (status === 'withdrawn') {
        const { confirm } = await wx.showModal({ title: '下架被举报的信息？', confirmText: '下架' });
        if (!confirm) return;
      }
      if (type === 'verification') await reviewVerification(id, status, note);
      else await resolveReport(id, status);
      await this.reload();
      wx.showToast({ title: '已处理', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '处理失败', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },
});
