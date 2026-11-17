import { loadPendingContactCount } from '../services/alumni/data';

let pendingCount = 0;
let lastUpdatedAt = 0;
let pendingRefresh;
const refreshIntervalMs = 15000;

export function setPendingContactCount(page, count) {
  pendingCount = count;
  lastUpdatedAt = Date.now();
  pendingRefresh = null;
  page.getTabBar?.()?.setData({ pendingContactCount: count });
}

export async function selectAlumniTab(page, refreshCount = true) {
  if (typeof page.getTabBar !== 'function') return;
  const tabBar = page.getTabBar();
  if (!tabBar) return;
  tabBar.setData({ selectedRoute: page.route, pendingContactCount: pendingCount });
  if (!refreshCount || Date.now() - lastUpdatedAt < refreshIntervalMs) return;

  const request = pendingRefresh || (pendingRefresh = Promise.resolve().then(loadPendingContactCount));
  try {
    const count = await request;
    if (pendingRefresh === request) setPendingContactCount(page, count);
    const pages = getCurrentPages();
    if (pages[pages.length - 1] === page) tabBar.setData({ pendingContactCount: pendingCount });
  } catch {
    // Keep the last known count if the connection is temporarily unavailable.
    if (pendingRefresh === request) pendingRefresh = null;
  }
}

export function openOutgoingRequests() {
  const app = getApp();
  app.globalData.messagesTab = 'outgoing';
  wx.switchTab({
    url: '/pages/messages/index',
    fail: () => { app.globalData.messagesTab = ''; },
  });
}
