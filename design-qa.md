# H5 / Client Alignment Design QA

## Source of visual truth

- H5 login:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/Login/index.tsx`
- H5 home recent learning:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/QCardPack/CardPackStudyItem.tsx`
- H5 level detail:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/LevelDetail/index.tsx`
- H5 coin history:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/CoinHistoryDrawer/index.tsx`
- H5 resource knowledge points:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/Resource/components/ResourceKnowledgeContent.tsx`
- H5 resource card packs:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/QCardPack/CardPackGoodItem.tsx`
- H5 story card:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/QCard/StoryCard`
- H5 listening card:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/QCard/ListeningComprehensionCard`
- H5 sound-object, silhouette, puzzle, and literacy cards:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/QCard`
- Literacy preview reference:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-cb0f56a6-8a86-48ed-bde3-ab00b31940e5.png`
- Literacy full reference:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-7c81d4db-2e59-4985-a232-54394de928c3.png`
- Level reference screenshot:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-1cb8cec1-5610-450d-bf4b-3389edc5c79b.png`
- Coin drawer reference screenshot:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-afeab9bc-8eab-4797-8a3a-9337986b5bfa.png`

## Target coverage

- Viewports: 375, 390, and 430 logical pixels.
- Platforms: iOS and Android WeChat.
- States: login agreement selected/unselected, recent-login phone/WeChat,
  empty/non-empty home, level history/benefits, all coin filters,
  expanded/collapsed knowledge points, locked/unlocked/VIP card packs.

## Implemented alignment

- Navigation controls now live in the measured native navigation row. The row uses
  `getMenuButtonBoundingClientRect()` and is no longer enlarged by status-bar padding.
- Login uses six-digit validation, canonical recent-login persistence, Client-style
  recent-login tags, a custom H5-shaped agreement checkbox, agreement-disabled
  treatment, and the Client agreement confirmation path.
- Home recent learning uses the H5 one-column layout: 64 x 80 cover, subject and
  knowledge-point line, card count, relative time, and circular progress action.
  The empty state is intentionally taller.
- Level detail follows the supplied visual: blue background, floating avatar, EXP and
  coin chips, progress bar, current/next reward blocks, segmented tabs, history list,
  and level-benefit cards.
- Coin history is a native 85vh bottom drawer with user balance header, recharge
  action, horizontal filters, paginated records, linked card-pack context, empty and
  loading states, and safe-area padding.
- Resource knowledge points use the H5 timeline, collapsible groups, and one-column
  CardPackGood layout with marketing tags, author, difficulty, price, VIP/unlocked
  state, relative study time, and circular progress/unlock actions.
- Navigation back controls use one circular 36px visual and hit target across
  immersive pages and the study page.
- Explore template selection uses an in-page glass dropdown with outside-tap close;
  it no longer depends on the system action sheet item limit.
- Story full mode uses the H5 4:3 scene, narrator/left/right dialogue hierarchy,
  focused audio paragraph, and two-row player. Preview follows the H5 role,
  dialogue, story, and fade hierarchy.
- Story preview artwork uses native `widthFix`: it fills the card width and derives
  height from the source image instead of forcing the full-mode 4:3 crop. Full story
  playback intentionally retains the 4:3 `aspectFill` scene.
- Story preview now resolves the source image dimensions before revealing the final
  composition and holds a card-sized skeleton meanwhile, so the role and copy areas
  do not shift after image decode. Preview roles are capped at four circular avatars
  on one adaptive, non-wrapping row with labels hidden; full dialogue copy aligns to
  the top of its avatar instead of the avatar caption baseline.
- Story preview role and dialogue content is no longer gated by the asynchronous
  image-size request. The 4:3 artwork slot reserves its layout immediately, while
  the role row and copy render independently; the first three dialogue excerpts now
  include the speaking role avatar when applicable.
- Listening transcripts are split client-side by paragraph and sentence punctuation;
  answer text is centered in the bubble body excluding the decorative tail.
- Sound-object question and science audio controls expose real playback progress,
  with the science icon fixed above the knowledge panel. The prompt and question
  control use native `cover-view` while the scratch Canvas is visible, preventing
  native-layer occlusion on physical devices. Puzzle media objects are normalized
  to URLs and preview sizing is card-relative.
- Literacy preview and full modes use the H5 overlapping content sheet, inline
  character board, action pills, meaning card, phrase bubbles, and alternating
  conversation bottom sheet. The conversation sheet now preserves character/pinyin
  alignment, highlights the target character, plays per-line audio, and animates
  both entry and dismissal.
- Literacy preview now matches the supplied proportions: a 5:3 illustration area,
  a 52%-width overlapping Tianzi board, two 39%-width phrase bubbles at roughly 82%
  of card height, and per-character pinyin alignment. Full mode uses the same green
  stroke, outline, drawing, and completion colors as Client/H5. The physical Canvas
  run loaded `山`, completed its stroke animation, accepted all three real touch
  strokes in Hanzi Writer quiz mode, and emitted completion with zero mistakes.
- Literacy preview no longer applies a fixed 130px minimum to the Tianzi board. The
  board and glyph now scale from the measured card width, so narrow Today Challenge
  cards cannot push the phrase row out of the 9:16 shell. Full mode keeps the shell
  fixed while moving its internal character/meaning/phrase composition upward.
- Literacy action pills now share the character-board baseline, preserve horizontal
  labels at narrow widths, and reduce icon/padding dimensions in compact cards.
  Stroke animation requests are queued until Hanzi Writer is ready instead of
  entering a false active state. Trace input accepts native Canvas `x/y`,
  `clientX/clientY`, and `pageX/pageY` coordinates and uses the H5 40px quiz stroke.
- The conversation sheet allows the floating header illustration to overflow above
  the sheet without clipping. Both lower role images are explicitly clipped to
  circular 42px avatar frames.
- Hanzi Writer 3.7.3's remaining direct browser `performance.now()` calls are
  rewritten to its existing safe `performanceNow()` clock during vendoring. This
  fixes the iOS AppService Promise failure that previously stopped stroke animation
  and interrupted trace scoring/fill until the next reset-driven redraw.
- Every live card renderer now measures both available width and height and fits a
  centered 9:16 rectangle. Study, AI carousel/grid/dialog, card-pack grids, private
  card grids, and generated-card grids no longer opt into height-filling `auto`
  aspect behavior.
- Card flipping no longer leaves native Canvas content mounted beyond 90 degrees.
  It collapses the current real face, swaps to the actual opposite component, then
  expands it. A distinct Literacy front and Recognition back were verified in both
  directions; the inactive face was absent from WXML during each settled state.
- Recognition preview/full modes now follow H5's full-bleed image composition with
  the subject title anchored at 6%, an in-card jingle subtitle panel, and bottom
  action controls. Main-image audio accepts `soundAudio` with legacy jingle fallback,
  and action video data accepts both H5 `url/name` and Client `video/title` fields.
- Choice cards cap the rendered and accepted option set at four, show correct/error
  status icons, and retain H5 timing for wrong reset and answer flip.
- Matching cards show every configured preview connection and support both native
  drag-to-connect and tap-one-side/tap-the-other-side interaction. Completion locks
  the board; progress and reset controls match H5.
- Classification cards support drag and tap assignment, selected-item/bucket-ready
  states, image labels, reset, per-rule checking, automatic rule advance, and final
  completion lock. Rules with more than three unreachable buckets are rejected.
- Puzzle preview renders the actual tile grid. Full mode supports sliding and fill
  modes, tap and drag placement, native outline hints, timer/reset, completion video
  failure handling, and H5-aligned replay. Puzzle pieces and their board/pool surfaces
  use deeper dark glass so image edges remain legible over a similar background.
- Puzzle preview/full tile rendering now uses clipped native `<image>` elements
  instead of dynamic CSS `background-image` declarations. Read-only is no longer
  treated as preview mode, so full/detail pages retain the complete board, controls,
  timer, pool, outline and completion structure while interaction remains locked.
- Production puzzle faces omit `level`, matching the current H5 contract. Validation
  now accepts that payload and normalizes it to H5's defaults: a one-piece preview
  and a 3 x 3 full game. The full intro presents the complete object before splitting;
  its mode selector, timer, end action, board backdrop, outline hint and piece pool
  follow the H5 state structure. Story preview role visibility is derived from actual
  non-narrator roles, so one or more deployed role avatars cannot be hidden by the
  narrator count.
- Preview radius is owned by the list/grid host. `FlipCardContainer` removes the
  inner shell, face and unsupported-state radius in preview mode, so every preview
  has one continuous outer clipping edge instead of a small host radius surrounding
  a second, larger card radius. Full 9:16 cards keep their native card radius.
- Silhouette science playback now exposes real progress. Listening answers are
  locked while feedback is active, and only the four reachable options are accepted.
- Explore remains a main-package TabBar page and therefore uses server thumbnails,
  as required by the package architecture; real interactive cards load only after
  entering the card subpackage.

## Code-level QA

- Project structure validation: passed.
- Client asset validation: passed, 55 card assets.
- Hanzi Writer vendor validation: passed, version 3.7.3.
- TypeScript: passed.
- Tests: passed, 98 tests in 8 suites.
- H5-alignment regression suite covers navigation anchoring, login states, home study
  list, level structure, coin pagination, and resource collapsible groups.
- Card-interaction regression suite covers all ten card lifecycle contracts plus
  matching/classification dual interactions, Literacy Hanzi/dialogue behavior,
  Puzzle modes and completion controls, and unreachable-option schema guards.

## Card parity matrix

| Card | Preview | Full interaction and state | Code-level result |
| --- | --- | --- | --- |
| Recognition | Full-bleed subject image and overlaid title | language, title/main audio, jingle subtitle, action video | aligned |
| Literacy | illustration, Tianzi grid, phrases | pronunciation, strokes, trace quiz, meaning, phrases, conversation | aligned |
| Puzzle | real N x N tile grid | slide/fill, tap/drag, outline, timer, celebration | aligned |
| Story | scene, roles, excerpts, fade | paragraph seeking, active dialogue, speed, progress | aligned |
| Sound object | blurred image, prompt, audio affordance | question, scratch threshold, science audio, restart | aligned |
| Choice | question and up to four options | wrong reset, answer flip, completion | aligned |
| Silhouette | silhouette image and answers | wrong feedback, reveal, science, reshuffle | aligned |
| Listening | title, mode, question count, play affordance | listen gate, transcript, Q&A, feedback, completion | aligned |
| Matching | all configured answer lines | drag and tap connection, validation, reset, lock | aligned |
| Classification | item pool and buckets | drag and tap assignment, per-rule advance, reset, lock | aligned |

“aligned” in this matrix means source contract, rendered state structure, interaction
branches, reset lifecycle, media coordination, and timing intent were checked against
the current H5/Client implementation. Pixel-level visual sign-off still requires the
official runtime screenshots described below.

## Visual comparison status

The WeChat Developer Tools service port is enabled and authenticated. The post-change
project passes the official `cli preview` compiler with AppID
`wxd9f76b56915a35ce`; the uploaded preview package is 769.5 KB total
(552.5 KB main package, 158.9 KB card package, and 58.1 KB settings package).
There are no application WXML, WXSS, component-resolution, Hanzi Writer module, or
runtime exceptions in the automated run.

The previous official simulator automation completed at 390 x 844 logical pixels. It rendered
all ten card types in preview and full states and exercised the following state
transitions:

- Recognition pronunciation/jingle state and jingle subtitle.
- Literacy trace panel and animated conversation open/close.
- Puzzle fill-mode start, nine correct placements, and completion.
- Sound-object question audio, scratch-ready state, science audio, and reveal.
- Choice and silhouette wrong-reset and correct-complete paths.
- Listening start, wrong-reset, correct answer, and completion.
- Matching all three tap connections and completion lock.
- Classification all assignments, rule completion, and final lock.
- Story playback-rate state.
- AI template carousel/list switch, list preview overlay, form step navigation,
  textarea/slider/radio/switch/number rendering, required-field validation, and
  safe-area bottom-bar geometry.
- Literacy screenshot geometry at 390 px: 370 x 657.77 card shell (exact 9:16),
  191 x 194 Tianzi board after borders, and phrase bubbles aligned to the supplied
  vertical rhythm.
- Flip transition: front component present before collapse, only the distinct back
  component present after the midpoint, and the original front component restored
  after the reverse transition.

Those 390 x 844 layout measurements confirm that the AI bottom bar occupies the final
120 logical pixels including the 34-pixel safe inset, while the scrollable content
ends exactly at its top boundary; it is not hidden by the home indicator.

Release sign-off still requires the remaining same-state physical-device comparisons:

1. Login phone and WeChat recent tags, selected/unselected agreement states.
2. Home empty and recent-learning states.
3. Level history and benefit tabs.
4. Coin drawer all/reward/unlock filters.
5. Resource expanded/collapsed, locked/unlocked/VIP pack states.
6. Navigation controls on iOS and Android devices with different capsule bounds.
7. Story preview/full, listening transcript and answer bubble, sound-object
   preview/full, silhouette preview, puzzle preview/full, and literacy
   preview/full/conversation.

After the story stability, radius and native puzzle-image changes, the complete
`pnpm check` gate passes again (89 tests). A fresh official simulator run at
390 x 844 used the deployed story and puzzle face payloads: all four non-narrator
  story avatars rendered, the puzzle preview rendered its one-piece object, and the
  full puzzle rendered its 3 x 3 intro and active states. Automated taps verified a
  legal sliding move updates the empty slot, and a matching-mode pool piece can be
  selected and placed into an empty board slot.
- Puzzle tile touch listeners now use bubbling native touch events plus an explicit
  tile tap handler. This prevents `catchtouchstart` from swallowing real-device taps
  before the parent slot receives them. Simulator regression exercises the visible
  child tile itself in slide mode and the pool-to-slot tap path in matching mode.
  Outline assistance applies the H5 grayscale/brightness filter at full opacity and
  removes the translucent empty-slot fill, producing a solid black subject outline.
- The puzzle start sequence now follows the H5 timings instead of replacing the
  board in one frame. Sliding mode holds the whole image for 220 ms, splits for
  260 ms, fades the lower-right spare for 800 ms, then performs at least 40 legal
  neighbour moves at 176 ms intervals. Stable tile keys preserve the native
  left/top transition, and only a tile adjacent to the current empty slot can move.
- Matching mode uses the same 220/260 ms introduction, launches shuffled pieces
  every 100 ms, lets each piece fall for 420 ms, and keeps interaction locked until
  the last landing plus the 200 ms pool fade. Pool and board pieces support both
  tap placement and native touch drag/drop; touch coordinates accept client, page,
  and component-local values for real-device compatibility.
- Puzzle completion now follows the H5 state machine instead of replacing the board
  with an immediate modal: sliding mode restores the missing lower-right tile for
  800 ms; both modes then merge seams for 260 ms plus a 220 ms hold, zoom the solved
  board to card width over 500 ms, and crossfade it over 550 ms into a muted
  `object-fit: cover` celebration video occupying the complete 9:16 card. Playback
  begins only after the crossfade. Video end reveals the H5 glass result panel.
  Closing playback or choosing replay fades the video for 380 ms, preserves the
  selected mode and level, resets the board, and repeats the 400 ms board expansion,
  350 ms backdrop reveal, and delayed start-button entrance.
- Developer Tools automation exercised the production puzzle payload through
  `restore -> merge -> zoom -> crossfade -> video-playing -> replay`. It verified
  the missing tile was restored, the board/video opacity handoff reached 0/1, the
  production video entered playing state, and replay returned to an unstarted,
  non-completed board with its start action visible.
- Literacy's inline stroke Canvas is now conditionally unmounted whenever the trace
  overlay or conversation sheet is visible. Opening either surface pauses animation,
  clears the other modal state, and replaces the native Canvas with a same-layout
  static character fallback beneath the blur. Developer Tools automation verified
  conversation has no mounted Hanzi Canvas, trace mounts only `traceWriter`, and
  closing either surface restores only `mainWriter`.
- Recognition preview now renders the complete non-interactive action-button row at
  H5's 36 x 36 size. Full mode keeps the main image visible while an action video
  loads; loading is represented only by a spinner over the selected action button.
  `play`, `canplay`, and actual `timeupdate` progress clear that spinner reliably
  across WeChat runtimes. The video and main image crossfade for 400 ms in both
  directions, and the video remains mounted until its exit fade completes.
  Developer Tools automation verified the production hedgehog card through preview,
  button loading, video playback, exit fade, and restored-background states.

The automated release gate is passing. The remaining gate is physical-device visual
sign-off at 375 and 430 logical-pixel widths on both iOS and Android, including native
Canvas compositing and media interruption behavior.

## Immersive header safe-area regression

- Reference:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-71d47d95-5dd6-475e-9977-ff0bad160e33.png`
- A shared `--immersive-content-safe-top` token now positions hero copy below the
  overlay navigation on Home, Explore, Resource, Profile, My Cards, and My Packs.
  Explore and Resource keep their business selectors in the measured navigation row.
