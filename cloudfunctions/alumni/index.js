const cloud = require('wx-server-sdk');
const { createHash } = require('node:crypto');
const { handleHttp } = require('./wechat-http');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const records = db.collection('alumni_records');
const batchSize = 100;
const categories = ['求职招聘', '创业合作', '职业发展', '生活互助', '兴趣社交'];
const industries = ['不限行业', '互联网', '金融', '制造业', '汽车', '医疗健康', '教育', '其他'];
const districts = ['全上海', '浦东', '徐汇', '黄浦', '静安', '长宁', '普陀', '虹口', '杨浦', '闵行', '宝山', '嘉定', '松江', '青浦', '奉贤', '金山', '崇明'];
const anonymousAuthor = { name: '校友用户', initial: '校', profile: '武理沪联', role: '' };

class InputError extends Error {}

function key(...parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
}

function readId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) throw new InputError('信息编号无效');
  return value;
}

function requiredText(value, max, field) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new InputError(field + '应为 1–' + max + ' 字');
  }
  return value.trim();
}

async function find(id, recordType) {
  const result = await records.where({ _id: id, recordType }).limit(1).get();
  return result.data[0] || null;
}

async function scan(filter) {
  const results = [];
  let cursor = '';
  while (true) {
    const criteria = cursor ? { ...filter, _id: db.command.gt(cursor) } : filter;
    const { data } = await records.where(criteria).orderBy('_id', 'asc').limit(batchSize).get();
    results.push(...data);
    if (data.length < batchSize) return results;
    cursor = data[data.length - 1]._id;
  }
}

async function insertOnce(record) {
  try {
    await records.add({ data: record });
    return record;
  } catch (error) {
    const existing = await find(record._id, record.recordType);
    if (existing) return existing;
    throw error;
  }
}

function newestFirst(a, b) {
  return b.createdAt - a.createdAt;
}

function postView(post, user) {
  const { _id, owner, kind, category, industry, district, title, summary, label, context,
    description, author, facts, validity, createdAt, expiresAt } = post;
  return {
    id: _id, kind, category, industry, district, title, summary, label, context,
    description, author, facts, validity, createdAt, expiresAt,
    own: owner === user,
    expired: expiresAt <= Date.now(),
  };
}

function contactView(record, post, user) {
  const { _id, postId, message, status, createdAt } = record;
  return { id: _id, postId, message, status, createdAt, post: postView(post, user) };
}

function verificationView(record) {
  if (!record) return null;
  const { name, college, major, year, degree, status, createdAt } = record;
  return { name, college, major, year, degree, status, createdAt };
}

async function findPosts(ids) {
  const unique = Array.from(new Set(ids));
  const posts = new Map();
  for (let offset = 0; offset < unique.length; offset += batchSize) {
    const batch = unique.slice(offset, offset + batchSize);
    const result = await records.where({ recordType: 'post', _id: db.command.in(batch) }).limit(batchSize).get();
    for (const post of result.data) posts.set(post._id, post);
  }
  return posts;
}

