import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const roots = [];
for (const name of readdirSync("node_modules")) {
  if (name.startsWith(".")) continue;
  if (name.startsWith("@"))
    for (const sub of readdirSync(join("node_modules", name)))
      roots.push(join("node_modules", name, sub));
  else roots.push(join("node_modules", name));
}
const out = [
  "淡江世界 / THIRD-PARTY NOTICES",
  "Includes notices for installed runtime and build dependencies.",
  "Campus names reference https://classic.tku.edu.tw/acad.asp and https://classic.tku.edu.tw/doc/CampusMap202103.pdf .",
  "Campus geometry and interiors are stylized reconstructions with estimated placement.",
  "",
];
for (const dir of roots.sort()) {
  const pkg = join(dir, "package.json");
  if (!existsSync(pkg)) continue;
  const p = JSON.parse(readFileSync(pkg, "utf8"));
  const files = readdirSync(dir).filter((n) =>
    /^(license|licence|copying)(\.md|\.txt)?$/i.test(n),
  );
  if (!files.length) continue;
  out.push(
    "\n" + "=".repeat(72),
    p.name + " " + p.version + " (" + (p.license ?? "see text") + ")",
  );
  for (const file of files) out.push(readFileSync(join(dir, file), "utf8"));
}
out.push(
  "\n3D ASSET ATTRIBUTION\n",
  readFileSync("public/models/vendor/ATTRIBUTION.md", "utf8"),
);
writeFileSync("public/third-party-notices.txt", out.join("\n"), "utf8");