- At the 390px official simulator viewport, the Explore capsule is 33px high at
  y=52.5, while the first title line now starts at y=99. This leaves 13.5px of
  visible separation. The search field remains at y=216.
- Runtime inspection measured the content start at y=99 for Home, Explore, Resource,
  and My Cards; y=109 for Profile after its intentional inner margin; and y=113 for
  My Packs after its intentional title margin.
- Static validation, TypeScript, all 89 tests, production dependency checks, and the
  official WeChat preview compiler pass after this change.
- The Developer Tools automation screenshot endpoint and Computer Use screenshot
  endpoint both timed out after successfully loading the corrected route. Geometry
  and compilation are verified, but this fresh side-by-side screenshot export is not
  represented as passed.

## Sound-object scratch reveal regression

- Reference:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-c8a45c0b-ed83-42d8-af80-81b3d5551d69.png`
- Crossing the 45% scratch threshold no longer depends on CSS opacity for a native
  Canvas. The remaining coating is erased through Canvas compositing over 360ms,
  both scratch/control canvases are then unmounted, and only the view-update callback
  may start the science audio.
- Official simulator runtime inspection confirmed the transition contract:
  during reveal the phase remains `scratching`, coating is mounted, and two canvases
  exist; after reveal the phase is `sciencePlaying`, coating is unmounted, and zero
  canvases exist.
- Restart was also exercised: phase returns to `idle`, coating is visible and
  mounted, and both fresh canvases exist for a new scratch attempt.

## Silhouette science-audio progress regression

- Reference:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-ba5043cb-4f59-4a65-b70e-d83030ffb7e5.png`
- The science-audio glyph no longer receives a playing class or rotation keyframe.
  Playback feedback is limited to the outer conic-gradient ring.
