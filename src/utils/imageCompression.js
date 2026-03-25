// ESM
import sharp from "sharp";

export function buildCompressor({
  maxWidth = 1920,
  format = "webp",
  quality = 80,
} = {}) {
  return async function compressImage(req, res, next) {
    try {
      if (!req.file?.buffer) return next();

      const input = sharp(req.file.buffer, { failOn: "none" });
      const meta = await input.metadata();

      const shouldResize =
        typeof meta.width === "number" && meta.width > maxWidth;
      let pipeline = input.rotate();

      if (shouldResize) {
        pipeline = pipeline.resize({
          width: maxWidth,
          withoutEnlargement: true,
        });
      }

      switch (format) {
        case "avif":
          pipeline = pipeline.avif({ quality, effort: 4 });
          req.file.mimetype = "image/avif";
          break;
        case "jpeg":
          pipeline = pipeline.jpeg({ quality, mozjpeg: true });
          req.file.mimetype = "image/jpeg";
          break;
        case "png":
          pipeline = pipeline.png({ quality });
          req.file.mimetype = "image/png";
          break;
        default:
          pipeline = pipeline.webp({ quality });
          req.file.mimetype = "image/webp";
      }

      const outBuffer = await pipeline.toBuffer();
      req.file.buffer = outBuffer;

      const base = (req.file.originalname || "upload").replace(/\.[^.]+$/, "");
      const ext = format === "jpeg" ? "jpg" : format;
      req.file.originalname = `${base}.${ext}`;

      next();
    } catch (err) {
      next(err);
    }
  };
}
