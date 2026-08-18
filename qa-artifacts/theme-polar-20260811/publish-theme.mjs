import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
const token = process.env.KOLKA_THEME_TOKEN;
const baseUrl = 'https://www.kolka.cn/api/admin/themes';

if (!token) {
  throw new Error('KOLKA_THEME_TOKEN is required');
}

const headers = {
  Accept: 'application/json',
  AppName: 'kolka-admin',
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function api(url, init = {}) {
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed: ${response.status} ${text}`);
  }
  const body = text ? JSON.parse(text) : null;
  return body?.data ?? body;
}

const config = JSON.parse(
  await readFile(join(directory, 'oss-theme-config.json'), 'utf8'),
);
const payload = {
  name: '极地冰川主题',
  description: '踏上闪耀冰原，和极地伙伴一起开启学习探险',
  config,
  isActive: true,
  isDefault: false,
  sort: 20,
  remark: '极昼冰川与极光夜色双模式主题，2026-08-11；按页面场景定制构图',
};

const listing = await api(`${baseUrl}?page=1&limit=100`);
const existing = listing.items?.find((theme) => theme.name === payload.name);
const result = existing
  ? await api(`${baseUrl}/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  : await api(baseUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

await writeFile(
  join(directory, 'theme-result.json'),
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${existing ? 'updated' : 'created'} ${result.id} ${result.name}\n`);
