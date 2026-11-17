export const demoAuthor = {
  name: '陶校友',
  initial: '陶',
  profile: '武汉理工大学 · 计算机科学与技术',
  role: '上海 · 互联网',
};

const verificationKey = 'wulihulian:demo:verification';

export function getVerification() {
  return wx.getStorageSync(verificationKey) || null;
}

export function submitVerification(values) {
  if (getVerification()) throw new Error('已有一条待审核的申请');

  const { degree } = values;
  const name = (values.name || '').trim();
  const college = (values.college || '').trim();
  const major = (values.major || '').trim();
  const year = (values.year || '').trim();
  if (!name || !college || !major || !degree) throw new Error('请填写完整的校友资料');
  if (!/^\d{4}$/.test(year) || Number(year) < 1950 || Number(year) > new Date().getFullYear() + 8) {
    throw new Error('请输入四位数的毕业年份');
  }
  const verification = { name, college, major, year, degree, createdAt: Date.now() };
  wx.setStorageSync(verificationKey, verification);
  return verification;
}
