# xmind-workbook

A browser mind map for `.xmind` files. The core library reads and writes the ZIP workbook. The web app is one consumer of that library.

```
packages/xmind-workbook   core (bytes in, bytes out)
apps/web                   Vite app
examples/consumer          a second project that imports the package
```

## Run the web app

```sh
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). **Open** a local file or **Sample**. Sheet tabs switch sheets, and **Add sheet** appends one. The active sheet is drawn from its `structureClass`: balanced and unbalanced maps, clockwise and anticlockwise maps, logic, org chart, and tree. Select a topic to edit markers, labels, notes, and links. Labels are drawn on the topic chip, not only in the side panel. The marker picker writes open marker ids (priority, task, flag, star, and the rest of that catalog); an unknown id still round-trips and shows a generic tag. **Important**, **Minor**, and **Expired** copy those theme roles onto the topic. **Floating** inserts a detached topic with a position. **Outliner** is the same tree, plus floating topics. **Save** writes `.xmind`. Markdown, OPML, PNG, SVG, and PDF export from the toolbar.

Enter adds a sibling, Tab a child, Ctrl/Cmd+Enter inserts a parent, Delete removes the selection, Shift+Enter breaks a line in the title, and Ctrl/Cmd+Z undoes. Ctrl/Cmd plus and minus zoom.

Imported themes are drawn from the measured role properties (shape fill, branch `multi-line-colors`, line class, font size). `color-list` is kept and not used for branch color. A boundary with a solid `svg:fill` paints that fill behind the topics; inherited boundary text is not treated as that fill. Topic chips with no shape fill use the canvas color so the title stays readable on a dark boundary. Relationship control points stay in the file. The curve on the map is a midpoint stand-in, because that coordinate space was not measured. `NeverMind` is rendered as Inter. A sheet with no theme is saved with an original theme that names Inter and Noto Sans SC. That original theme does not claim `skeletonThemeId` or `colorThemeId`. An imported theme, including its font name and those ids when present, is left as it was.

## Import the core

```ts
import { readXMind, writeXMind } from "xmind-workbook";

const book = readXMind(bytes);
book.sheets[0].rootTopic.title = "Launch";
const out = writeXMind(book);
```

Node path helpers stay on a separate entry:

```ts
import { readXMindFile, writeXMindFile } from "xmind-workbook/node";
```

## Tests

```sh
npx playwright install chromium
npm test
```

`npm test` runs the core suite, the consumer build, editor unit tests (layouts including clockwise, fold, markers, theme roles, SVG, PDF, Markdown), the production bundle, and Playwright (rename, fold, structure, marker round-trip, outliner, theme colors, SVG, PDF, parent, floating, sheets, PNG). Web unit tests are typechecked to JavaScript before `node --test`, so the suite runs on Node 20 and newer.