- Simulator inspection at 216° progress confirmed the button class remains
  `mini-audio-button`, the inner class remains `mini-audio-inner`, and the outer
  background is `conic-gradient(#ffffff 216deg, rgba(...))`.

## Shared drawer and private-pack creation regression

- Source visual truth:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/MyLearning/components/CreateCardPackModal.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/MyLearning/hooks/useCardPackManagement.ts`
  - the existing Profile drawer treatment used by the mini-program before this
    regression pass.
- Implementation:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/miniprogram/components/side-drawer-menu`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/miniprogram/components/selection-side-drawer`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/miniprogram/package-cards/pages/my-learning`
- Viewport/state: official WeChat iOS simulator, 390 logical pixels wide,
  authenticated as the existing test user. Explore, Resource, and Profile were
  inspected in their loaded states; My Packs was opened with
  `mode=private&create=true`.
- Runtime evidence:
  - Explore and Resource render the same page-level white selector capsule at
    `{ left: 8, top: 52.5, width: 79, height: 33 }`;
  - both selection drawers are mounted at the page root rather than inside
    `immersive-nav`, preventing the fixed overlay and touch target from being
    clipped by navigation-component pointer handling;
  - real automation `tap()` on each left selector changed the matching page state
    to open and produced the full backdrop, root panel, header, and option list;
  - all drawer instances derive `safeTopPx: 99` from the native capsule and keep
    their drawer header content below it;
  - Profile alone renders wallet, card-pack, card-face, theme, contact, and
    customization entries;
  - Explore renders a “模板分类” drawer with “全部模板” plus the eight server
    templates. Selecting “识字卡” closed the drawer, updated the selected ID/name,
    and refreshed the visible card-face list from 12 to 6 items;
  - Resource renders a “选择年级” drawer with the server grade list and no personal
    entries. The current production account returned one “综合” grade, so a
    multi-grade visual switch could not be exercised with this dataset;
  - Home navigation opened the private My Packs state with
    `createOpen:true`; title and description input events enabled the confirm
    action, and cancel closed the modal without creating server data;
  - all three variants opened and closed correctly and restored the native tab bar.
