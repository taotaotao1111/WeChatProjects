import { getPost, listPosts } from './posts';

export const MAX_MESSAGE_LENGTH = 120;

const storageKeyFor = (postId) => `wulihulian:demo:contact:${postId}`;

export function getContactRequest(postId) {
  if (!getPost(postId)) return null;
  return wx.getStorageSync(storageKeyFor(postId)) || null;
}

export function listContactRequests() {
  const requests = [];
  for (const post of listPosts()) {
    const request = getContactRequest(post.id);
    if (request) requests.push({ ...request, post });
  }
  return requests.sort((a, b) => b.createdAt - a.createdAt);
}

export function submitContactRequest(postId, message) {
  const post = getPost(postId);
  if (!post || post.expired || post.own) throw new Error('这条信息暂无法申请联系');

  const trimmedMessage = message.trim();
  if (!trimmedMessage || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    throw new Error('请填写 1–120 字的联系说明');
  }

  if (getContactRequest(postId)) {
    throw new Error('你已经提交过联系申请');
  }

  const request = { postId, message: trimmedMessage, status: 'pending', createdAt: Date.now() };
  wx.setStorageSync(storageKeyFor(postId), request);
  return request;
}

const incomingKey = 'wulihulian:demo:incoming';

export function getIncomingRequest() {
  const status = wx.getStorageSync(incomingKey) || 'pending';
  return {
    name: '李校友',
    initial: '李',
    subject: '申请和你交流职业发展',
    message: '你好，我是做后端开发的校友，最近在准备转岗，想请教一下行业方向。',
    status,
  };
}

export function respondToIncoming(status) {
  if (!['accepted', 'declined'].includes(status) || getIncomingRequest().status !== 'pending') return;
  wx.setStorageSync(incomingKey, status);
}
