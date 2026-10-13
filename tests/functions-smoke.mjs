import assert from "node:assert/strict";

const base =
  process.env.ATLAS_FUNCTIONS_TEST_URL ||
  "http://127.0.0.1:9999/.netlify/functions";
const request = (name, options) => fetch(`${base}/${name}`, options);
const health = await request("health");
assert.equal(health.status, 200);
assert.equal((await health.json()).application, "Atlas Forge");

const world = await request(
  "generate-world?seed=7&name=Function%20test%20world",
);
assert.equal(world.status, 200);
const project = await world.json();
assert.equal(project.name, "Function test world");
assert.ok(project.world.lands.length > 0);
assert.ok(project.world.provinces.length > 0);
const validate = await request("validate-project", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(project),
});
assert.equal(validate.status, 200);
assert.equal((await validate.json()).valid, true);

project.world.provinces[0].countryId = "missing-country";
const rejected = await request("validate-project", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(project),
});
assert.equal(rejected.status, 400);
assert.equal((await rejected.json()).valid, false);
assert.equal((await request("generate-world?seed=-1")).status, 400);
assert.equal((await request("health", { method: "POST" })).status, 405);
console.log(
  "Netlify runtime checks passed: health, editable generation, project validation, invalid ownership, seed errors, and methods.",
);
