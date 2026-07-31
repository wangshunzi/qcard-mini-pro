import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packageRoot = path.join(root, "node_modules", "hanzi-writer");
const packageJsonPath = path.join(packageRoot, "package.json");
const sourcePath = path.join(packageRoot, "dist", "index.cjs.js");
const outputPath = path.join(
  root,
  "miniprogram",
  "vendor",
  "hanzi-writer.js",
);

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
if (packageJson.version !== "3.7.3") {
  throw new Error(`Hanzi Writer 版本必须固定为 3.7.3，当前为 ${packageJson.version}`);
}

const expected = fs
  .readFileSync(sourcePath, "utf8")
  // 3.7.3 内部部分动画分支仍直接访问浏览器全局 performance。
  // iOS 小程序 AppService 没有该全局对象，会导致笔画动画、临摹判定和
  // 正确笔画填充的 Promise 在状态提交前中断。统一改用库已有的安全时钟。
  .replace(
    /(?<!\.)\bperformance\.now\(\)/g,
    "performanceNow()",
  )
  // 小程序 Canvas 2D 要求通过 Canvas API 创建路径；库内置的命令回放分支
  // 已专门兼容微信，因此禁用浏览器全局 Path2D 分支。
  .replace(
    "constructor(stroke, usePath2D = true)",
    "constructor(stroke, usePath2D = false)",
  )
  .replace(/\n?\/\/# sourceMappingURL=index\.cjs\.js\.map\s*$/, "\n");

if (process.argv.includes("--check")) {
  if (!fs.existsSync(outputPath)) {
    throw new Error("小程序主包缺少 vendor/hanzi-writer.js，请运行 pnpm vendor:hanzi");
  }
  if (fs.readFileSync(outputPath, "utf8") !== expected) {
    throw new Error("小程序主包 Hanzi Writer 与依赖版本不一致，请运行 pnpm vendor:hanzi");
  }
  console.log("Hanzi Writer 主包构建校验通过：3.7.3");
  process.exit(0);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, expected);
console.log(
  `已生成小程序主包 Hanzi Writer：${path.relative(root, outputPath)} (${expected.length} bytes)`,
);
