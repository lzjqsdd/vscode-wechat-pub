/**
 * 微信公众号 API 客户端
 * 提供草稿管理、图片上传等核心功能
 */

import * as https from 'https';
import * as http from 'http';
import { getCachedToken, setCachedToken, clearCachedToken } from './tokenCache';

export interface WechatConfig {
  appId: string;
  appSecret: string;
  proxyOrigin?: string;
}

export interface WechatError {
  errcode: number;
  errmsg: string;
}

export interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  errcode?: number;
  errmsg?: string;
}

export interface DraftArticle {
  title: string;
  content: string;
  thumb_media_id?: string;
  author?: string;
  digest?: string;
  content_source_url?: string;
  need_open_comment?: number;
  only_fans_can_comment?: number;
}

export interface AddDraftResponse {
  media_id: string;
  errcode?: number;
  errmsg?: string;
}

export interface GetDraftResponse {
  media_id: string;
  content: {
    news_item: DraftArticle[];
  };
  errcode?: number;
  errmsg?: string;
}

export interface UploadImageResponse {
  url: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * 微信公众号 API 客户端
 */
export class WechatApiClient {
  private config: WechatConfig;

  constructor(config: WechatConfig) {
    this.config = config;
  }

  /**
   * 获取 API 基础 URL
   */
  private getBaseUrl(): string {
    return this.config.proxyOrigin
      ? this.config.proxyOrigin
      : 'https://api.weixin.qq.com';
  }

  /**
   * 获取 access_token（带缓存）
   */
  async getAccessToken(): Promise<string> {
    // 先检查缓存
    const cached = getCachedToken(this.config.appId);
    if (cached) {
      return cached;
    }

    // 请求新 token
    const url = `${this.getBaseUrl()}/cgi-bin/stable_token`;
    const body = {
      grant_type: 'client_credential',
      appid: this.config.appId,
      secret: this.config.appSecret
    };

    const response = await this.fetchJson<AccessTokenResponse>(url, {
      method: 'POST',
      body
    });

    if (response.access_token) {
      setCachedToken(this.config.appId, response.access_token, response.expires_in);
      return response.access_token;
    }

    throw new WechatApiError(
      response.errcode || -1,
      `获取 token 失败: ${response.errmsg || '未知错误'}`
    );
  }

  /**
   * 创建草稿
   * @param title 文章标题
   * @param content 文章内容（HTML）
   * @param thumbMediaId 封面图片 media_id（可选）
   * @returns 草稿 media_id
   */
  async addDraft(title: string, content: string, thumbMediaId?: string): Promise<string> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/draft/add?access_token=${token}`;

    const articles: DraftArticle[] = [{
      title,
      content,
      thumb_media_id: thumbMediaId || '',
      author: '',
      digest: ''
    }];

    const response = await this.fetchJson<AddDraftResponse>(url, {
      method: 'POST',
      body: { articles }
    });

    if (response.media_id) {
      return response.media_id;
    }

    throw new WechatApiError(
      response.errcode || -1,
      `创建草稿失败: ${response.errmsg || '未知错误'}`
    );
  }

  /**
   * 更新草稿
   * @param mediaId 草稿 media_id
   * @param index 文章索引（从 0 开始）
   * @param title 文章标题
   * @param content 文章内容（HTML）
   */
  async updateDraft(mediaId: string, index: number, title: string, content: string): Promise<void> {
    const token = await this.getAccessToken();

    // 先获取草稿详情，获取原有的 thumb_media_id
    const draft = await this.getDraft(mediaId);
    const thumbMediaId = draft.content?.news_item?.[index]?.thumb_media_id || '';

    const url = `${this.getBaseUrl()}/cgi-bin/draft/update?access_token=${token}`;

    const response = await this.fetchJson<WechatError>(url, {
      method: 'POST',
      body: {
        media_id: mediaId,
        index,
        articles: {
          title,
          content,
          thumb_media_id: thumbMediaId,
          author: '',
          digest: ''
        }
      }
    });

    if (response.errcode !== undefined && response.errcode !== 0) {
      throw new WechatApiError(
        response.errcode,
        `更新草稿失败: ${response.errmsg}`
      );
    }
  }

  /**
   * 获取草稿详情
   * @param mediaId 草稿 media_id
   */
  async getDraft(mediaId: string): Promise<GetDraftResponse> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/draft/get?access_token=${token}`;

