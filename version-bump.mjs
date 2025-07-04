import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.argv[2];
const minAppVersion = process.argv[3];

// read minAppVersion from manifest.json if not provided
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion: currentMinAppVersion } = manifest;

// update manifest.json
if (targetVersion) {
  manifest.version = targetVersion;
  if (minAppVersion) {
    manifest.minAppVersion = minAppVersion;
  }
  writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));
}

// update versions.json
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
if (targetVersion) {
  versions[targetVersion] = minAppVersion || currentMinAppVersion;
  writeFileSync("versions.json", JSON.stringify(versions, null, 2));
}
