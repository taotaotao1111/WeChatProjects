import { loadFeed } from '../../services/alumni/data';
import { categories, filterPosts, postFilters } from '../../services/alumni/posts';
import { selectAlumniTab } from '../../common/alumni-tab';

const HOME_PREVIEW_SIZE = 3;
const categoryIcons = ['job', 'rocket', 'career', 'life', 'social'];

Page({
  data: {
    categories: categories.map((name, index) => ({
      name,
      icon: '/images/icons/category-' + categoryIcons[index] + '.png',
    })),
    filters: postFilters,
    selectedKind: 'all',
    category: '',
    query: '',
    hasFilters: false,
    showAll: false,
    canExpand: false,
    posts: [],
    feedLoading: true,
    feedError: '',
  },

  onShow() {
    selectAlumniTab(this);
    this.syncFeed();
  },

  async syncFeed() {
    const revision = (this.feedRevision || 0) + 1;
    this.feedRevision = revision;
    this.setData({ feedLoading: true, feedError: '' });
    try {
      const feed = await loadFeed();
      if (this.feedRevision !== revision) return;
      this.feed = feed;
      this.refresh({ feedLoading: false });
    } catch (error) {
      if (this.feedRevision !== revision) return;
      this.setData({ feedLoading: false, feedError: error.message || '暂时无法读取信息' });
    }
  },

  refresh(changes = {}) {
    const { selectedKind, category, query, showAll } = { ...this.data, ...changes };
    const hasFilters = selectedKind !== 'all' || Boolean(category || query.trim());
    const matches = filterPosts(this.feed || [], { kind: selectedKind, category, query });
    this.setData({
      ...changes,
      hasFilters,
      posts: showAll || hasFilters ? matches : matches.slice(0, HOME_PREVIEW_SIZE),
      canExpand: matches.length > HOME_PREVIEW_SIZE,
    });
  },

  onSearchInput(event) {
    this.refresh({ query: event.detail.value });
  },

  clearSearch() {
    this.refresh({ query: '' });
  },

  selectCategory(event) {
    const category = event.currentTarget.dataset.category;
    this.refresh({ category: this.data.category === category ? '' : category, showAll: false });
  },

  selectFilter(event) {
    this.refresh({ selectedKind: event.currentTarget.dataset.kind, showAll: false });
  },

  resetFilters() {
    this.refresh({ category: '', query: '', selectedKind: 'all', showAll: false });
  },

  toggleAll() {
    this.refresh({ showAll: !this.data.showAll });
  },
});
