const encoder = new TextEncoder();

function ownedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  const factory = (globalThis as { CompressionStream?: new (format: string) => ReadableWritablePair<Uint8Array, Uint8Array> }).CompressionStream;
  if (!factory || typeof Blob === "undefined") return null;
  const stream = new Blob([ownedBytes(bytes)]).stream().pipeThrough(new factory("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * One-page PDF with an RGB image. FlateDecode when CompressionStream exists.
 * The page is the image in CSS pixels; this is an export, not a workbook field.
 */
export async function pdfFromRgb(width: number, height: number, rgb: Uint8Array): Promise<Uint8Array> {
  if (width < 1 || height < 1 || rgb.length !== width * height * 3) {
    throw new Error("pdf image size does not match RGB data");
  }
  const compressed = await deflate(rgb);
  const data = compressed ?? rgb;
  const filter = compressed ? "/Filter /FlateDecode " : "";
  return assemblePdf(width, height, data, filter);
}

function assemblePdf(width: number, height: number, data: Uint8Array, filter: string): Uint8Array {
  const chunks: Uint8Array[] = [];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const text = (value: string) => push(encoder.encode(value));

  text("%PDF-1.4\n");
  const offsets = [0];
  const startObject = (body: string) => {
    offsets.push(length);
    text(body);
  };

  startObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  startObject(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`,
  );
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  startObject(`4 0 obj\n<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
  offsets.push(length);
  text(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 ${filter}/Length ${data.length} >>\nstream\n`,
  );
  push(data);
  text("\nendstream\nendobj\n");

  const xref = length;
  text("xref\n0 6\n");
  text("0000000000 65535 f \n");
  for (let index = 1; index <= 5; index += 1) {
    text(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
