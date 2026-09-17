import { parentPort, workerData } from "worker_threads";
import sharp from "sharp";

const MAX_EDGE = 720;

async function run() {
  const { buffer } = workerData as { buffer: Buffer };
  const out = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  parentPort?.postMessage(out);
}

run().catch((err) => {
  throw err;
});
