import { demoAuthor } from './profile';

export const postFilters = [
  { key: 'all', label: '全部' },
  { key: 'opportunity', label: '机会' },
  { key: 'request', label: '求助' },
];

export const categories = ['求职招聘', '创业合作', '职业发展', '生活互助', '兴趣社交'];
export const industries = ['不限行业', '互联网', '金融', '制造业', '汽车', '医疗健康', '教育', '其他'];
export const districts = ['全上海', '浦东', '徐汇', '黄浦', '静安', '长宁', '普陀', '虹口', '杨浦', '闵行', '宝山', '嘉定', '松江', '青浦', '奉贤', '金山', '崇明'];
export const validityDays = [7, 15, 30];
const publicationsKey = 'wulihulian:demo:publications';
const favoritesKey = 'wulihulian:demo:favorites';

const posts = [
  {
    id: 'java-referral',
    category: '求职招聘',
    industry: '互联网',
    kind: 'opportunity',
    label: '校友内推',
    title: '上海互联网团队｜Java 后端开发内推',
    summary: '交易平台团队开放社招，可帮忙看看岗位匹配度，并协助提交内推。',
    district: '徐汇',
    context: '社招 · 2–5 年经验',
    validity: '持续接收',
    facts: [
      { label: '招聘岗位', value: 'Java 后端开发' },
      { label: '经验要求', value: '2–5 年' },
      { label: '参考薪资', value: '20–35K / 月' },
      { label: '工作地点', value: '上海 · 徐汇' },
    ],
    description: '团队负责交易平台和基础服务，主要使用 Java、Spring Boot 和 MySQL。有实际业务开发经验，愿意一起把系统做得更稳定的校友，欢迎交流。\n\n申请时可以简单说一下最近做过的项目，以及希望了解的方向。',
    author: { name: '王校友', initial: '王', profile: '2016 届 · 计算机科学与技术', role: '互联网 · 后端工程师' },
  },
  {
    id: 'product-resume',
    category: '职业发展',
    industry: '互联网',
    kind: 'request',
    label: '求职求助',
    title: '想请校友帮忙看看产品经理简历',
    summary: '有两年业务运营经验，准备转做 B 端产品，想听听简历和岗位选择的建议。',
    district: '浦东',
    context: '转岗 · B 端产品',
    validity: '接受联系中',
    facts: [
      { label: '目标岗位', value: 'B 端产品经理' },
      { label: '工作经历', value: '2 年业务运营' },
      { label: '希望获得', value: '简历与转岗建议' },
      { label: '交流方式', value: '线上交流' },
    ],
    description: '过去两年主要负责业务流程梳理和数据看板，有跟研发一起落地内部工具的经历。希望有 B 端产品经验的校友帮我判断，简历应该突出哪些项目。\n\n可以约半小时线上交流，工作日晚上或周末都方便。',
    author: { name: '陈校友', initial: '陈', profile: '2023 届 · 工商管理', role: '企业服务 · 业务运营' },
  },
  {
    id: 'design-internship',
    category: '求职招聘',
    industry: '汽车',
    kind: 'opportunity',
    label: '实习机会',
    title: '设计团队招交互设计实习生',
    summary: '参与车载应用的交互设计和用户研究，欢迎有作品集的同学联系。',
    district: '嘉定',
    context: '实习 · 每周 3 天起',
    validity: '持续接收',
    facts: [
      { label: '招聘岗位', value: '交互设计实习生' },
      { label: '实习安排', value: '每周 3 天起' },
      { label: '基本要求', value: '有设计作品集' },
      { label: '实习地点', value: '上海 · 嘉定' },
    ],
    description: '实习期间会和设计师一起参与车载应用的流程设计、原型制作和可用性测试。对出行场景或人机交互感兴趣的校友，可以在申请时介绍一个代表作品。',
    author: { name: '刘校友', initial: '刘', profile: '2019 届 · 工业设计', role: '智能汽车 · 交互设计师' },
  },
  {
    id: 'manufacturing-career',
    category: '职业发展',
    industry: '制造业',
    kind: 'request',
    label: '职业交流',
    title: '想了解上海智能制造的岗位方向',
    summary: '材料专业，做过两年质量工程，想向转到工艺或项目管理的校友请教。',
    district: '松江',
    context: '行业交流 · 智能制造',
    validity: '接受联系中',
    facts: [
      { label: '目前岗位', value: '质量工程师' },
      { label: '工作经历', value: '2 年制造业' },
      { label: '关注方向', value: '工艺 / 项目管理' },
      { label: '交流方式', value: '线上交流' },
    ],
    description: '目前做来料质量和供应商问题跟进，想了解工艺工程师和项目管理两类岗位的日常工作。希望听听有转岗经历的校友怎么选方向，以及面试前可以做哪些准备。',
    author: { name: '周校友', initial: '周', profile: '2022 届 · 材料科学与工程', role: '制造业 · 质量工程师' },
  },
];