- Comparison history:
  - P1: Home previously routed “去创建” to AI generation and the private-pack
    creator accepted only a title. It now routes to the private pack list, requires
    the H5 title and description fields, posts both fields, refreshes the private
    list, and opens the created pack.
  - P1: The first drawer pass incorrectly copied Profile's personal menu into
    Explore and Resource. The corrected implementation reuses only the drawer shell
    and slide interaction: Explore contains template categories, Resource contains
    grades, and Profile alone contains personal navigation.
  - P2: Explore's old floating dropdown and Resource's system ActionSheet were
    removed. Their current selection is now shown in a capsule-row trigger, while
    the complete option list and selected state live in the left drawer.
  - P1: The first selector-drawer implementation kept the fixed panel inside the
    navigation component and its automated check called `openMenu()` directly.
    This missed the broken real tap path. The selectors are now ordinary page
    buttons and the drawers are root-level components; real `tap()` was used for
    both pages before this handoff.
  - P1: Profile drawer content could begin under the safe area. Its profile block
    now uses the measured capsule bottom plus a 14px visual gap rather than a fixed
    top value.
- Fidelity surfaces:
  - Typography/copy: the H5 “新增卡包 / 创建一个新的专属卡包 / 卡包标题 /
    卡包描述” hierarchy and required labels are preserved. Selector drawers use
    explicit “模板分类” and “选择年级” business titles.
  - Spacing/layout: the shared trigger and drawer use one implementation; the
    dynamic 99px top inset clears the measured capsule at this viewport.
  - Colors/tokens: existing mini-program forest tokens, primary green, border,
    radius, and elevation semantics are reused.
  - Assets: Profile reuses the authenticated avatar, Resource reuses server grade
    icons, and both selection variants reuse the existing Material Community icon
    font; no placeholder or generated asset was introduced.
  - Content: private-pack creation, management, deletion, and post-create detail
    navigation are present.
- Implementation screenshots:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/qa-artifacts/explore-selection-drawer.png`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/qa-artifacts/resource-grade-drawer.png`
  Both were captured from the official 390 x 844 WeChat simulator immediately
  after a real tap on the matching selector. The panels clear the capsule, contain
  only their business taxonomy, expose the selected state, dim the background, and
  share the same visual shell. A physical-device comparison remains outstanding.

## Private card generation status regression

