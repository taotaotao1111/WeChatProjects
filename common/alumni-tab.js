export function selectAlumniTab(page) {
  if (typeof page.getTabBar !== 'function') return;
  const tabBar = page.getTabBar();
  if (tabBar) tabBar.setData({ selectedRoute: page.route });
}
