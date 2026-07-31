const fs = require("node:fs");
const path = require("node:path");
const automator = require("miniprogram-automator");

const projectPath = path.resolve(__dirname, "..");
const outputDir = path.join(projectPath, ".audit", "card-interaction-2026-07-28");
const productionFixturePath = "/tmp/qcard_faces.json";
const cliPath = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function productionCards() {
  const body = JSON.parse(fs.readFileSync(productionFixturePath, "utf8"));
  return body?.data?.items ?? body?.items ?? [];
}

function cardByType(cards, type) {
  const card = cards.find((item) => item.type === type);
  if (!card) throw new Error(`缺少 ${type} 生产卡片数据`);
  return card;
}

function transfer(card) {
  return {
    title: card.name || card.type,
    front: {
      type: card.type,
      data: card.data,
      schemaVersion: Number(card.schemaVersion || 1),
    },
  };
}

async function render(miniProgram, definition) {
  process.stdout.write(`capture:start:${definition.file}\n`);
  await miniProgram.callWxMethod(
    "setStorageSync",
    "qcard.card-transfer",
    transfer(definition.card),
  );
  await miniProgram.callWxMethod("navigateTo", {
    url: "/package-cards/pages/preview/index",
  });
  let page = null;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (page?.path === "package-cards/pages/preview/index") break;
    await sleep(200);
    page = await miniProgram.currentPage();
  }
  process.stdout.write(`capture:navigated:${definition.file}\n`);
  if (!page || page.path !== "package-cards/pages/preview/index") {
    const stack = await miniProgram.pageStack();
    throw new Error(
      `无法进入 ${definition.card.type} 预览页，当前页面：${
        stack.map((item) => item.path).join(" -> ") || "空"
      }`,
    );
  }
  await page.waitFor("#card");
  await sleep(900);
  const flip = await page.$("#card");
  const renderer = flip ? await flip.$(".card-renderer") : null;
  if (!renderer) throw new Error(`未找到 ${definition.card.type} 渲染组件`);
  if (definition.prepare) {
    process.stdout.write(`capture:prepare:${definition.file}\n`);
    await definition.prepare(renderer, page, flip);
    await sleep(definition.waitAfterPrepare ?? 700);
  }
  const screenshotPath = path.join(outputDir, definition.file);
  await miniProgram.screenshot({ path: screenshotPath });
  process.stdout.write(`capture:screenshot:${definition.file}\n`);
  const rendererData = await renderer.data();
  fs.writeFileSync(
    path.join(outputDir, definition.file.replace(/\.png$/, ".json")),
    JSON.stringify(rendererData, null, 2),
  );
  await miniProgram.callWxMethod("navigateBack", { delta: 1 });
  await new Promise((resolve) => setTimeout(resolve, 250));
  return screenshotPath;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const cards = productionCards();
  const story = cardByType(cards, "story_card");
  const backgroundImage =
    story.data?.images?.[0]?.url ||
    cardByType(cards, "recognition_pic_card").data?.content?.[0]?.mainImage ||
    "";
  const syntheticCards = [
    {
      name: "选择卡交互审计",
      type: "choice_card",
      schemaVersion: 1,
      data: {
        backgroundImage,
        question: { mode: "text", text: "哪个是夏天常见的水果？" },
        options: [
          { id: "a", mode: "text", text: "西瓜", isCorrect: true, explanation: "西瓜清甜多汁。" },
          { id: "b", mode: "text", text: "石头", isCorrect: false },
          { id: "c", mode: "text", text: "雨伞", isCorrect: false },
          { id: "d", mode: "text", text: "风筝", isCorrect: false },
        ],
      },
    },
    {
      name: "连线卡交互审计",
      type: "matching_card",
      schemaVersion: 1,
      data: {
        backgroundImage,
        leftItems: [
          { id: "l1", mode: "text", text: "西瓜" },
          { id: "l2", mode: "text", text: "荷花" },
          { id: "l3", mode: "text", text: "蝉" },
        ],
        rightItems: [
          { id: "r1", mode: "text", text: "水果" },
          { id: "r2", mode: "text", text: "植物" },
          { id: "r3", mode: "text", text: "昆虫" },
        ],
        pairs: [
          { leftId: "l1", rightId: "r1" },
          { leftId: "l2", rightId: "r2" },
          { leftId: "l3", rightId: "r3" },
        ],
      },
    },
    {
      name: "分类卡交互审计",
      type: "classification_card",
      schemaVersion: 1,
      data: {
        backgroundImage,
        items: [
          { id: "apple", mode: "text", text: "苹果" },
          { id: "lotus", mode: "text", text: "荷花" },
          { id: "watermelon", mode: "text", text: "西瓜" },
          { id: "tree", mode: "text", text: "大树" },
        ],
        rules: [{
          id: "kind",
          title: "按类别分",
          buckets: [
            { id: "fruit", title: "水果" },
            { id: "plant", title: "植物" },
          ],
          answers: [
            { itemId: "apple", bucketId: "fruit" },
            { itemId: "lotus", bucketId: "plant" },
            { itemId: "watermelon", bucketId: "fruit" },
            { itemId: "tree", bucketId: "plant" },
          ],
        }],
      },
    },
  ];

  const definitions = [
    {
      card: cardByType(cards, "recognition_pic_card"),
      file: "01-recognition-playing.png",
      prepare: (renderer) => renderer.callMethod("playJingle"),
    },
    {
      card: cardByType(cards, "literacy_card"),
      file: "02-literacy-conversation.png",
      prepare: (renderer) => renderer.callMethod("openConversation"),
    },
    {
      card: story,
      file: "03-story-active-dialogue.png",
      prepare: async (renderer) => {
        const state = await renderer.data();
        const paragraph = state.paragraphs[Math.min(5, state.paragraphs.length - 1)];
        await renderer.callMethod("syncParagraph", paragraph.startTime);
      },
    },
    {
      card: cardByType(cards, "sound_object_card"),
      file: "04-sound-object-progress.png",
      prepare: async (renderer) => {
        await renderer.callMethod("setPhase", "scratching");
        await renderer.setData({ audioProgressDeg: 216 });
        await renderer.callMethod("drawControlOverlay");
      },
    },
    {
      card: syntheticCards[0],
      file: "05-choice-wrong.png",
      waitAfterPrepare: 180,
      prepare: (renderer) =>
        renderer.callMethod("choose", {
          currentTarget: {
            dataset: {
              option: syntheticCards[0].data.options[1],
            },
          },
        }),
    },
    {
      card: cardByType(cards, "silhouette_choice_card"),
      file: "06-silhouette-science-playing.png",
      prepare: (renderer) => renderer.setData({ phase: "science" }),
    },
    {
      card: cardByType(cards, "listening_comprehension_card"),
      file: "07-listening-progress.png",
      prepare: (renderer) =>
        renderer.setData({ progress: 62, progressDeg: 223.2 }),
    },
    {
      card: cardByType(cards, "listening_comprehension_card"),
      file: "07b-listening-answering.png",
      prepare: async (renderer) => {
        await renderer.setData({ hasListenedOnce: true });
        await renderer.callMethod("startAnswering");
      },
    },
    {
      card: cardByType(cards, "puzzle_card"),
      file: "07c-puzzle-shuffle-moved.png",
      waitAfterPrepare: 300,
      prepare: async (renderer, page) => {
        await renderer.callMethod("start");
        await sleep(1700);
        await renderer.callMethod("clearStartTimers");
        await renderer.setData({
          shuffling: false,
          starting: false,
          animationPhase: "playing",
          phaseText: "",
        });
        const before = await renderer.data();
        const row = Math.floor(before.emptySlot / before.level);
        const column = before.emptySlot % before.level;
        const neighbor =
          column > 0
            ? before.emptySlot - 1
            : column < before.level - 1
              ? before.emptySlot + 1
              : row > 0
                ? before.emptySlot - before.level
                : before.emptySlot + before.level;
        const hitSlots = await renderer.$$(".shuffle-hit-slot");
        if (!hitSlots[neighbor]) throw new Error("拼图点击热区未渲染");
        await hitSlots[neighbor].tap();
        await sleep(150);
        const after = await renderer.data();
        if (after.emptySlot !== neighbor || !after.hasUserMoved) {
          throw new Error("拼图模式点击相邻碎片后没有移动");
        }
      },
    },
    {
      card: cardByType(cards, "puzzle_card"),
      file: "07d-puzzle-fill-dragged.png",
      waitAfterPrepare: 350,
      prepare: async (renderer, page) => {
        process.stdout.write("puzzle-fill:mode\n");
        await renderer.callMethod("toggleMode", {
          currentTarget: { dataset: { mode: "fill" } },
        });
        process.stdout.write("puzzle-fill:start\n");
        await renderer.callMethod("start");
        await sleep(2500);
        process.stdout.write("puzzle-fill:query\n");
        const pools = await renderer.$$(".pool-tile");
        const slots = await renderer.$$(".slot");
        if (!pools.length || !slots.length) {
          throw new Error("匹配模式碎片池或网格没有渲染");
        }
        const poolOffset = await pools[0].offset();
        const poolSize = await pools[0].size();
        const slotOffset = await slots[0].offset();
        const slotSize = await slots[0].size();
        const start = {
          identifier: 1,
          clientX: Number(poolOffset.left) + Number(poolSize.width) / 2,
          clientY: Number(poolOffset.top) + Number(poolSize.height) / 2,
        };
        const end = {
          identifier: 1,
          clientX: Number(slotOffset.left) + Number(slotSize.width) / 2,
          clientY: Number(slotOffset.top) + Number(slotSize.height) / 2,
        };
        process.stdout.write("puzzle-fill:drag\n");
        const before = await renderer.data();
        const tileIndex = before.poolTiles[0].tileIndex;
        await renderer.callMethod("fillTouchStart", {
          currentTarget: {
            dataset: { source: "pool", slot: -1, tile: tileIndex },
          },
          touches: [start],
        });
        await renderer.callMethod("fillTouchMove", { touches: [end] });
        await renderer.callMethod("fillTouchEnd", { changedTouches: [end] });
        await sleep(180);
        process.stdout.write("puzzle-fill:assert\n");
        const after = await renderer.data();
        if (after.slots[0] == null) {
          throw new Error("匹配模式拖拽到空网格后没有放置碎片");
        }
      },
    },
    {
      card: syntheticCards[1],
      file: "08-matching-connected.png",
      prepare: async (renderer) => {
        await renderer.callMethod("nodeTap", {
          currentTarget: { dataset: { side: "left", id: "l1" } },
        });
        await renderer.callMethod("nodeTap", {
          currentTarget: { dataset: { side: "right", id: "r1" } },
        });
      },
    },
    {
      card: syntheticCards[2],
      file: "09-classification-assigned.png",
      prepare: async (renderer) => {
        await renderer.setData({ selectedItemId: "apple" });
        await renderer.callMethod("bucketTap", {
          currentTarget: { dataset: { bucketId: "fruit" } },
        });
      },
    },
  ];

  const wsEndpoint = process.env.QCARD_AUTOMATOR_WS;
  const requestedTypes = new Set(
    String(process.env.QCARD_AUDIT_TYPES || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const requestedFiles = new Set(
    String(process.env.QCARD_AUDIT_FILES || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const selectedDefinitions = definitions.filter((definition) =>
    (!requestedTypes.size || requestedTypes.has(definition.card.type)) &&
    (!requestedFiles.size || requestedFiles.has(definition.file)),
  );
  const miniProgram = wsEndpoint
    ? await automator.connect({ wsEndpoint })
    : await automator.launch({
        cliPath,
        projectPath,
        trustProject: true,
      });
  const screenshots = [];
  try {
    // Wait for the app launch/auth redirect to settle before opening a subpackage page.
    await sleep(2500);
    for (const definition of selectedDefinitions) {
      screenshots.push(await render(miniProgram, definition));
    }
  } finally {
    if (wsEndpoint) miniProgram.disconnect();
    else await miniProgram.close();
  }
  process.stdout.write(`${screenshots.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
