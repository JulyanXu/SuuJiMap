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

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). **Open** a local file or **Sample**. The first sheet is drawn from its `structureClass` (map, logic, org chart, tree). Select a topic to edit markers, labels, notes, and links. **Outliner** is the same tree. **Save** writes `.xmind`. Markdown, OPML, and PNG export from the toolbar.

Enter adds a sibling, Tab a child, Delete removes the selection, Shift+Enter breaks a line in the title, and Ctrl/Cmd+Z undoes. Ctrl/Cmd plus and minus zoom.

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

`npm test` runs the core suite, the consumer build, editor unit tests (layouts, fold, markers, Markdown), the production bundle, and Playwright (rename, fold, structure, marker round-trip, outliner, PNG).
