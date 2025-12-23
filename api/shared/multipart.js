const Busboy = require("busboy");
const { Readable } = require("stream");

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    const files = {};
    const fields = {};

    bb.on("file", (name, file, info) => {
      const chunks = [];
      file.on("data", (d) => chunks.push(d));
      file.on("end", () => {
        files[name] = {
          filename: info.filename,
          mimeType: info.mimeType,
          buffer: Buffer.concat(chunks)
        };
      });
    });

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("error", reject);
    bb.on("finish", () => resolve({ files, fields }));

    // ✅ Azure Functions FIX (robust):
    // req.body may be string / Buffer / Uint8Array. Convert to Buffer for Busboy.
    let bodyBuf = null;
    if (req.body) {
      if (Buffer.isBuffer(req.body)) bodyBuf = req.body;
      else if (req.body instanceof Uint8Array) bodyBuf = Buffer.from(req.body);
      else if (typeof req.body === "string") bodyBuf = Buffer.from(req.body, "binary");
      else bodyBuf = Buffer.from(JSON.stringify(req.body));
    }

    const stream = bodyBuf ? Readable.from(bodyBuf) : req;
    stream.pipe(bb);
  });
}

module.exports = { parseMultipart };
