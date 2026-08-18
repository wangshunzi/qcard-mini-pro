const fs = require('node:fs/promises');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '../../..');
const OSS = require(path.join(
  workspaceRoot,
  'QCard-Manager/manager/node_modules/ali-oss',
));

const token = process.env.KOLKA_ADMIN_TOKEN;
if (!token) throw new Error('KOLKA_ADMIN_TOKEN is required');

const apiBase = 'https://www.kolka.cn';
const publicHost = 'kolka-public.oss-cn-shanghai.aliyuncs.com';
const expectedKeys = [
  'detail_bg',
  'detail_bg_dark',
  'explore_bg',
  'explore_bg_dark',
  'gen_bg',
  'gen_bg_dark',
  'home_bg',
  'home_bg_dark',
  'learning_bg',
  'learning_bg_dark',
  'login_bg',
  'login_bg_dark',
  'profile_bg',
  'profile_bg_dark',
  'resource_bg',
  'resource_bg_dark',
  'search_bg',
  'search_bg_dark',
];

const themes = [
  {
    slug: 'ocean',
    id: '4d533396-4e15-4bdf-b15d-dad42c95602a',
    name: '海洋主题',
    objectPrefix: 'theme-images/ocean-creative-20260811-v2',
  },
  {
    slug: 'forest',
    id: 'd69f4356-2a3a-4284-aa21-5fed55ee7189',
    name: '森林主题',
    objectPrefix: 'theme-images/forest-creative-20260811-v2',
  },
].map((theme) => ({
  ...theme,
  inputDir: path.join(__dirname, theme.slug, 'compressed'),
}));

const apiHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  AppName: 'kolka-admin',
  Authorization: `Bearer ${token}`,
};

async function api(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: { ...apiHeaders, ...(options.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 2000 || !payload.data) {
    throw new Error(
      `${options.method || 'GET'} ${pathname} failed: ${response.status} ${JSON.stringify(payload)}`,
    );
  }
  return payload.data;
}

async function getStsToken() {
  return api('/api/oss/sts-token', { method: 'POST', body: '{}' });
}

async function assertLocalFiles(theme) {
  const filenames = (await fs.readdir(theme.inputDir))
    .filter((name) => name.endsWith('.jpg'))
    .sort();
  const keys = filenames.map((name) => path.basename(name, '.jpg'));
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${theme.slug}: expected exact 18-file set, got ${keys.join(', ')}`);
  }
  return filenames;
}

async function assertPrefixUnused(theme) {
  for (const key of expectedKeys) {
    const url = `https://${publicHost}/${theme.objectPrefix}/${key}.jpg`;
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      throw new Error(`Refusing to overwrite existing immutable object: ${url}`);
    }
  }
}

async function uploadTheme(client, theme, filenames) {
  const urls = {};
  for (const filename of filenames) {
    const key = `${theme.objectPrefix}/${filename}`;
    const localPath = path.join(theme.inputDir, filename);
    const stat = await fs.stat(localPath);
    await client.put(key, localPath, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-oss-object-acl': 'public-read',
      },
    });

    const url = `https://${publicHost}/${key}`;
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const remoteSize = Number(response.headers.get('content-length'));
    if (!response.ok || remoteSize !== stat.size) {
      throw new Error(
        `Public verification failed for ${key}: status=${response.status}, local=${stat.size}, remote=${remoteSize}`,
      );
    }
    urls[path.basename(filename, '.jpg')] = url;
    process.stdout.write(`uploaded ${theme.slug}/${filename} (${stat.size} bytes)\n`);
  }
  return urls;
}

function assertThemeIdentityUnchanged(before, after) {
  for (const field of ['id', 'name', 'isActive', 'isDefault', 'sort']) {
    if (after[field] !== before[field]) {
      throw new Error(
        `${before.name}: unexpected ${field} change (${before[field]} -> ${after[field]})`,
      );
    }
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const before = {};
  const localFiles = {};

  for (const theme of themes) {
    localFiles[theme.slug] = await assertLocalFiles(theme);
    await assertPrefixUnused(theme);
    before[theme.slug] = await api(`/api/admin/themes/${theme.id}`);
    if (before[theme.slug].name !== theme.name) {
      throw new Error(
        `Theme identity mismatch for ${theme.id}: ${before[theme.slug].name}`,
      );
    }
  }

  await fs.writeFile(
    path.join(__dirname, 'before-update.json'),
    `${JSON.stringify({ capturedAt: startedAt, themes: before }, null, 2)}\n`,
  );

  const sts = await getStsToken();
  const client = new OSS({
    region: sts.ossConfig.region,
    endpoint: sts.ossConfig.endpoint,
    bucket: sts.ossConfig.bucket,
    accessKeyId: sts.accessKeyId,
    accessKeySecret: sts.accessKeySecret,
    stsToken: sts.securityToken,
    secure: true,
  });

  if (sts.ossConfig.bucket !== 'kolka-public') {
    throw new Error(`Unexpected OSS bucket: ${sts.ossConfig.bucket}`);
  }

  const uploaded = {};
  for (const theme of themes) {
    uploaded[theme.slug] = await uploadTheme(
      client,
      theme,
      localFiles[theme.slug],
    );
  }

  const updatedSlugs = [];
  try {
    for (const theme of themes) {
      await api(`/api/admin/themes/${theme.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          config: { ...before[theme.slug].config, ...uploaded[theme.slug] },
        }),
      });
      updatedSlugs.push(theme.slug);
      process.stdout.write(`updated ${theme.name}\n`);
    }
  } catch (error) {
    for (const slug of updatedSlugs.reverse()) {
      const theme = themes.find((item) => item.slug === slug);
      try {
        await api(`/api/admin/themes/${theme.id}`, {
          method: 'PUT',
          body: JSON.stringify({ config: before[slug].config }),
        });
        process.stderr.write(`rolled back ${theme.name}\n`);
      } catch (rollbackError) {
        process.stderr.write(`ROLLBACK FAILED for ${theme.name}: ${rollbackError.message}\n`);
      }
    }
    throw error;
  }

  const verified = {};
  for (const theme of themes) {
    const after = await api(`/api/admin/themes/${theme.id}`);
    assertThemeIdentityUnchanged(before[theme.slug], after);
    for (const key of expectedKeys) {
      if (after.config[key] !== uploaded[theme.slug][key]) {
        throw new Error(`${theme.name}: config verification failed for ${key}`);
      }
    }
    verified[theme.slug] = after;
  }

  const result = {
    startedAt,
    completedAt: new Date().toISOString(),
    themes: Object.fromEntries(
      themes.map((theme) => [
        theme.slug,
        {
          id: theme.id,
          name: theme.name,
          objectPrefix: theme.objectPrefix,
          files: uploaded[theme.slug],
          verifiedUpdatedAt: verified[theme.slug].updatedAt,
          isActive: verified[theme.slug].isActive,
          isDefault: verified[theme.slug].isDefault,
        },
      ]),
    ),
  };
  await fs.writeFile(
    path.join(__dirname, 'upload-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write('all uploads and theme updates verified\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
