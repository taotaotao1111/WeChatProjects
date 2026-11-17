const tabs = [
  { route: 'pages/index/index', label: '首页', icon: 'home' },
  { route: 'pages/publish/index', label: '发布', icon: 'publish' },
  { route: 'pages/messages/index', label: '消息', icon: 'messages' },
  { route: 'pages/profile/index', label: '我的', icon: 'profile' },
];

Component({
  data: { tabs, selectedRoute: tabs[0].route, pendingContactCount: 0 },

  lifetimes: {
    attached() {
      const pages = getCurrentPages();
      const page = pages[pages.length - 1];
      if (page) this.setData({ selectedRoute: page.route });
    },
  },

  methods: {
    switchTab(event) {
      const route = event.currentTarget.dataset.route;
      if (this.data.selectedRoute !== route) wx.switchTab({ url: '/' + route });
    },
  },
});
