import { alumniApiUrl, alumniCloudEnabled } from '../../config/alumni-cloud';
import * as localPosts from './posts';
import * as localContacts from './contacts';
import * as localProfile from './profile';

export const usingCloud = alumniCloudEnabled && Boolean(alumniApiUrl);

async function call(action, payload = {}) {
  let code;
  try {
    ({ code } = await wx.login());
  } catch {
    throw new Error('微信登录失败，请稍后重试');
  }
  if (!code) throw new Error('微信登录失败，请稍后重试');

  let response;
  try {
    response = await new Promise((resolve, reject) => wx.request({
      url: alumniApiUrl,
      method: 'POST',
      header: { 'content-type': 'application/json', accept: 'application/json' },
      data: { code, action, payload },
      timeout: 12000,
      success: resolve,
      fail: reject,
    }));
  } catch (error) {
    if (error.errMsg?.includes('url not in domain list')) {
      throw new Error('云端域名校验未通过，请刷新小程序项目配置');
    }
    throw new Error('无法连接云端，请稍后重试');
  }
  const { statusCode, data } = response;
  if (statusCode !== 200 || data?.ok !== true) {
    throw new Error(data?.ok === false && data.message ? data.message : '云端暂时无法处理请求');
  }
  return data.data;
}

export function loadFeed() {
  return usingCloud ? call('feed') : localPosts.listPosts();
}

export function loadPost(id) {
  if (usingCloud) return call('detail', { id });
  return {
    post: localPosts.getPost(id) || null,
    request: localContacts.getContactRequest(id),
    saved: localPosts.listFavorites().some((post) => post.id === id),
  };
}

export function publish(kind, values, submissionId) {
  return usingCloud ? call('publish', { ...values, kind, submissionId }) : localPosts.publishPost(kind, values);
}

export function saveFavorite(id, saved) {
  return usingCloud ? call('favorite', { id, saved }) : localPosts.toggleFavorite(id);
}

export function requestContact(id, message) {
  return usingCloud ? call('contact', { id, message }) : localContacts.submitContactRequest(id, message);
}

export function respondToContact(id, status) {
  return usingCloud ? call('respond', { id, status }) : localContacts.respondToIncoming(status);
}

export function loadProfile() {
  if (usingCloud) return call('profile');
  return {
    author: localProfile.demoAuthor,
    verification: localProfile.getVerification(),
    publications: localPosts.listPublications(),
    favorites: localPosts.listFavorites(),
    requestCount: localContacts.listContactRequests().length,
  };
}

export function loadVerification() {
  return usingCloud ? call('verification') : localProfile.getVerification();
}

export function verify(values) {
  return usingCloud ? call('verify', values) : localProfile.submitVerification(values);
}

export function loadMessages() {
  if (usingCloud) return call('messages');
  const notices = localPosts.listPublications().map((post) => ({
    id: post.id, title: '发布模拟审核通过', description: post.title, createdAt: post.createdAt,
  }));
  const certification = localProfile.getVerification();
  if (certification) {
    notices.push({
      id: 'verification', title: '认证申请已提交', description: '当前为模拟待审核状态。', createdAt: certification.createdAt,
    });
  }
  return {
    incoming: [{ ...localContacts.getIncomingRequest(), id: 'demo-incoming' }],
    outgoing: localContacts.listContactRequests(),
    notices: notices.sort((a, b) => b.createdAt - a.createdAt),
  };
}