export function listPublications() {
  return (wx.getStorageSync(publicationsKey) || []).map((post) => ({
    ...post,
    expired: post.expiresAt <= Date.now(),
  }));
}

export function listPosts(filters) {
  return filterPosts([...listPublications().filter((post) => !post.expired), ...posts], filters);
}

export function filterPosts(entries, { kind = 'all', query = '', category = '', district = '' } = {}) {
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((post) => {
    if (kind !== 'all' && post.kind !== kind) return false;
    if (category && post.category !== category) return false;
    if (district && post.district !== district) return false;
    const searchable = [
      post.title, post.label, post.summary, post.district, post.context, post.category, post.industry, post.description,
    ].join(' ').toLowerCase();
    return keywords.every((keyword) => searchable.includes(keyword));
  });
}

export function getPost(id) {
  return posts.find((post) => post.id === id) || listPublications().find((post) => post.id === id);
}

export function publishPost(kind, values) {
  const { category, industry, district, days } = values;
  const title = (values.title || '').trim();
  const description = (values.description || '').trim();
  if (!['opportunity', 'request'].includes(kind) || !categories.includes(category)) {
    throw new Error('请选择发布类型和分类');
  }
  if (!title || title.length > 40) throw new Error('请填写 1–40 字的信息标题');
  if (!description || description.length > 600) throw new Error('请填写 1–600 字的详细介绍');
  if (!industries.includes(industry) || !districts.includes(district) || !validityDays.includes(days)) {
    throw new Error('请选择行业、地区和有效期');
  }

  const existing = listPublications();
  const createdAt = Date.now();
  let sequence = existing.length + 1;
  let id = 'local-' + createdAt + '-' + sequence;
  while (existing.some((post) => post.id === id)) {
    sequence += 1;
    id = 'local-' + createdAt + '-' + sequence;
  }
  const post = {
    id, kind, category, industry, district, title, description, createdAt,
    summary: description.replace(/\s+/g, ' '),
    label: kind === 'opportunity' ? '校友资源' : '校友求助',
    context: category + ' · ' + industry,
    validity: days + ' 天有效',
    expiresAt: createdAt + days * 24 * 60 * 60 * 1000,
    own: true,
    author: demoAuthor,
    facts: [
      { label: '信息分类', value: category },
      { label: '所属行业', value: industry },
      { label: '所在地区', value: district === '全上海' ? district : '上海 · ' + district },
      { label: '信息有效期', value: days + ' 天' },
    ],
  };
  wx.setStorageSync(publicationsKey, [post, ...existing]);
  return post;
}

export function listFavorites() {
  return (wx.getStorageSync(favoritesKey) || []).map(getPost).filter(Boolean);
}

export function toggleFavorite(id) {
  if (!getPost(id)) return false;
  const ids = wx.getStorageSync(favoritesKey) || [];
  const saved = !ids.includes(id);
  wx.setStorageSync(favoritesKey, saved ? [id, ...ids] : ids.filter((value) => value !== id));
  return saved;
}