    const response = await this.fetchJson<GetDraftResponse>(url, {
      method: 'POST',
      body: { media_id: mediaId }
    });

    if (response.errcode !== undefined && response.errcode !== 0) {
      throw new WechatApiError(
        response.errcode,
        `获取草稿失败: ${response.errmsg}`
      );
    }

    return response;
  }

  /**
   * 上传图片到公众号（用于文章内图片）
   * @param file 图片 Buffer
   * @param filename 文件名
   * @returns 图片 URL
   */
  async uploadImage(file: Buffer, filename: string): Promise<string> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/media/uploadimg?access_token=${token}`;

    const response = await this.uploadFile<UploadImageResponse>(url, file, filename, 'image');

    if (response.url) {
      return response.url;
    }

    throw new WechatApiError(
      response.errcode || -1,
      `上传图片失败: ${response.errmsg || '未知错误'}`
    );
  }

  /**
   * 上传永久素材（封面图等）
   * @param file 图片 Buffer
   * @param filename 文件名
   * @returns media_id
   */
  async uploadMaterial(file: Buffer, filename: string): Promise<string> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/material/add_material?access_token=${token}&type=image`;

    const response = await this.uploadFile<{ media_id: string; url?: string; errcode?: number; errmsg?: string }>(
      url, file, filename, 'image'
    );

    if (response.media_id) {
      return response.media_id;
    }

    throw new WechatApiError(
      response.errcode || -1,
      `上传素材失败: ${response.errmsg || '未知错误'}`
    );
  }

  /**
   * 删除草稿
   * @param mediaId 草稿 media_id
   */
  async deleteDraft(mediaId: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/draft/delete?access_token=${token}`;

    const response = await this.fetchJson<WechatError>(url, {
      method: 'POST',
      body: { media_id: mediaId }
    });

    if (response.errcode !== undefined && response.errcode !== 0) {
      throw new WechatApiError(
        response.errcode,
        `删除草稿失败: ${response.errmsg}`
      );
    }
  }

  /**
   * 发送 JSON 请求
   */
  private async fetchJson<T>(url: string, options: { method: string; body?: any }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const module = isHttps ? https : http;

      const bodyString = options.body ? JSON.stringify(options.body) : '';

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString)
        }
      };

      const req = module.request(requestOptions, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json as T);
          } catch (e) {
            reject(new Error(`JSON 解析失败: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`请求失败: ${e.message}`));
      });

      if (bodyString) {
        req.write(bodyString);
      }
      req.end();
    });
  }

  /**
   * 上传文件（multipart/form-data）
   */
  private async uploadFile<T>(url: string, file: Buffer, filename: string, filetype: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const module = isHttps ? https : http;

      // 构建 multipart/form-data 格式
      const boundary = '----WechatPubFormBoundary' + Date.now();
      const contentType = `multipart/form-data; boundary=${boundary}`;

      const parts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="media"; filename="${filename}"\r\n`,
        `Content-Type: ${filetype}\r\n`,
        '\r\n',
        file,
        `\r\n--${boundary}--\r\n`
      ];

      // 计算总长度
      const headerParts = parts.slice(0, 4).map(p =>
        typeof p === 'string' ? Buffer.from(p, 'utf8') : p
      );
      const footerParts = parts.slice(5).map(p =>
        typeof p === 'string' ? Buffer.from(p, 'utf8') : p
      );

      const totalLength = headerParts.reduce((sum, p) => sum + p.length, 0)
        + file.length
        + footerParts.reduce((sum, p) => sum + p.length, 0);

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': totalLength
        }
      };

      const req = module.request(requestOptions, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json as T);
          } catch (e) {
            reject(new Error(`JSON 解析失败: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`上传失败: ${e.message}`));
      });

      // 写入请求体
      headerParts.forEach(p => req.write(p));
      req.write(file);
      footerParts.forEach(p => req.write(p));

      req.end();
    });
  }

  /**
   * 更新配置（用于重新设置 appId/secret）
   */
  updateConfig(config: WechatConfig): void {
    // 清除旧 token 缓存
    if (this.config.appId !== config.appId) {
      clearCachedToken(this.config.appId);
    }
    this.config = config;
  }
}

/**
 * 微信 API 错误类
 */
export class WechatApiError extends Error {
  constructor(public errcode: number, message: string) {
    super(message);
    this.name = 'WechatApiError';
  }
}