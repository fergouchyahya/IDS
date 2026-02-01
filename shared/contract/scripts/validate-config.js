/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const schemaPath = path.resolve(__dirname, "../schema/config.schema.json");
  const examplesDir = path.resolve(__dirname, "../examples");

  const schema = readJson(schemaPath);

  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
  });
  addFormats(ajv);

  const validate = ajv.compile(schema);

  const files = fs.readdirSync(examplesDir).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    console.error("No example JSON files found in:", examplesDir);
    process.exit(2);
  }

  let ok = true;

  for (const f of files) {
    const fp = path.join(examplesDir, f);
    const data = readJson(fp);
    const valid = validate(data);

    if (!valid) {
      ok = false;
      console.error(`✗ ${f} invalid:`);
      for (const e of validate.errors || []) {
        console.error(`  - ${e.instancePath || "/"} ${e.message}`);
      }
    } else {
      console.log(`✓ ${f} valid`);
    }
  }

  process.exit(ok ? 0 : 1);
}

main();