- Source visual truth:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/CardFaceItem/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/CardFaceListContainer/index.tsx`
- H5's three non-success states are now one native shared component:
  `pending` shows the clock and “正在排队...”; `processing` shows the counter-rotating
  green progress rings, auto-fix glyph, pulse and three delayed dots with
  “正在生成...”; `failed` shows “生成失败... / 已退款” and exposes retry only when the
  current surface can recreate the source template.
- The shared status card is used by every current private-face list: Home recent
  generations, Profile recent/feedback lists, My Cards, and the AI template
  selection/result list. Successful faces continue through the normal preview
  renderer; non-successful faces never render a broken thumbnail or unsupported-card
  message.
- All four surfaces poll pending/processing jobs every 3000 ms, stop polling when
  hidden or unloaded, and the two generation routes refresh immediately when
  returning from a generation flow so newly submitted jobs appear without a manual
  reload.
- Implementation screenshot:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/card-interaction-2026-07-28/private-card-status-grid.png`
  (official WeChat simulator, 390 x 844 logical viewport; exported at 554 x 1200).
  The processing state was opened and visually inspected inside the clipped private
  card grid. The H5 runtime route redirected to login in the available browser
  session, so the source-side screenshot comparison is recorded as blocked; the
  source component structure, exact copy, state coverage, animation timings, and
  3-second polling contract were compared directly in code.
- `pnpm check` and `pnpm release:check` pass with 98 tests in 8 suites, 22 pages,
  41 WXML files, 55 Client card assets, Hanzi Writer 3.7.3, TypeScript validation,
  and production endpoint/asset checks.

## Login recent-method badge clipping regression

- Reference:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-cecd1448-c0a1-4e09-9540-bdc2466d0c0e.png`
- Root cause: the WeChat “最近登录” badge was absolutely positioned above a
  native `<button>`. The native button clips children outside its own bounds on
  physical WeChat runtimes, leaving only the lower portion of the badge visible.
- The badge now sits as a sibling of the native button inside a dedicated
  `wechat-login-option` positioning wrapper. The wrapper owns the 92rpx footprint
  and explicitly permits overflow; the badge remains centered at `top:-16rpx`,
  has its own z-index, and does not intercept the login tap target.
- A regression assertion requires the badge to remain outside the button and the
  wrapper to preserve visible overflow.
- `pnpm check` and `pnpm release:check` pass with 98 tests. The available WeChat
  Developer Tools and standalone mini-program windows both timed out through the
  desktop screenshot interface, so a fresh same-state implementation screenshot
  could not be exported in this pass.

## Generation placeholder metadata regression

- Reference:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-93d28243-8399-4720-8832-77f704ef40ef.png`
- Pending, processing, and failed generation placeholders no longer render the
  private face name, card type, feedback metadata, or “做同款” footer. The complete
  visible item is now the 9:16 status card; metadata is rendered only after the
  server reports `success`.
- The rule is applied to all current private-face consumers: My Cards, AI face
  selection, Home recent generation, and Profile recent/feedback lists.
- Grid and horizontal-list containers now opt out of cross-axis stretching. A
  loading card beside a taller successful card therefore remains exactly 9:16
  instead of acquiring a blank footer-height region.
- Regression assertions cover both the success-only metadata guards and the
  non-stretching layout contract. `pnpm check` and `pnpm release:check` pass with
  98 tests.
- A new simulator screenshot could not be exported through the currently timing-out
  WeChat desktop inspection surface, so the fresh visual comparison remains part of
  physical-device sign-off.

## Home and My Cards shared two-column preview regression

- Source visual truth:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/CardFaceItem/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/CardFaceListContainer/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/Home/index.tsx`
  - the mini-program Explore `face-card` visual contract.
- Home “最近生成” and My Cards now render the same native
  `private-card-face-item`. Both use a two-column grid, 22rpx gap, matching 32rpx
  horizontal content inset, 9:16 card surface, 18rpx outer clipping radius, one
  border/elevation treatment, and the Explore/H5 in-card “做同款” gradient action.
- The shared item renders no external title, card type, or metadata footer.
  Pending/processing/failed state remains a complete 9:16 status card; edit-mode
  deletion is the only management overlay and is unavailable while a job is active.
- Runtime screenshots, official WeChat simulator, 390 x 844 logical viewport
  (exported at 554 x 1200):
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/private-face-grid-2026-07-28/home-recent-faces-scrolled.png`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/private-face-grid-2026-07-28/my-card-faces.png`
- Both screenshots were opened and compared. The deployed “春” face has the same
  card width, 9:16 frame, crop, radius, shadow, internal content scale, and bottom
  make-similar treatment on both pages. Home currently returns one recent face, so
  the second grid column is empty; My Cards shows the same face beside the 9:16
  create tile.
- `pnpm check` and `pnpm release:check` pass with 98 tests, including shared
  component registration, two-column layout, no-external-metadata, interaction, and
  FlipCardContainer validation.

## Profile recent generation shared-preview regression

- Profile “最近生成” now uses the same native `private-card-face-item` as Home and
  My Cards. Its panel uses the same 32rpx horizontal inset, two-column grid, 22rpx
  gap, 9:16 surface, 18rpx clipping radius, and in-card “做同款” action.
- The former external card name and standalone make-similar button were removed.
  Pending/processing/failed items continue to use the complete shared status card.
- Profile’s “卡面反馈” tab intentionally retains its feedback name/status metadata
  and remains on its independent feedback-list structure.
- Runtime screenshot:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/private-face-grid-2026-07-29/profile-recent-faces.png`
  (official WeChat simulator, 390 x 844 logical viewport; exported at 554 x 1200).
  The deployed “春” face matches the previously captured Home and My Cards width,
  crop, 9:16 ratio, radius, shadow, and bottom in-card action. The account currently
  has one recent face, leaving the second grid column empty as expected.
- `pnpm check` and `pnpm release:check` pass with 98 tests.

## Profile avatar picker square-image regression

