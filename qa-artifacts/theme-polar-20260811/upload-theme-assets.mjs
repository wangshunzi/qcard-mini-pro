import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
const token = process.env.KOLKA_THEME_TOKEN;

if (!token) {
  throw new Error('KOLKA_THEME_TOKEN is required');
}

const requireFromManager = createRequire(
  join(directory, '../../../QCard-Manager/manager/package.json'),
);
const OSS = requireFromManager('ali-oss');

const response = await fetch('https://www.kolka.cn/api/oss/sts-token', {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    AppName: 'kolka-admin',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
});

if (!response.ok) {
  throw new Error(`STS request failed: ${response.status} ${await response.text()}`);
}

const stsEnvelope = await response.json();
const sts = stsEnvelope.data ?? stsEnvelope;
const client = new OSS({
  region: sts.ossConfig.region,
  accessKeyId: sts.accessKeyId,
  accessKeySecret: sts.accessKeySecret,
  stsToken: sts.securityToken,
  bucket: sts.ossConfig.bucket,
  secure: true,
});
const endpointHost = sts.ossConfig.endpoint.replace(/^https?:\/\//, '');

const names = [
  'home_bg',
  'home_bg_dark',
  'explore_bg',
  'explore_bg_dark',
  'resource_bg',
  'resource_bg_dark',
  'profile_bg',
  'profile_bg_dark',
  'learning_bg',
  'learning_bg_dark',
  'detail_bg',
  'detail_bg_dark',
  'search_bg',
  'search_bg_dark',
  'gen_bg',
  'gen_bg_dark',
  'login_bg',
  'login_bg_dark',
];

const config = {};
for (const name of names) {
  const assetName = name === 'gen_bg_dark' ? 'gen_bg_dark-v4' : name;
  const objectKey = `theme-images/polar-glacier-20260811/${assetName}.jpg`;
  const body = await readFile(join(directory, 'compressed', `${assetName}.jpg`));
  await client.put(objectKey, body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  config[name] = `https://${sts.ossConfig.bucket}.${endpointHost}/${objectKey}`;
  process.stdout.write(`uploaded ${name}\n`);
}

await writeFile(
  join(directory, 'oss-theme-config.json'),
  `${JSON.stringify(config, null, 2)}\n`,
  'utf8',
);
process.stdout.write('wrote oss-theme-config.json\n');
