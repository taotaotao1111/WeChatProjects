import { openOutgoingRequests, selectAlumniTab } from '../../common/alumni-tab';

import { completePost, loadProfile, renewPost, saveAccountProfile, usingCloud, withdrawPost } from '../../services/alumni/data';
import { avatarPath, encodeAvatar } from '../../services/alumni/account-avatar';
import { completionLabel, expiryText } from '../../services/alumni/post-options';
import { validityDays } from '../../services/alumni/posts';
import { demoAuthor } from '../../services/alumni/profile';

Page({
  data: {
    author: usingCloud ? null : demoAuthor,
    usingCloud,
    verification: null,
    publications: [],
    favorites: [],
    requestCount: 0,
    isAdmin: false,
    managing: false,
    loadFailed: false,
    editingAccount: false,
    savingAccount: false,
    nicknameDraft: '',
    avatarDraft: '',
    accountError: '',
  },

  async onShow() {
    selectAlumniTab(this);
    await this.reloadProfile();
  },

  async reloadProfile() {
    try {
      const profile = await loadProfile();
      const publications = profile.publications.map((post) => ({
        ...post,
        expiryText: expiryText(post.expiresAt),
      }));
      this.setData({ ...profile, author: this.displayAuthor(profile.author), publications, loadFailed: false });
    } catch (error) {
      this.setData({ loadFailed: true });
    }
  },

  displayAuthor({ avatar, ...author }) {
    return { ...author, avatarSrc: avatarPath(avatar) };
  },

  openAccount() {
    this.setData({
      editingAccount: true,
      nicknameDraft: this.data.author.personalized ? this.data.author.name : '',
      avatarDraft: '',
      accountError: '',
    });
  },

  chooseAvatar(event) {
    if (!this.data.savingAccount && event.detail.avatarUrl) {
      this.setData({ avatarDraft: event.detail.avatarUrl, accountError: '' });
    }
  },

  closeAccount() {
    if (!this.data.savingAccount) this.setData({ editingAccount: false, avatarDraft: '' });
  },

  async saveAccount(event) {
    if (this.data.savingAccount) return;
    const nickname = (event.detail.value.nickname || '').trim();
    if (!nickname) {
      this.setData({ accountError: '请填写昵称' });
      return;
    }
    this.setData({ savingAccount: true, accountError: '' });
    try {
      const avatar = this.data.avatarDraft ? await encodeAvatar(this.data.avatarDraft) : undefined;
      const author = await saveAccountProfile(nickname, avatar);
      this.setData({ author: this.displayAuthor(author), editingAccount: false, avatarDraft: '' });
      wx.showToast({ title: '资料已保存', icon: 'success' });
    } catch (error) {
      this.setData({ accountError: error.message || '资料暂时无法保存，请重试' });
    } finally {
      this.setData({ savingAccount: false });
    }
  },

  async managePublication(event) {
    if (this.data.managing) return;
    const { id } = event.currentTarget.dataset;
    const post = this.data.publications.find((item) => item.id === id);
    if (!post || post.withdrawn || post.completionLabel) return;
    const label = completionLabel(post.category, post.kind);
    this.setData({ managing: true });
    try {
      const options = post.expired ? ['续期', '标记' + label] : ['续期', '标记' + label, '下架'];
      const { tapIndex } = await wx.showActionSheet({ itemList: options });
      let result;
      if (tapIndex === 0) {
        const { tapIndex: selected } = await wx.showActionSheet({ itemList: validityDays.map((days) => '续期 ' + days + ' 天') });
        await renewPost(id, validityDays[selected], post.expiresAt);
        result = '已续期';
      } else if (tapIndex === 1) {
        const { confirm } = await wx.showModal({
          title: '标记为「' + label + '」？',
          content: '标记后会从校友广场移除，并停止接收新申请。原有联系记录仍可查看。',
          confirmText: '确认标记',
        });
        if (!confirm) return;
        await completePost(id);
        result = label;
      } else {
        const { confirm } = await wx.showModal({ title: '下架这条信息？', content: '下架后，校友广场将不再展示这条信息。', confirmText: '下架' });
        if (!confirm) return;
        await withdrawPost(id);
        result = '已下架';
      }
      await this.reloadProfile();
      wx.showToast({ title: result, icon: 'success' });
    } catch (error) {
      if (!error.errMsg?.includes('cancel')) wx.showToast({ title: error.message || '操作失败，请重试', icon: 'none' });
    } finally {
      this.setData({ managing: false });
    }
  },

  openRequests: openOutgoingRequests,
});
