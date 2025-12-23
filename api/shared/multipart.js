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

    // ✅ Azure Functions FIX:
    // In SWA Functions, req may not be a stream; req.body usually exists.
    const stream = req.body
      ? Readable.from(req.body)
      : req;

    stream.pipe(bb);
  });
}

module.exports = { parseMultipart };