- Source visual truth:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/Profile/ProfileEdit.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-Client/src/features/home/components/AvatarPickerSheet.tsx`
- Root cause: the drawer placed `aspect-ratio:1` directly on the mini-program
  native `<image>`. In the three-column native button grid, the runtime retained
  the portrait asset's intrinsic ratio and rendered tall rectangular candidates.
- Every candidate now uses a dedicated CSS square wrapper based on the
  percentage-padding technique. The native image absolutely fills that wrapper
  with `mode="aspectFill"`, so the crop stays square without depending on native
  image aspect-ratio resolution. Selection state, label, and tap behavior are
  unchanged.
- Runtime comparison, official WeChat simulator:
  - before:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/profile-edit-2026-07-29/avatar-picker-before.png`
  - after:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/profile-edit-2026-07-29/avatar-picker-square.png`
- The after screenshot was opened and verified: all three columns render
  equal-width/equal-height avatar images, portrait source assets are center-cropped,
  and the selected border remains aligned.
- `pnpm check` and `pnpm release:check` pass with 98 tests.

## Native-capsule second-row navigation and card-pack intro regression

- Visual navigation reference:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-b9812757-10fb-48fd-80b7-d56f94b593a2.png`.
- Card-pack intro source of truth:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/CardPackDetail/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/PrivateCardPackDetail/components/PrivateIntroPanel.tsx`
- The former navigation row reused the native capsule's vertical band. A shared
  runtime metric now anchors all application-owned leading, center, and action
  controls eight logical pixels below `getMenuButtonBoundingClientRect().bottom`.
  Non-overlay pages receive the exact resulting spacer; overlay hero copy uses
  the matching global safe top. The custom Study header and AI carousel layout
  use the same metric instead of independent status-bar arithmetic.
- Public and private card-pack detail hero heights preserve the H5 cover overlap
  while clearing the new navigation row. The public intro now matches the H5
  content contract: unlocked 0% progress remains visible, completed-card and
  accumulated-time metadata are included, highlight colors/icons are honored,
  H5 font/spacing/radius values are mapped to rpx, and author title/rating are
  rendered when supplied by the API. Private intro uses the same spacing scale.
- Verified in the official WeChat simulator at a 390 x 844 logical viewport:
  - Resource header:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-pack-detail-2026-07-29/after-resource-header.png`
  - Public card-pack top and intro:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-pack-detail-2026-07-29/final-pack-detail-top.png`
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-pack-detail-2026-07-29/after-pack-detail-intro.png`
  - Standard non-overlay navigation:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-pack-detail-2026-07-29/final-standard-nav.png`
  - Custom Study header:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-pack-detail-2026-07-29/final-study-header.png`
- The reference and implementation screenshots were opened and compared. The
  native capsule has its own row, both application controls occupy the complete
  following row, hero copy clears the controls, and detail title/cover no longer
  intersect. No P0/P1/P2 visual issue remains in the captured states.
- `pnpm check` and `pnpm release:check` pass with 99 tests. Direct H5 visual
  capture in the Product Design in-app browser was redirected to login, so H5
  intro fidelity was verified against the exact production component source and
  the rendered mini-program state; physical-device sign-off remains outstanding.

## Native-capsule inline navigation and scroll material regression

- This iteration supersedes the preceding second-row navigation layout. All
  application-owned controls now share WeChat's native capsule row and form one
  compact left-aligned group; the complete native capsule hit area remains reserved
  on the right. Back, selector, segmented, favorite, and other page-specific actions
  use the same 72rpx frosted control language and pressed feedback.
- `getImmersiveNavigationMetrics()` derives the status bar, native capsule row,
  left-group width, and right-side reserved width from runtime window and capsule
  geometry. The shared immersive navigation component, the custom Study header,
  and hero safe-area spacing all consume this single metric.
- Ten hero/list surfaces feed page scroll into the shared component through a
  bounded four-pixel quantizer. At scroll top the navigation material is fully
  transparent; across the first 96 logical pixels it progressively gains white
  opacity, blur, elevation, and a dark high-contrast title. Standard form/settings
  pages intentionally remain solid for readability.
- Verified in the official WeChat simulator at a 390 x 844 logical viewport
  (exported at 554 x 1200):
  - Resource top:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-scroll-2026-07-30/resource-top.png`
  - Resource intermediate material:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-scroll-2026-07-30/resource-mid.png`
  - Resource opaque state:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-scroll-2026-07-30/resource-scrolled.png`
  - Card-pack top and scrolled state:
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-scroll-2026-07-30/pack-top.png`
    `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/.audit/nav-scroll-2026-07-30/pack-scrolled.png`
- The card-pack scrolled capture exposed insufficient title contrast from the
  former white title. The final component delays title reveal until the material
  is established and forces the revealed title to `#172019`; a source-contract
  regression assertion covers both the reveal threshold and color binding.
- `pnpm check` and `pnpm release:check` pass with 99 tests: 22 pages, 42 WXML
  files, 55 Client assets, Hanzi Writer 3.7.3, TypeScript, online API, dynamic Hanzi
  JSON, and agreement endpoints all pass.

## Unified capsule control and H5 favorite-pack regression

- Every application-owned control in the native capsule row now consumes the
  shared 72rpx height token. Back, drawer, selector, segmented, balance, settings,
  favorite, group-card, save, AI view-mode, and Study controls share a refined
  translucent gradient, hairline highlight, inset highlight, soft elevation,
  18rpx blur, and consistent pressed scale. The Resource and My Packs segmented
  controls retain a 60rpx inner selection surface inside the same 72rpx shell.
