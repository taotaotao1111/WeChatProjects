const recruiting = [
  { key: 'role', label: '岗位名称', hint: '例如：前端开发实习生' },
  { key: 'experience', label: '经验要求', hint: '例如：熟悉 React，有项目经验' },
  { key: 'application', label: '投递方式', hint: '例如：申请联系后提供投递链接' },
];

const jobSeeking = [
  { key: 'role', label: '目标岗位', hint: '例如：B 端产品经理' },
  { key: 'experience', label: '已有经验', hint: '例如：两年电商运营经验' },
  { key: 'support', label: '希望获得', hint: '例如：简历建议或岗位内推' },
];

const partnership = [
  { key: 'stage', label: '项目阶段', hint: '例如：已有原型，正在找首批客户' },
  { key: 'role', label: '寻找角色', hint: '例如：熟悉制造业的销售合伙人' },
  { key: 'cooperation', label: '合作方式', hint: '例如：先约聊，可从兼职合作开始' },
];

export function highlightFields(category, kind) {
  if (category === '创业合作') return partnership;
  if (category === '求职招聘') return kind === 'opportunity' ? recruiting : jobSeeking;
  return [];
}

export function completionLabel(category, kind) {
  if (category === '创业合作') return '已找到合伙人';
  if (category === '求职招聘' && kind === 'opportunity') return '已招满';
  return '已解决';
}

export function expiryText(expiresAt) {
  if (!expiresAt || expiresAt <= 0) return '';
  const date = new Date(expiresAt + 8 * 3600000);
  return `${date.getUTCFullYear()} 年 ${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日`;
}
