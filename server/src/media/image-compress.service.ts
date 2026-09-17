import { Injectable } from "@nestjs/common";
import { join } from "path";
import { Worker } from "worker_threads";

@Injectable()
export class ImageCompressService {
  compress(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const workerPath = join(__dirname, "image-compress.worker.js");
      const worker = new Worker(workerPath, {
        workerData: { buffer },
      });
      worker.once("message", (payload: Buffer) => {
        resolve(Buffer.from(payload));
      });
      worker.once("error", reject);
      worker.once("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Image compression worker exited with code ${code}`));
        }
      });
    });
  }
}