const actions = {
  async feed(payload, user) {
    const posts = await scan({ recordType: 'post', expiresAt: db.command.gt(Date.now()) });
    return posts.sort(newestFirst).map((post) => postView(post, user));
  },

  async detail({ id }, user) {
    const post = await find(readId(id), 'post');
    if (!post) return { post: null, request: null, saved: false };
    const [request, favorite] = await Promise.all([
      find(key('contact', user, id), 'contact'),
      find(key('favorite', user, id), 'favorite'),
    ]);
    return { post: postView(post, user), request: request ? contactView(request, post, user) : null, saved: Boolean(favorite) };
  },

  async publish({ kind, category, industry, district, days, title, description, submissionId }, user) {
    if (!['opportunity', 'request'].includes(kind) || !categories.includes(category) || !industries.includes(industry) ||
        !districts.includes(district) || ![7, 15, 30].includes(days)) {
      throw new InputError('请选择发布类型、分类、行业、地区和有效期');
    }
    if (typeof submissionId !== 'string' || !/^[a-z0-9-]{8,80}$/.test(submissionId)) {
      throw new InputError('请重新打开发布表单');
    }
    title = requiredText(title, 40, '标题');
    description = requiredText(description, 600, '详细介绍');
    const createdAt = Date.now();
    const validity = days + ' 天';
    const post = await insertOnce({
      _id: key('post', user, submissionId), recordType: 'post', owner: user,
      kind, category, industry, district, title, description, createdAt,
      summary: description.replace(/\s+/g, ' '),
      label: kind === 'opportunity' ? '校友资源' : '校友求助',
      context: category + ' · ' + industry,
      validity: validity + '有效',
      expiresAt: createdAt + days * 86400000,
      author: anonymousAuthor,
      facts: [
        { label: '信息分类', value: category },
        { label: '所属行业', value: industry },
        { label: '所在地区', value: district === '全上海' ? district : '上海 · ' + district },
        { label: '信息有效期', value: validity },
      ],
    });
    return postView(post, user);
  },

  async favorite({ id, saved }, user) {
    const post = await find(readId(id), 'post');
    if (typeof saved !== 'boolean' || !post) throw new InputError('信息不存在');
    const favoriteId = key('favorite', user, id);
    if (saved) {
      await insertOnce({ _id: favoriteId, recordType: 'favorite', owner: user, postId: id, createdAt: Date.now() });
    } else {
      await records.where({ _id: favoriteId, recordType: 'favorite', owner: user }).remove();
    }
    return saved;
  },

  async contact({ id, message }, user) {
    const post = await find(readId(id), 'post');
    if (!post || post.owner === user || post.expiresAt <= Date.now()) throw new InputError('这条信息暂无法申请联系');
    message = requiredText(message, 120, '联系说明');
    const request = await insertOnce({
      _id: key('contact', user, id), recordType: 'contact', owner: user, recipient: post.owner,
      postId: id, message, status: 'pending', createdAt: Date.now(),
    });
    return contactView(request, post, user);
  },

  async respond({ id, status }, user) {
    if (!['accepted', 'declined'].includes(status)) throw new InputError('申请状态无效');
    const { stats } = await records.where({
      _id: readId(id), recordType: 'contact', recipient: user, status: 'pending',
    }).update({ data: { status } });
    if (!stats.updated) throw new InputError('申请已处理或无法访问');
    return status;
  },

  async profile(payload, user) {
    const [publications, favorites, outgoing, verification] = await Promise.all([
      scan({ recordType: 'post', owner: user }),
      scan({ recordType: 'favorite', owner: user }),
      scan({ recordType: 'contact', owner: user }),
      find(key('verification', user), 'verification'),
    ]);
    const favoritePosts = await findPosts(favorites.map((item) => item.postId));
    return {
      author: anonymousAuthor,
      publications: publications.sort(newestFirst).map((post) => postView(post, user)),
      favorites: favorites.sort(newestFirst).map((item) => favoritePosts.get(item.postId)).filter(Boolean)
        .map((post) => postView(post, user)),
      requestCount: outgoing.length,
      verification: verificationView(verification),
    };
  },

  async messages(payload, user) {
    const [incoming, outgoing, publications, verification] = await Promise.all([
      scan({ recordType: 'contact', recipient: user }),
      scan({ recordType: 'contact', owner: user }),
      scan({ recordType: 'post', owner: user }),
      find(key('verification', user), 'verification'),
    ]);
    const posts = await findPosts([...incoming, ...outgoing].map((item) => item.postId));
    const mapContact = (item) => contactView(item, posts.get(item.postId), user);
    const notices = publications.map((post) => ({
      id: post._id, title: '发布成功', description: post.title, createdAt: post.createdAt,
    }));
    if (verification) notices.push({
      id: verification._id, title: '认证申请已提交', description: '当前为待审核状态。', createdAt: verification.createdAt,
    });
    return {
      incoming: incoming.filter((item) => posts.has(item.postId)).sort(newestFirst).map((item) => ({
        ...mapContact(item),
        name: anonymousAuthor.name,
        initial: anonymousAuthor.initial,
        subject: '想联系你：' + posts.get(item.postId).title,
      })),
      outgoing: outgoing.filter((item) => posts.has(item.postId)).sort(newestFirst).map(mapContact),
      notices: notices.sort(newestFirst),
    };
  },

  async verification(payload, user) {
    return verificationView(await find(key('verification', user), 'verification'));
  },

  async verify({ name, college, major, year, degree }, user) {
    name = requiredText(name, 20, '姓名');
    college = requiredText(college, 40, '学院');
    major = requiredText(major, 40, '专业');
    if (typeof year !== 'string' || !/^\d{4}$/.test(year) || Number(year) < 1950 ||
        Number(year) > new Date().getFullYear() + 8) throw new InputError('请输入有效的毕业年份');
    if (!['专科', '本科', '硕士', '博士'].includes(degree)) throw new InputError('请选择学历');
    const record = await insertOnce({
      _id: key('verification', user), recordType: 'verification', owner: user,
      name, college, major, year, degree, status: 'pending', createdAt: Date.now(),
    });
    return verificationView(record);
  },
};

async function dispatch(event, openId) {
  if (!Object.prototype.hasOwnProperty.call(actions, event.action)) return { ok: false, message: '不支持的操作' };
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  try {
    return { ok: true, data: await actions[event.action](payload, openId) };
  } catch (error) {
    if (error instanceof InputError) return { ok: false, message: error.message };
    console.error('alumni action failed', event.action, error.errCode || error.code || error.name);
    return { ok: false, message: '暂时无法访问云端，请稍后重试' };
  }
}

exports.main = async (event = {}) => {
  if (event.httpMethod) return handleHttp(event, dispatch);
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, message: '请从微信小程序打开' };
  return dispatch(event, OPENID);
};
