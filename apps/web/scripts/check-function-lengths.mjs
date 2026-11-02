import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(filename);
    return /\.(ts|tsx|mjs)$/.test(filename) &&
      !filename.endsWith("generated.ts")
      ? [filename]
      : [];
  });
}

function check(filename) {
  const text = fs.readFileSync(filename, "utf8");
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const errors = [];
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const start = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      ).line;
      const end = source.getLineAndCharacterOfPosition(node.end).line;
      const nearby = text
        .split("\n")
        .slice(Math.max(0, start - 2), start + 1)
        .join("\n");
      if (end - start + 1 > 100 && !nearby.includes("length-exception:")) {
        errors.push(`${filename}:${start + 1}: function exceeds 100 lines`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return errors;
}

const errors = [
  ...files("src"),
  ...files("tests"),
  ...files("scripts"),
].flatMap(check);
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("TypeScript/JavaScript function lengths passed\n");
