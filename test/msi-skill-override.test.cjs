const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("local mju-msi skill overrides current-term grades to course-scores", () => {
  const skill = fs.readFileSync(path.join(root, "skills", "mju-msi", "SKILL.md"), "utf8");

  assert.match(skill, /현재 학기 성적\/점수: `mju .* msi course-scores`/);
  assert.match(skill, /"이번 학기 성적".*"현재 성적".*"수강점수"/);
  assert.match(skill, /기존 확정등급 조회 명령은 사용하지 않습니다/);
  assert.doesNotMatch(skill, /current-grades/);
  assert.doesNotMatch(skill, /msi grades/);
});

test("runtime instructions avoid removed current-grade commands", () => {
  const runtimeInstructionFiles = [
    path.join(root, "workspace", "BOOTSTRAP.md"),
    ...fs
      .readdirSync(path.join(root, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, "skills", entry.name, "SKILL.md"))
      .filter((filePath) => fs.existsSync(filePath)),
  ];

  for (const filePath of runtimeInstructionFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    assert.doesNotMatch(content, /current-grades|msi grades/, filePath);
  }

  const bootstrap = fs.readFileSync(path.join(root, "workspace", "BOOTSTRAP.md"), "utf8");
  assert.match(bootstrap, /이번 학기 성적.*mju msi course-scores/s);
  assert.match(bootstrap, /현재 학기 성적 관련 의도는[\s\S]*모두 `course-scores`/);
});

test("Dockerfile copies repo-local skills after upstream mju-cli skills", () => {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const templateUpstream = dockerfile.indexOf("COPY --chown=agent:agent mju-cli/skills/ /opt/mjuclaw-workspace-template/workspace/skills/");
  const templateOverride = dockerfile.indexOf("COPY --chown=agent:agent skills/ /opt/mjuclaw-workspace-template/workspace/skills/");
  const homeUpstream = dockerfile.indexOf("COPY --chown=agent:agent mju-cli/skills/ /home/agent/.openclaw/workspace/skills/");
  const homeOverride = dockerfile.indexOf("COPY --chown=agent:agent skills/ /home/agent/.openclaw/workspace/skills/");

  assert.ok(templateUpstream >= 0, "template upstream skills copy should exist");
  assert.ok(templateOverride > templateUpstream, "repo-local template skills should override upstream skills");
  assert.ok(homeUpstream >= 0, "home upstream skills copy should exist");
  assert.ok(homeOverride > homeUpstream, "repo-local home skills should override upstream skills");
});

test("setup pins mju-cli to the course-scores capable branch", () => {
  const setup = fs.readFileSync(path.join(root, "setup.sh"), "utf8");
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

  assert.match(setup, /read_dotenv_value\(\)/);
  assert.match(setup, /MJU_CLI_BRANCH="\$\{MJU_CLI_BRANCH:-\$\(read_dotenv_value MJU_CLI_BRANCH\)\}"/);
  assert.match(setup, /MJU_CLI_BRANCH="\$\{MJU_CLI_BRANCH:-msi-course-scores\}"/);
  assert.match(setup, /git clone --branch "\$BRANCH" "\$REPO" "\$DIR"/);
  assert.match(setup, /clone_or_pull mju-cli https:\/\/github\.com\/university-claw\/mju-cli\.git "\$MJU_CLI_BRANCH"/);
  assert.match(dockerfile, /git clone --branch msi-course-scores https:\/\/github\.com\/university-claw\/mju-cli\.git/);
  assert.match(readme, /git clone --branch msi-course-scores https:\/\/github\.com\/university-claw\/mju-cli\.git/);
});