- H5 source of truth:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/Profile/FavoritedPanel.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/QCardPack/CardPackGoodItem.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/QCardPack/CardPackStudyItem.tsx`
- Profile favorites no longer use the generic square-thumbnail/description/chevron
  row. Locked packs now render the H5 marketing badge, cover count overlay,
  difficulty, author, price/original-price, and unlock affordance. Studyable packs
  render subject and knowledge-point hierarchy, card count, last-study/VIP state,
  and the H5-style conic progress action. The complete row still opens details;
  the action opens details for unlock or starts Study directly when available.
- Runtime visual inspection used the authenticated official WeChat simulator at
  390 x 844 logical pixels. Home level/balance, Profile menu/settings, Resource
  grade/mode controls were checked at the same native capsule row; the current
  account's unlocked “海洋动物” favorite rendered cover, taxonomy, 35-card count,
  last-study date, and progress entry without clipping or overlap.
- `pnpm check` and `pnpm release:check` pass with 100 tests.

## Card-pack navigation icon optical-centering regression

- The shared back button and card-pack favorite button now wrap their icon-font
  glyph in an explicit full-size flex centering layer instead of relying on native
  button text line-height. The chevron receives a 1rpx positive X correction for
  its asymmetric glyph bounds; the heart remains geometrically centered.
- Verified in the official WeChat simulator on the card-pack detail top hero and
  the opaque scrolled navigation state. Both glyphs remain centered in the shared
  72rpx circular surface.

## Recognition language switch and Study header centering regression

- Source visual truth:
  - `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-449893cf-f2d4-48d3-a6eb-7be5c864fb56.png`
    identifies the previous incorrect dropdown treatment.
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/QCard/LangSwitchButton/index.tsx`
    and `index.module.less` define the required two-layer current/next language
    control and cyclic switch behavior.
  - `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-2385aecf-880e-49db-83d5-bf5fd521eb1d.png`
    is the Study-header alignment target.
- Implementation evidence:
  - `qa-artifacts/latest/recognition-language-zh.jpeg`
  - `qa-artifacts/latest/recognition-language-en-full.jpeg`
  - `qa-artifacts/latest/study-header-centered.jpeg`
  - official WeChat simulator, iPhone 12/13 Pro preset, 390 x 844 logical
    viewport at 71% desktop display scale; captures are 250 x 105 and 250 x 90
    focused crops from an 1184 x 768 desktop screenshot.
- State and interaction: first ocean-animal card, Chinese current/English next;
  tapping the language control changed the first mounted card to English and
  updated its accessible state to “当前En，下一项中”. The adjacent preloaded card
  correctly retained its own Chinese state. No dropdown layer remained.
- Full-view comparison: the Study pack cover/title/progress group is positioned
  on the viewport center line and remains independent of the back button and
  native capsule widths. The card frame and persistent controls remained
  unclipped.
- Focused-region comparison:
  - Typography and copy: H5 labels `中` and `En`, bold compact box text, pack
    title, count, and progress copy are preserved.
  - Spacing/layout: the 44px language control uses the H5 60% overlapping boxes,
    2px top/left inset, and 12px card offset; Study uses an absolute 50% anchor
    with translate correction.
  - Colors/tokens: current language uses H5 primary `#529917` on white; next
    language uses `#f6f6f6` and `#5d5d5d`.
  - Image quality/assets: no raster asset changes; existing card and pack images
    retain their source crop and density.
  - Interaction: cyclic switching, pressed feedback, 300ms scale transition,
    audio/video reset on language change, and read-only/preview guards pass.
- Comparison history: P1 dropdown-vs-cycle behavior and P2 flex-area header
  offset were fixed. The post-fix WeChat capture shows the H5 two-box control and
  viewport-centered header with no remaining P0/P1/P2 finding in these two
  focused regions.

## H5 card-pack unlock drawer and entry-flow regression

- H5 source of truth:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/components/UnlockConfirmDrawer/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/CardPackDetail/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/Resource/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/Profile/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/TeacherDetail/index.tsx`
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-H5/src/pages/Study/index.tsx`
- The native `unlock-confirm-drawer` is now the single unlock confirmation
  surface for card-pack detail, locked Study cards, Resource pack actions,
  Profile favorite-pack actions, and teacher pack actions. The prior teacher
  `wx.showModal` confirmation and detail-only fallbacks were removed.
- UI/state parity includes the H5 handle, title/subtitle branch, account balance,
  cover/title/difficulty/author/card count, original price, activity and
  level-discount rows, final/free price, insufficient-balance shortage, cancel,
  confirm, recharge guide, loading lock, irreversible warning, backdrop close,
  enter/exit animation, and bottom safe-area padding.
- Logic parity includes VIP-free access gating, VIP cross-account guidance,
  balance affordability, free claims, duplicate-submit prevention, server
  `success` verification, user/profile refresh, catalogue refresh, and Study
  access recalculation. VIP-free packs are only studyable when the current
  profile actually has VIP; card-pack detail card clicks and its persistent
  action use the same computed `canStudy` state.
- Native-tab pages hide the WeChat tab bar while the drawer is open and restore
  it on cancel, recharge routing, success, hide, or unload, avoiding a native
  layer appearing above the drawer.
- Runtime evidence:
  - `qa-artifacts/latest/unlock-confirm-drawer.jpeg`
  - `qa-artifacts/latest/resource-unlock-drawer.jpeg`
  - official WeChat simulator, authenticated account, iPhone 12/13 Pro preset,
    390 x 844 logical viewport.
  - A locked “农场动物” pack showed a 24-card summary, 24 咔豆 original price,
    5% level discount, 23 咔豆 final price, and 140 咔豆 balance. The cancel
    interaction removed the drawer and the pack remained locked.
  - The same pack's Resource-row lock action opened the drawer without routing
    to detail; the native tab bar was absent while open, restored after cancel,
    and the pack remained locked.
- Source regression coverage asserts the shared drawer at all five public
  unlock contexts, safe-area treatment, VIP branch, no legacy teacher unlock
  modal, native-tab layering, and API success guards.

## VIP entitlement consumption, external purchase guide, and group-card spacing

- Entitlement source of truth remains server-owned:
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-Server/src/modules/subscriptions/vip.service.ts`
    derives active VIP from `vipExpireAt`, caches it for five minutes, and exposes
    explicit cache invalidation used by subscription/order state changes.
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-Server/src/modules/client/user-private-card-packs/features/ai-generation/services/ai-card-generation.service.ts`
    enforces `vipRequired` again when the generation request is submitted.
  - `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-Server/src/modules/card-packs/features/unlocks/services/unlocks.service.ts`
    consumes VIP status for card-pack access.
