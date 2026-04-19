/**
 * 微信公众号 Token 缓存模块
 * 用于缓存 access_token，避免频繁请求
 */

interface TokenInfo {
  accessToken: string;
  expireAt: number;
}

// 内存缓存，按 appId 存储 token 信息
const tokenCache = new Map<string, TokenInfo>();

/**
 * 从缓存获取 token
 * @param appId 公众号 AppID
 * @returns token 字符串，如果过期或不存在则返回 null
 */
export function getCachedToken(appId: string): string | null {
  const info = tokenCache.get(appId);
  if (info && info.expireAt > Date.now()) {
    return info.accessToken;
  }
  // 清除过期缓存
  if (info) {
    tokenCache.delete(appId);
  }
  return null;
}

/**
 * 设置缓存 token
 * @param appId 公众号 AppID
 * @param token access_token
 * @param expiresIn 过期时间（秒）
 */
export function setCachedToken(appId: string, token: string, expiresIn: number): void {
  tokenCache.set(appId, {
    accessToken: token,
    expireAt: Date.now() + expiresIn * 1000 - 60000 // 提前1分钟过期，避免临界时间失效
  });
}

/**
 * 清除指定 appId 的缓存
 * @param appId 公众号 AppID
 */
export function clearCachedToken(appId: string): void {
  tokenCache.delete(appId);
}

/**
 * 清除所有缓存
 */
export function clearAllCachedTokens(): void {
  tokenCache.clear();
}