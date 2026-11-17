import { editPost, loadPost, publish, usingCloud } from '../../services/alumni/data';
import { highlightFields } from '../../services/alumni/post-options';
import { categories, districts, industries, validityDays } from '../../services/alumni/posts';

Page({
  data: {
    kind: '',
    title: '',
    description: '',
    editing: false,
    loading: false,
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
    highlightFields: [],
    highlightValues: {},
    submitting: false,
    error: '',
  },

  async onLoad({ kind, id }) {
    this.highlightDrafts = {};
    if (id) {
      this.setData({ editing: true, loading: true });
      wx.setNavigationBarTitle({ title: '编辑发布' });
      try {
        const { post } = await loadPost(id);
        if (!post?.own || post.expired) throw new Error('这条信息暂无法编辑');
        this.postId = id;
        const categoryIndex = Math.max(0, categories.indexOf(post.category));
        const fields = highlightFields(categories[categoryIndex], post.kind);
        const highlightValues = post.highlights || Object.fromEntries(fields.map(({ key, label }) => [
          key, post.facts?.find((fact) => fact.label === label)?.value || '',
        ]));
        this.highlightDrafts[categories[categoryIndex]] = highlightValues;
        this.setData({
          kind: post.kind,
          title: post.title,
          description: post.description,
          descriptionLength: post.description.length,
          categoryIndex,
          highlightFields: fields,
          highlightValues,
          industryIndex: Math.max(0, industries.indexOf(post.industry)),
          districtIndex: Math.max(0, districts.indexOf(post.district)),
        });
      } catch (error) {
        this.setData({ error: error.message || '信息读取失败' });
      } finally {
        this.setData({ loading: false });
      }
      return;
    }
    this.submissionId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    if (kind === 'opportunity' || kind === 'request') {
      this.setData({ kind, highlightFields: highlightFields(categories[0], kind) });
      wx.setNavigationBarTitle({ title: kind === 'opportunity' ? '发布资源' : '发布需求' });
    }
  },

  selectField(event) {
    const { field } = event.currentTarget.dataset;
    const index = Number(event.detail.value);
    const changes = { [field]: index, error: '' };
    if (field === 'categoryIndex') {
      const category = categories[index];
      changes.highlightFields = highlightFields(category, this.data.kind);
      changes.highlightValues = this.highlightDrafts[category] || {};
    }
    this.setData(changes);
  },

  onHighlightInput(event) {
    const category = categories[this.data.categoryIndex];
    const { key } = event.currentTarget.dataset;
    this.highlightDrafts[category] = { ...this.highlightDrafts[category], [key]: event.detail.value };
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
      const values = {
        title: event.detail.value.title,
        description: event.detail.value.description,
        highlights: Object.fromEntries(this.data.highlightFields.map(({ key }) => [key, event.detail.value[key] || ''])),
        category: categories[categoryIndex],
        industry: industries[industryIndex],
        district: districts[districtIndex],
        days: validityDays[validityIndex],
      };
      post = this.postId ? await editPost(this.postId, values) : await publish(kind, values, this.submissionId);
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
