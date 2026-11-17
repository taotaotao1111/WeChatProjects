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
const degrees = ['本科', '硕士', '博士'];
const daysInMs = 86400000;
const validityDays = [7, 15, 30];
const recruiting = { role: '岗位名称', experience: '经验要求', application: '投递方式' };
const jobSeeking = { role: '目标岗位', experience: '已有经验', support: '希望获得' };
const partnership = { stage: '项目阶段', role: '寻找角色', cooperation: '合作方式' };

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

function postView(post, user, authorVerified = false) {
  const { _id, owner, kind, category, industry, district, title, summary, label, context,
    description, author, facts, validity, createdAt, expiresAt } = post;
  return {
    id: _id, kind, category, industry, district, title, summary, label, context,
    description, author, validity, createdAt, expiresAt, authorVerified,
    facts: post.renewedFrom ? (facts || []).map((fact) => fact.label === '信息有效期' ? { ...fact, value: validity } : fact) : facts,
    highlights: post.highlights,
    completionLabel: post.completionLabel || '',
    own: owner === user,
    withdrawn: Boolean(post.withdrawnAt),
    expired: expiresAt <= Date.now(),
  };
}

function contactView(record, post, user) {
  const { _id, postId, message, status, createdAt } = record;
  const incoming = record.recipient === user;
  const outgoing = record.owner === user;
  const ownWechatId = incoming ? record.recipientWechatId : record.wechatId;
  const otherWechatId = incoming ? record.wechatId : record.recipientWechatId;
  return {
    id: _id, postId, message, status, createdAt, post: postView(post, user),
    wechatId: status === 'accepted' && (incoming || outgoing) ? otherWechatId || '' : '',
    hasSharedWechatId: (incoming || outgoing) && Boolean(ownWechatId),
  };
}

function readWechatId(value) {
  if (typeof value !== 'string' || value.trim().length > 30) throw new InputError('请输入有效的微信号');
  return value.trim();
}

function pendingContacts(user) {
  return { recordType: 'contact', recipient: user, status: 'pending' };
}

function verificationView(record) {
  if (!record) return null;
  const { name, college, major, year, degree, status, createdAt } = record;
  return { name, college, major, year, degree, status, createdAt, reviewNote: record.reviewNote || '' };
}

function isAdmin(user) {
  return (process.env.ALUMNI_ADMIN_OPENIDS || '').split(',').some((id) => id.trim() === user);
}

function requireAdmin(user) {
  if (!isAdmin(user)) throw new InputError('当前账号没有管理权限');
}

function accountAuthor(profile) {
  if (!profile) return anonymousAuthor;
  return { ...anonymousAuthor, name: profile.nickname, initial: Array.from(profile.nickname)[0], avatar: profile.avatar, personalized: true };
}

function readAvatar(value) {
  if (typeof value !== 'string' || value.length > 174764 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new InputError('请选择小于 128 KB 的头像图片');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || bytes.length > 131072) throw new InputError('头像图片无效');
  const isPng = bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  const isJpeg = bytes.subarray(0, 3).toString('hex') === 'ffd8ff' && bytes.subarray(-2).toString('hex') === 'ffd9';
  if (!isPng && !isJpeg) throw new InputError('请选择 JPG 或 PNG 头像');
  return { data: value, extension: isPng ? 'png' : 'jpg', id: key('avatar', value) };
}

