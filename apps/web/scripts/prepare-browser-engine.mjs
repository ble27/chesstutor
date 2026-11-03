import { createHash } from "node:crypto";
import { Console } from "node:console";
import process from "node:process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = `${root}/node_modules/stockfish`;
const destination = `${root}/public/engine`;
const pinned = JSON.parse(
  await readFile(`${root}/../../engines/stockfish-browser.json`, "utf8"),
);
await mkdir(destination, { recursive: true });
const files = (await readdir(`${source}/src`)).filter((name) =>
  /^stockfish-17\.1-(8e4d048|single-a496a04)(-part-[0-5]\.wasm|\.js)$/.test(
    name,
  ),
);
if (files.length !== 14)
  throw new Error("Pinned full Stockfish assets are missing");
for (const name of files) {
  const data = await readFile(`${source}/src/${name}`);
  if (createHash("sha256").update(data).digest("hex") !== pinned.files[name])
    throw new Error(`Pinned browser engine checksum mismatch: ${name}`);
  await copyFile(`${source}/src/${name}`, `${destination}/${name}`);
}
await copyFile(`${source}/Copying.txt`, `${destination}/LICENSE.txt`);
await writeFile(
  `${destination}/provenance.json`,
  JSON.stringify(pinned, null, 2),
);
new Console(process.stdout).log(
  "Prepared pinned full Stockfish 17.1 browser assets (single + threaded)",
);
