/**
 * IDS — Contract Validator (shared/contract/scripts/validate-config.js)
 *
 * PURPOSE
 *   This script validates our example configuration files against the JSON Schema
 *   defined in `shared/contract/schema/config.schema.json`.
 *
 * WHY THIS EXISTS
 *   In IDS, the "contract" (the JSON config format) is the handshake between:
 *     - Admin (control plane) that produces configs
 *     - Player (runtime) that consumes configs
 *
 *   If the contract is ambiguous or changes silently, the project becomes chaos:
 *   the admin may generate configs the player can't interpret, or the player may
 *   accept invalid data and fail at runtime.
 *
 *   So we validate early, locally, and in CI:
 *     - Developers get fast feedback
 *     - CI prevents broken configs from being merged
 *     - The schema becomes a reliable source of truth
 *
 * WHAT IT DOES (BEHAVIOR)
 *   1) Loads the JSON Schema:
 *        shared/contract/schema/config.schema.json
 *   2) Builds an AJV validator (Ajv2020) because our schema uses JSON Schema 2020-12.
 *   3) Reads every `*.json` file inside:
 *        shared/contract/examples/
 *   4) Validates each example against the schema.
 *   5) Prints:
 *        - ✓ file valid
 *        - ✗ file invalid + readable error list
 *   6) Exits with:
 *        - code 0 if all examples are valid
 *        - code 1 if at least one example is invalid
 *        - code 2 if no example files exist
 *
 * INPUTS
 *   - Schema file (must be valid JSON):
 *       shared/contract/schema/config.schema.json
 *   - Example config files (must be valid JSON):
 *       shared/contract/examples/*.json
 *
 * OUTPUTS
 *   - Console output describing validation results
 *   - Process exit code (used by Makefile and CI)
 *
 * BOUNDARIES (WHAT THIS SCRIPT DOES NOT DO)
 *   - It does NOT generate configs
 *   - It does NOT fix or rewrite invalid configs
 *   - It does NOT start the player or admin services
 *
 * HOW TO RUN
 *   From repo root:
 *     make validate
 *
 *   Or directly:
 *     node shared/contract/scripts/validate-config.js
 *
 * DEPENDENCIES
 *   - ajv (JSON Schema validator)
 *   - ajv-formats (date-time, etc.)
 *
 * FUTURE EVOLUTION
 *   - Validate additional example folders (e.g., scenarios/)
 *   - Add stricter error formatting and schema version reporting
 *   - Integrate with pre-commit hooks
 */

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