function postFields({ category, industry, district, title, description, highlights }, validity, kind, oldFacts = []) {
  if (!categories.includes(category) || !industries.includes(industry) || !districts.includes(district)) {
    throw new InputError('请选择分类、行业和地区');
  }
  title = requiredText(title, 40, '标题');
  description = requiredText(description, 600, '详细介绍');
  const labels = category === '创业合作' ? partnership : category === '求职招聘' ? (kind === 'opportunity' ? recruiting : jobSeeking) : {};
  if (highlights === undefined) {
    highlights = Object.fromEntries(Object.entries(labels).map(([key, label]) => [key, oldFacts.find((fact) => fact.label === label)?.value]));
  }
  if (!highlights || typeof highlights !== 'object' || Array.isArray(highlights)) throw new InputError('请检查补充信息');
  const normalizedHighlights = {};
  const highlightFacts = [];
  for (const [key, label] of Object.entries(labels)) {
    const raw = highlights[key];
    if (raw === undefined || raw === '') continue;
    if (typeof raw !== 'string' || raw.trim().length > 80) throw new InputError(label + '最多填写 80 字');
    if (raw.trim()) {
      normalizedHighlights[key] = raw.trim();
      highlightFacts.push({ label, value: normalizedHighlights[key] });
    }
  }
  const baseFacts = [
    { label: '信息分类', value: category },
    { label: '所属行业', value: industry },
    { label: '所在地区', value: district === '全上海' ? district : '上海 · ' + district },
    { label: '信息有效期', value: validity },
  ];
  const currentLabels = new Set([...Object.values(labels), ...baseFacts.map((fact) => fact.label)]);
  return {
    category, industry, district, title, description,
    highlights: normalizedHighlights,
    summary: description.replace(/\s+/g, ' '),
    context: category + ' · ' + industry,
    facts: [...highlightFacts, ...baseFacts, ...oldFacts.filter((fact) => !currentLabels.has(fact.label))],
  };
}

function completionLabel(post) {
  if (post.category === '创业合作') return '已找到合伙人';
  if (post.category === '求职招聘' && post.kind === 'opportunity') return '已招满';
  return '已解决';
}

