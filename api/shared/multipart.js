const Busboy = require("busboy");

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });

    const files = {};
    const fields = {};

    bb.on("file", (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];

      file.on("data", (d) => chunks.push(d));
      file.on("end", () => {
        files[name] = {
          filename,
          mimeType,
          buffer: Buffer.concat(chunks)
        };
      });
    });

    bb.on("field", (name, val) => {
      fields[name] = val;
    });

    bb.on("error", reject);
    bb.on("finish", () => resolve({ files, fields }));

    req.pipe(bb);
  });
}

module.exports = { parseMultipart };