- Mini-program profile snapshots now refresh after returning to Resource,
  card-pack detail, teacher detail, Study, and AI generation. VIP-free pack
  access and VIP-only template access therefore update without a new login;
  backend authorization remains authoritative.
- Recharge and subscription prompts now share the native
  `app-purchase-guide`. It provides a first-party `/app.html#download` WebView
  route and a WeChat-native `open-type="contact"` support action. Home wallet,
  Profile recharge/VIP, card-pack unlock, Resource, Study, teacher, and AI
  generation all use the same guide.
- Runtime evidence:
  - `qa-artifacts/latest/vip-app-contact-guide.jpeg`
  - authenticated non-VIP account, official WeChat simulator, iPhone 12/13 Pro,
    390 x 844 logical viewport.
  - The guide exposed “下载叩咔 AI App” and “联系客服”, hid the native tab bar while
    open, restored it on close, and stated cross-client VIP/咔豆/data sync.
- Group-card spacing reference and comparison:
  - source:
    `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-e7cc3295-eb2a-4ff2-b05b-f460ac715dea.png`
  - implementation:
    `qa-artifacts/latest/group-card-spacing-device.jpeg`
  - side-by-side:
    `qa-artifacts/latest/group-card-spacing-comparison.png`
  - the hero bottom reserve increased from 54rpx to 86rpx, creating a deliberate
    32rpx logical separation between the pack-selector row and the search surface
    without changing the card stage, native navigation, or search geometry.
  - the incorrect label “选择存属卡包” was corrected to “选择归属卡包”.
- No remaining P0/P1/P2 issue was found in the two focused runtime states.

historical result: blocked by required iOS/Android physical-device comparison

## Resource preview card-pack thumbnail pass — 2026-08-04

### Evidence

- Source visual truth:
  `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-0fbe21a1-6652-4182-88ac-aca556757bc9.png`
- Implementation screenshot:
  `/Users/one/Desktop/work/kolka/kaka-app/client-server/QCard-MiniProgram/qa-artifacts/latest/resource-preview-card-pack-thumbnails-devtools.png`
- Source pixels: 312 x 632, cropped H5 card-grid item.
- Implementation pixels: 1200 x 768, WeChat Developer Tools capture containing
  an iPhone 12/13 Pro simulator at 390 x 844 logical pixels and 70% canvas scale.
- State: Resource tab, Preview mode, populated two-column card grid.
- Density normalization: the source is a focused component crop while the
  implementation is a full Developer Tools capture, so comparison uses the
  repeated card/thumbnail regions at their logical 9:16 proportions rather than
  raw desktop-canvas pixels.

### Full-view comparison

- The Mini Program preserves the responsive Resource grid and now repeats the
  H5 card-plus-card-pack-summary composition below every 9:16 card.
- The replacement does not change the page header, search, tabs, loading flow,
  TabBar, or card-preview interaction.

### Focused-region comparison

- Fonts and typography: the card-pack title is the only primary line; subject
  and knowledge point use a smaller secondary line. Card names are no longer
  rendered under previews.
- Spacing and layout rhythm: the card and compact summary are separate rounded
  surfaces with a short gap, matching the H5 bottom-bar hierarchy.
- Colors and visual tokens: the white summary surface, green unlocked state,
  blue taxonomy metadata, restrained border, and light elevation follow H5.
- Image quality and asset fidelity: the real server-provided card-pack cover is
  rendered with `aspectFill`; no placeholder or reconstructed artwork replaces it.
- Copy and content: summary content is card-pack title, subject, knowledge point,
  and unlocked/price state. The prior card-name/card-pack-name block is gone.
- Interaction: tapping the card still opens card preview; tapping the compact
  card-pack summary stops propagation and opens card-pack detail.

### Comparison history

- Earlier P1: Preview grid displayed card name and card-pack title as plain text,
  which did not communicate the source card pack and diverged from H5.
- Fix: replaced the plain copy block with a cover-led card-pack thumbnail summary,
  added unlocked/price state, and separated the card and summary surfaces.
- Post-fix evidence: the implementation screenshot shows real cover thumbnails,
  card-pack titles, taxonomy metadata, and the green unlocked icon beneath the
  preview cards. No actionable P0/P1/P2 mismatch remains in this focused state.

### Follow-up polish

- P3: verify the smallest Android font renderer does not clip long knowledge-point
  names; current truncation protects the grid width.

## Dark-mode contrast and portal drawer pass — 2026-08-11

### Evidence and comparison

- User references:
  - `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-3206b293-a08e-4ca2-b867-9b9843fe498a.png`
  - `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-9e446818-03d9-44e0-9058-eb575e6315dc.png`
  - `/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-0b578f7c-e424-4ffc-b0b9-cbeb8f770961.png`
- Runtime target: authenticated dark-mode home, coin drawer, and profile side drawer
  in the official WeChat Developer Tools iPhone simulator.
- Home media copy now keeps both “欢迎回来” and the user name on an inverse
  foreground. The user name remains a transparent text layer without a pill or
  background; a multi-directional dark outline and long-name truncation keep it
  readable across both bright foam and dark water regions of the ocean artwork.
- The yellow purchase action now uses a semantic warning foreground for both icon
  and label, preserving contrast in light and dark appearances.
- The profile drawer is mounted through `root-portal` and owns an explicit opaque
  panel surface. Since WeChat detaches portal content from page custom properties,
  its compact light/dark token contract is declared on the portaled root itself.
- Post-fix simulator inspection shows one solid `#141821` drawer panel, a separate
  dimmed backdrop, legible profile/VIP/menu copy, and no duplicated page content
  bleeding through the drawer.

### Regression coverage

- The dark-mode suite asserts inverse media copy, semantic warning-action
  foregrounds, portal mounting, and an explicit dark elevated drawer surface.
- TypeScript, the complete Vitest suite, and whitespace validation are required for
  this pass.

final result: passed