async function withdraw(filter) {
  const { stats } = await records.where(filter).update({ data: { expiresAt: 0, withdrawnAt: Date.now() } });
  if (!stats.updated) throw new InputError('无法下架这条信息');
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
    if (!post || (post.withdrawnAt && post.owner !== user && !isAdmin(user))) {
      return { post: null, request: null, saved: false };
    }
    const [request, favorite, verification] = await Promise.all([
      find(key('contact', user, id), 'contact'),
      find(key('favorite', user, id), 'favorite'),
      find(key('verification', post.owner), 'verification'),
    ]);
    return { post: postView(post, user, verification?.status === 'approved'), request: request ? contactView(request, post, user) : null, saved: Boolean(favorite) };
  },

  async publish({ kind, days, submissionId, ...values }, user) {
    if (!['opportunity', 'request'].includes(kind) || !validityDays.includes(days)) {
      throw new InputError('请选择发布类型和有效期');
    }
    if (typeof submissionId !== 'string' || !/^[a-z0-9-]{8,80}$/.test(submissionId)) {
      throw new InputError('请重新打开发布表单');
    }
    const createdAt = Date.now();
    const validity = days + ' 天';
    const post = await insertOnce({
      _id: key('post', user, submissionId), recordType: 'post', owner: user,
      ...postFields(values, validity, kind),
      kind, createdAt,
      label: kind === 'opportunity' ? '校友资源' : '校友求助',
      validity: validity + '有效',
      expiresAt: createdAt + days * daysInMs,
      author: anonymousAuthor,
    });
    return postView(post, user);
  },

  async editPost({ id, ...values }, user) {
    const post = await find(readId(id), 'post');
    if (!post || post.owner !== user || post.expiresAt <= Date.now()) throw new InputError('这条信息暂无法编辑');
    const sameCategory = values.category === post.category;
    const highlights = values.highlights ?? (sameCategory ? post.highlights : undefined);
    const oldFacts = sameCategory ? post.facts || [] : [];
    const validity = (post.renewedFrom ? post.validity : post.facts?.find((fact) => fact.label === '信息有效期')?.value) || post.validity;
    const fields = postFields({ ...values, highlights }, validity, post.kind, oldFacts);
    const { stats } = await records.where({
      _id: id, recordType: 'post', owner: user, expiresAt: db.command.gt(Date.now()),
    }).update({ data: fields });
    if (!stats.updated) throw new InputError('这条信息暂无法编辑');
    return postView({ ...post, ...fields }, user);
  },

  async withdrawPost({ id }, user) {
    const post = await find(readId(id), 'post');
    if (!post || post.owner !== user || post.completionLabel) throw new InputError('无法下架这条信息');
    if (post.withdrawnAt) return;
    await withdraw({ _id: id, recordType: 'post', owner: user, expiresAt: db.command.gt(0) });
  },

  async completePost({ id }, user) {
    const post = await find(readId(id), 'post');
    if (!post || post.owner !== user || post.withdrawnAt) throw new InputError('无法标记这条信息');
    if (post.completionLabel) return;
    const { stats } = await records.where({
      _id: id, recordType: 'post', owner: user, expiresAt: post.expiresAt, category: post.category,
    }).update({ data: { expiresAt: 0, completedAt: Date.now(), completionLabel: completionLabel(post) } });
    if (!stats.updated) throw new InputError('信息状态已变化，请刷新后重试');
  },

  async renewPost({ id, days, expiresAt }, user) {
    if (!validityDays.includes(days) || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) throw new InputError('请选择续期时长');
    const post = await find(readId(id), 'post');
    if (!post || post.owner !== user || post.withdrawnAt || post.completionLabel) throw new InputError('这条信息暂无法续期');
    if (post.expiresAt !== expiresAt) {
      if (post.renewedFrom === expiresAt && post.renewedDays === days) return;
      throw new InputError('信息有效期已更新，请刷新后重试');
    }
    const newExpiry = Math.max(post.expiresAt, Date.now()) + days * daysInMs;
    const validity = '已续期 ' + days + ' 天';
    const { stats } = await records.where({ _id: id, recordType: 'post', owner: user, expiresAt })
      .update({ data: { expiresAt: newExpiry, renewedFrom: expiresAt, renewedDays: days, validity } });
    if (!stats.updated) throw new InputError('信息状态已变化，请刷新后重试');
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

  async contact({ id, message, wechatId = '' }, user) {
    const post = await find(readId(id), 'post');
    if (!post || post.owner === user || post.expiresAt <= Date.now()) throw new InputError('这条信息暂无法申请联系');
    message = requiredText(message, 120, '联系说明');
    const request = await insertOnce({
      _id: key('contact', user, id), recordType: 'contact', owner: user, recipient: post.owner,
      postId: id, message, wechatId: readWechatId(wechatId), status: 'pending', createdAt: Date.now(),
    });
    return contactView(request, post, user);
  },

  async respond({ id, status, wechatId = '' }, user) {
    if (!['accepted', 'declined'].includes(status)) throw new InputError('申请状态无效');
    const data = status === 'accepted' ? { status, recipientWechatId: readWechatId(wechatId) } : { status };
    const { stats } = await records.where({
      ...pendingContacts(user), _id: readId(id),
    }).update({ data });
    if (!stats.updated) throw new InputError('申请已处理或无法访问');
    return status;
  },

  async updateContactWechat({ id, wechatId }, user) {
    wechatId = readWechatId(wechatId);
    if (!wechatId) throw new InputError('请填写你的微信号');
    const { stats } = await records.where({
      _id: readId(id), recordType: 'contact', owner: user, status: db.command.in(['pending', 'accepted']),
    }).update({ data: { wechatId } });
    if (!stats.updated) throw new InputError('这条申请无法更新微信号');
  },

  async pendingContactCount(payload, user) {
    const { total } = await records.where(pendingContacts(user)).count();
    return total;
  },

  async profile(payload, user) {
    const [publications, favorites, outgoing, verification, account] = await Promise.all([
      scan({ recordType: 'post', owner: user }),
      scan({ recordType: 'favorite', owner: user }),
      scan({ recordType: 'contact', owner: user }),
      find(key('verification', user), 'verification'),
      find(key('accountProfile', user), 'accountProfile'),
    ]);
    const favoritePosts = await findPosts(favorites.map((item) => item.postId));
    return {
      author: accountAuthor(account),
      publications: publications.sort(newestFirst).map((post) => postView(post, user)),
      favorites: favorites.sort(newestFirst).map((item) => favoritePosts.get(item.postId))
        .filter((post) => post && !post.withdrawnAt)
        .map((post) => postView(post, user)),
      requestCount: outgoing.length,
      verification: verificationView(verification),
      isAdmin: isAdmin(user),
    };
  },

  async saveAccountProfile({ nickname, avatar }, user) {
    nickname = requiredText(nickname, 32, '昵称');
    const fields = { nickname };
    if (avatar !== undefined) fields.avatar = readAvatar(avatar);
    const _id = key('accountProfile', user);
    const existing = await insertOnce({ _id, recordType: 'accountProfile', owner: user, ...fields });
    if (existing.nickname !== nickname || (fields.avatar && existing.avatar?.id !== fields.avatar.id)) {
      const { stats } = await records.where({ _id, recordType: 'accountProfile', owner: user }).update({ data: fields });
      if (!stats.updated) throw new InputError('资料暂时无法保存，请重试');
    }
    return accountAuthor({ ...existing, ...fields });
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
    if (verification) {
      const title = { approved: '校友认证已通过', rejected: '校友认证未通过' }[verification.status] || '认证申请已提交';
      notices.push({
        id: verification._id, title, description: verification.reviewNote || (verification.status === 'pending' ? '等待管理员审核。' : ''),
        createdAt: verification.reviewedAt || verification.createdAt,
      });
    }
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
    if (!degrees.includes(degree)) throw new InputError('请选择学历');
    const record = {
      _id: key('verification', user), recordType: 'verification', owner: user,
      name, college, major, year, degree, status: 'pending', createdAt: Date.now(),
    };
    const existing = await find(record._id, 'verification');
    if (existing?.status === 'rejected') {
      const { _id, recordType, owner, ...fields } = record;
      const { stats } = await records.where({ _id, recordType, owner, status: 'rejected' })
        .update({ data: { ...fields, reviewedAt: null, reviewNote: '' } });
      if (stats.updated) return verificationView(record);
    }
    return verificationView(await insertOnce(record));
  },

  async reportPost({ id, reason }, user) {
    const post = await find(readId(id), 'post');
    if (!post || post.owner === user || post.withdrawnAt) throw new InputError('这条信息暂无法举报');
    await insertOnce({
      _id: key('report', user, id), recordType: 'report', owner: user,
      postId: id, reason: requiredText(reason, 120, '举报说明'), status: 'pending', createdAt: Date.now(),
    });
  },

  async moderation(payload, user) {
    requireAdmin(user);
    const [verifications, reports] = await Promise.all([
      scan({ recordType: 'verification', status: 'pending' }),
      scan({ recordType: 'report', status: db.command.in(['pending', 'withdrawing']) }),
    ]);
    const posts = await findPosts(reports.map((report) => report.postId));
    return {
      verifications: verifications.sort(newestFirst).map((entry) => ({ id: entry._id, ...verificationView(entry) })),
      reports: reports.sort(newestFirst).map(({ _id, postId, reason, status }) => ({
        id: _id, postId, reason, status, title: posts.get(postId)?.title || '信息不可用',
      })),
    };
  },

  async reviewVerification({ id, status, reviewNote = '' }, user) {
    requireAdmin(user);
    if (!['approved', 'rejected'].includes(status)) throw new InputError('审核状态无效');
    const note = status === 'rejected' ? requiredText(reviewNote, 120, '拒绝原因') : '';
    const { stats } = await records.where({ _id: readId(id), recordType: 'verification', status: 'pending' })
      .update({ data: { status, reviewNote: note, reviewedAt: Date.now() } });
    if (!stats.updated) throw new InputError('申请已处理或不存在');
  },

  async resolveReport({ id, status }, user) {
    requireAdmin(user);
    if (!['dismissed', 'withdrawn'].includes(status)) throw new InputError('处理状态无效');
    const criteria = { _id: readId(id), recordType: 'report' };
    if (status === 'dismissed') {
      const { stats } = await records.where({ ...criteria, status: 'pending' })
        .update({ data: { status, reviewedAt: Date.now() } });
      if (!stats.updated) throw new InputError('举报已处理或不存在');
      return;
    }

    await records.where({ ...criteria, status: 'pending' }).update({ data: { status: 'withdrawing' } });
    const report = await find(id, 'report');
    if (report?.status === 'withdrawn') return;
    if (report?.status !== 'withdrawing') throw new InputError('举报已处理或不存在');
    if (await find(report.postId, 'post')) await withdraw({ _id: report.postId, recordType: 'post' });
    await records.where({ ...criteria, status: 'withdrawing' })
      .update({ data: { status, reviewedAt: Date.now() } });
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
