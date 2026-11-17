function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function failure(statusCode, message) {
  return json(statusCode, { ok: false, message });
}

function parseBody(event) {
  if (typeof event.body !== 'string' || event.body.length > 16384) return null;
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    const request = JSON.parse(body);
    return request && typeof request === 'object' && !Array.isArray(request) ? request : null;
  } catch {
    return null;
  }
}

async function handleHttp(event, dispatch) {
  if (event.httpMethod !== 'POST') return failure(405, '只支持 POST 请求');
  const request = parseBody(event);
  if (!request || typeof request.action !== 'string') return failure(400, '请求格式无效');
  const { code, action, payload } = request;
  if (typeof code !== 'string' || !code.trim() || code.length > 256) {
    return failure(401, '微信登录失败，请重试');
  }

  const { WX_APPID, WX_SECRET } = process.env;
  if (!WX_APPID || !WX_SECRET) return failure(503, '云端微信登录尚未配置');

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.search = new URLSearchParams({ appid: WX_APPID, secret: WX_SECRET, js_code: code, grant_type: 'authorization_code' }).toString();
  let session;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) return failure(502, '暂时无法连接微信登录服务');
    session = await response.json();
  } catch {
    return failure(502, '暂时无法连接微信登录服务');
  }

  if (session?.errcode === 40029 || session?.errcode === 40163) {
    return failure(401, '微信登录已失效，请重试');
  }
  if (session?.errcode || typeof session?.openid !== 'string' || !session.openid) {
    return failure(502, '微信登录服务暂时无法验证身份');
  }
  return json(200, await dispatch({ action, payload }, session.openid));
}

module.exports = { handleHttp };
