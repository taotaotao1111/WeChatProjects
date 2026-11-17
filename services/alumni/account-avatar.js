const avatarCacheKey = 'wulihulian:account-avatar-path';

export async function encodeAvatar(filePath) {
  const { width, height } = await wx.getImageInfo({ src: filePath });
  const scale = Math.min(1, 256 / Math.max(width, height));
  const { tempFilePath } = await wx.compressImage({
    src: filePath,
    quality: 75,
    compressedWidth: Math.max(1, Math.round(width * scale)),
    compressedHeight: Math.max(1, Math.round(height * scale)),
  });
  const files = wx.getFileSystemManager();
  if (files.statSync(tempFilePath).size > 131072) throw new Error('头像太大，请换一张图片');
  return files.readFileSync(tempFilePath, 'base64');
}

export function avatarPath(avatar) {
  if (!avatar) return '';
  const path = `${wx.env.USER_DATA_PATH}/alumni-avatar-${avatar.id}.${avatar.extension}`;
  const files = wx.getFileSystemManager();
  try {
    const previous = wx.getStorageSync(avatarCacheKey);
    files.writeFileSync(path, avatar.data, 'base64');
    wx.setStorageSync(avatarCacheKey, path);
    if (previous && previous !== path && previous.startsWith(`${wx.env.USER_DATA_PATH}/alumni-avatar-`)) {
      files.unlink({ filePath: previous });
    }
    return path;
  } catch {
    return `data:image/${avatar.extension === 'jpg' ? 'jpeg' : 'png'};base64,${avatar.data}`;
  }
}
