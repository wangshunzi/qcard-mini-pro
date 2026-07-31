import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { CLIENT_CARD_ASSETS } from "./client-card-assets.mjs";

const clientComponentsRoot = path.resolve(
  import.meta.dirname,
  "../../QCard-Client/src/cards/components",
);
const failures = [];

for (const [relativePath, expectedHash] of Object.entries(CLIENT_CARD_ASSETS)) {
  try {
    const bytes = await readFile(path.join(clientComponentsRoot, relativePath));
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== expectedHash) {
      failures.push(`${relativePath}: SHA-256 已变化`);
    }
  } catch (error) {
    failures.push(
      `${relativePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

if (failures.length) {
  console.error(`Client 卡片素材校验失败（${failures.length} 项）`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Client 卡片素材校验通过：${Object.keys(CLIENT_CARD_ASSETS).length} 个文件`,
);
