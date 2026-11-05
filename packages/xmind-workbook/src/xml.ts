export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  text: string;
}

function localName(name: string): string {
  const colon = name.indexOf(":");
  return colon === -1 ? name : name.slice(colon + 1);
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (all, body: string) => {
    switch (body) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default: {
        const code = body.startsWith("#x")
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : all;
      }
    }
  });
}

/**
 * Small XML reader for legacy XMind content.xml. Enough for the measured
 * element set (sheets, topics, notes, markers, labels, relationships).
 */
export function parseXml(xml: string): XmlElement {
  let i = 0;
  if (xml.charCodeAt(0) === 0xfeff) i = 1;

  function skipProlog(): void {
    while (i < xml.length) {
      if (xml.startsWith("<?", i)) {
        const end = xml.indexOf("?>", i);
        if (end < 0) throw new Error("unterminated processing instruction");
        i = end + 2;
        continue;
      }
      if (xml.startsWith("<!--", i)) {
        const end = xml.indexOf("-->", i);
        if (end < 0) throw new Error("unterminated comment");
        i = end + 3;
        continue;
      }
      if (xml.startsWith("<!", i)) {
        const end = xml.indexOf(">", i);
        if (end < 0) throw new Error("unterminated declaration");
        i = end + 1;
        continue;
      }
      const ch = xml[i];
      if (ch !== undefined && /\s/.test(ch)) {
        i += 1;
        continue;
      }
      break;
    }
  }

  function parseElement(): XmlElement {
    if (xml[i] !== "<") throw new Error("expected element");
    i += 1;
    const nameStart = i;
    while (i < xml.length && !/[\s/>]/.test(xml[i] ?? "")) i += 1;
    const rawName = xml.slice(nameStart, i);
    if (!rawName || rawName.startsWith("/") || rawName.startsWith("!")) {
      throw new Error(`unexpected tag <${rawName}>`);
    }
    const attrs: Record<string, string> = {};
    while (i < xml.length) {
      while (i < xml.length && /\s/.test(xml[i] ?? "")) i += 1;
      if (i >= xml.length) throw new Error(`unterminated <${rawName}>`);
      if (xml[i] === ">" || xml[i] === "/") break;
      const attrStart = i;
      while (i < xml.length && !/[\s=/>]/.test(xml[i] ?? "")) i += 1;
      const attrName = xml.slice(attrStart, i);
      while (i < xml.length && /\s/.test(xml[i] ?? "")) i += 1;
      if (xml[i] !== "=") throw new Error(`expected = after ${attrName}`);
      i += 1;
      while (i < xml.length && /\s/.test(xml[i] ?? "")) i += 1;
      const quote = xml[i];
      if (quote !== '"' && quote !== "'") throw new Error(`expected quoted ${attrName}`);
      i += 1;
      const valueStart = i;
      while (i < xml.length && xml[i] !== quote) i += 1;
      if (i >= xml.length) throw new Error(`unterminated ${attrName}`);
      attrs[localName(attrName)] = decodeEntities(xml.slice(valueStart, i));
      i += 1;
    }
    let selfClosing = false;
    if (xml[i] === "/" && xml[i + 1] === ">") {
      selfClosing = true;
      i += 2;
    } else if (xml[i] === ">") {
      i += 1;
    } else {
      throw new Error(`bad end of <${rawName}>`);
    }
    const el: XmlElement = { name: localName(rawName), attrs, children: [], text: "" };
    if (selfClosing) return el;

    let text = "";
    while (i < xml.length) {
      if (xml.startsWith("</", i)) {
        i += 2;
        const closeStart = i;
        while (i < xml.length && xml[i] !== ">") i += 1;
        const closeName = xml.slice(closeStart, i).trim();
        if (i >= xml.length) throw new Error(`unterminated </${closeName}>`);
        i += 1;
        if (localName(closeName) !== el.name) {
          throw new Error(`mismatched </${closeName}> for <${el.name}>`);
        }
        break;
      }
      if (xml.startsWith("<!--", i)) {
        const end = xml.indexOf("-->", i);
        if (end < 0) throw new Error("unterminated comment");
        i = end + 3;
        continue;
      }
      if (xml.startsWith("<![CDATA[", i)) {
        const end = xml.indexOf("]]>", i);
        if (end < 0) throw new Error("unterminated CDATA");
        text += xml.slice(i + 9, end);
        i = end + 3;
        continue;
      }
      if (xml.startsWith("<?", i)) {
        const end = xml.indexOf("?>", i);
        if (end < 0) throw new Error("unterminated processing instruction");
        i = end + 2;
        continue;
      }
      if (xml[i] === "<") {
        el.children.push(parseElement());
        continue;
      }
      const next = xml.indexOf("<", i);
      const chunk = xml.slice(i, next === -1 ? xml.length : next);
      text += decodeEntities(chunk);
      i += chunk.length;
    }
    el.text = text;
    return el;
  }

  skipProlog();
  if (i >= xml.length || xml[i] !== "<") throw new Error("XML has no root element");
  return parseElement();
}

export function innerText(el: XmlElement): string {
  let out = el.text;
  for (const child of el.children) out += innerText(child);
  return out;
}
