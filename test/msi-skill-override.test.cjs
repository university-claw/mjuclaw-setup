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
  assert.match(skill, /msi lecture-evaluations submit/);
  assert.match(skill, /scope.*department.*교육만족도/);
  assert.match(skill, /scope.*course.*강의별 강의평가/);
  assert.match(skill, /아무 과목이나[\s\S]*scope: "course"/);
  assert.match(skill, /msi \+last-class-times/);
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
  assert.match(bootstrap, /강의평가.*mju msi lecture-evaluations submit/s);
  assert.match(bootstrap, /target `scope`가 `department`[\s\S]*`course`[\s\S]*강의별 강의평가/);
});

test("runtime instructions route academic planning away from legacy MSI and UCheck", () => {
  const bootstrap = fs.readFileSync(path.join(root, "workspace", "BOOTSTRAP.md"), "utf8");
  const soul = fs.readFileSync(path.join(root, "workspace", "SOUL.md"), "utf8");
  const newsSkill = fs.readFileSync(path.join(root, "skills", "getting-mju-news", "SKILL.md"), "utf8");
  const msiSkill = fs.readFileSync(path.join(root, "skills", "mju-msi", "SKILL.md"), "utf8");

  assert.match(bootstrap, /시간표 설계[\s\S]*mju-timetable-planner \{DISCORD_USER_ID\} --format json[\s\S]*timetable-planner/);
  assert.match(bootstrap, /YYYY년 1학기[\s\S]*--year YYYY --term-code 10/);
  assert.match(bootstrap, /YYYY년 2학기[\s\S]*--year YYYY --term-code 20/);
  assert.match(bootstrap, /query\.year[\s\S]*query\.termCode[\s\S]*studentStanding[\s\S]*다시 실행/);
  assert.match(bootstrap, /졸업요건[\s\S]*졸업 로드맵[\s\S]*mju-graduation-roadmap \{DISCORD_USER_ID\} --format json/);
  assert.match(bootstrap, /"내 졸업요건"[\s\S]*"졸업학점"[\s\S]*"졸업까지"[\s\S]*mju-graduation-roadmap \{DISCORD_USER_ID\} --format json/);
  assert.match(bootstrap, /일반적인 "졸업요건" 요청[\s\S]*새 졸업 로드맵/);
  assert.match(bootstrap, /MSI 원본만[\s\S]*mju-graduation-roadmap \{DISCORD_USER_ID\} --format json/);
  assert.match(bootstrap, /mju-news academic-planning[\s\S]*직접 호출하지 마세요/);
  assert.match(bootstrap, /기존 MSI 졸업요건 웹뷰는 임시 비활성화/);
  assert.match(bootstrap, /만료된 웹뷰 링크 재발급[\s\S]*이전 대화의 `viewUrl`을 재사용하지 마세요/);
  assert.match(bootstrap, /웹뷰 링크 만료는 SSO 세션 만료가 아니므로[\s\S]*DM으로 다시 로그인\/세션 확인/);
  assert.doesNotMatch(bootstrap, /\|\s*"MSI 졸업요건 원본"[^|\n]*\|\s*`mju msi graduation/);
  assert.doesNotMatch(bootstrap, /\|\s*"내 졸업요건",\s*"졸업까지"\s*\|\s*`mju msi graduation`/);
  assert.doesNotMatch(bootstrap, /\|\s*"내 졸업요건 원본"[^|\n]*\|\s*`mju msi graduation`/);
  assert.match(bootstrap, /시간표 설계 요청[\s\S]*mju ucheck[\s\S]*출석 웹뷰/);
  assert.match(bootstrap, /DB import[\s\S]*ucheck[\s\S]*현재 수강 시간표로 대체하지 말고/);

  assert.match(soul, /시간표 설계와 졸업 로드맵은 전용 helper mju-timetable-planner \/ mju-graduation-roadmap/);

  assert.match(newsSkill, /시간표 설계[\s\S]*mju-timetable-planner <DISCORD_USER_ID> --format json/);
  assert.match(newsSkill, /2026년 1학기[\s\S]*--year 2026 --term-code 10/);
  assert.match(newsSkill, /2026년 2학기[\s\S]*--year 2026 --term-code 20/);
  assert.match(newsSkill, /query\.year[\s\S]*query\.termCode[\s\S]*studentStanding[\s\S]*다시 실행/);
  assert.match(newsSkill, /졸업요건[\s\S]*졸업 로드맵[\s\S]*mju-graduation-roadmap <DISCORD_USER_ID> --format json/);
  assert.match(newsSkill, /mju-news academic-planning`을 직접 호출하지 말고 전용 helper/);
  assert.match(newsSkill, /만료된 웹뷰 링크[\s\S]*이전 응답의 URL을 다시 보내지 않습니다/);
  assert.match(newsSkill, /일반적인 "졸업요건" 요청도 이 기능으로 처리/);
  assert.match(newsSkill, /기존 `mju msi graduation`[\s\S]*임시 비활성화/);
  assert.doesNotMatch(newsSkill, /mju-news list|mju-news scrape/);

  assert.match(msiSkill, /현재 수강 시간표 조회/);
  assert.match(msiSkill, /MSI 원본 졸업요건 조회[\s\S]*임시 비활성화/);
  assert.doesNotMatch(msiSkill, /원본 조회를 명시한 경우에만 사용/);
  assert.match(msiSkill, /getting-mju-news[\s\S]*시간표 설계/);
  assert.match(msiSkill, /getting-mju-news[\s\S]*졸업요건[\s\S]*졸업 로드맵/);
  assert.match(msiSkill, /시간표 설계는 `mju-timetable-planner <DISCORD_USER_ID> --format json`/);
  assert.match(msiSkill, /연도\/학기를 명시하면[\s\S]*--year 2026 --term-code 10 --format json/);
  assert.match(msiSkill, /일반적인 "졸업요건" 요청과 명시적인 원본 요청은 `mju-graduation-roadmap <DISCORD_USER_ID> --format json`으로 대체/);
});

test("webview wrappers keep academic planning separate from legacy MSI and UCheck views", () => {
  const mjuNewsWrapper = fs.readFileSync(path.join(root, "bin", "mju-news"), "utf8");
  const mjuWrapper = fs.readFileSync(path.join(root, "bin", "mju"), "utf8");

  assert.match(mjuNewsWrapper, /academic-planning timetable"\*\) echo "timetable-planner"/);
  assert.match(mjuNewsWrapper, /academic-planning graduation-roadmap"\*\) echo "graduation"/);
  assert.doesNotMatch(mjuNewsWrapper, /graduation-requirements list"\*\) echo "graduation"/);
  assert.match(mjuNewsWrapper, /"timetable-planner"\) echo "시간표 설계"/);
  assert.match(mjuNewsWrapper, /"graduation"\) echo "졸업 로드맵"/);

  assert.match(mjuWrapper, /msi timetable"\*\) echo "timetable"/);
  assert.match(mjuWrapper, /MJU_SKIP_VIEW/);
  assert.doesNotMatch(mjuWrapper, /msi graduation"\*\) echo "graduation"/);
  assert.match(mjuWrapper, /ucheck"\*\) echo "attendance"/);
  assert.doesNotMatch(mjuWrapper, /"graduation"\) echo "졸업요건"/);
  assert.match(mjuWrapper, /"attendance"\) echo "출석"/);
});

test("Dockerfile copies repo-local skills after upstream mju-cli skills", () => {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const templateUpstream = dockerfile.indexOf("COPY --chown=agent:agent mju-cli/skills/ /opt/mjuclaw-workspace-template/workspace/skills/");
  const templateNews = dockerfile.indexOf("COPY --chown=agent:agent mju-news/skills/ /opt/mjuclaw-workspace-template/workspace/skills/");
  const templateOverride = dockerfile.indexOf("COPY --chown=agent:agent skills/ /opt/mjuclaw-workspace-template/workspace/skills/");
  const homeUpstream = dockerfile.indexOf("COPY --chown=agent:agent mju-cli/skills/ /home/agent/.openclaw/workspace/skills/");
  const homeNews = dockerfile.indexOf("COPY --chown=agent:agent mju-news/skills/ /home/agent/.openclaw/workspace/skills/");
  const homeOverride = dockerfile.indexOf("COPY --chown=agent:agent skills/ /home/agent/.openclaw/workspace/skills/");

  assert.ok(templateUpstream >= 0, "template upstream skills copy should exist");
  assert.ok(templateNews > templateUpstream, "template mju-news skills copy should follow upstream mju-cli skills");
  assert.ok(templateOverride > templateUpstream, "repo-local template skills should override upstream skills");
  assert.ok(templateOverride > templateNews, "repo-local template skills should override upstream mju-news skills");
  assert.ok(homeUpstream >= 0, "home upstream skills copy should exist");
  assert.ok(homeNews > homeUpstream, "home mju-news skills copy should follow upstream mju-cli skills");
  assert.ok(homeOverride > homeUpstream, "repo-local home skills should override upstream skills");
  assert.ok(homeOverride > homeNews, "repo-local home skills should override upstream mju-news skills");
});

test("Dockerfile installs academic planning helper", () => {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");

  assert.match(dockerfile, /COPY bin\/mju-academic-planning \/usr\/local\/bin\/mju-academic-planning/);
  assert.match(dockerfile, /COPY bin\/mju-timetable-planner \/usr\/local\/bin\/mju-timetable-planner/);
  assert.match(dockerfile, /COPY bin\/mju-graduation-roadmap \/usr\/local\/bin\/mju-graduation-roadmap/);
  assert.match(dockerfile, /chmod \+x \/usr\/local\/bin\/mju-academic-planning/);
  assert.match(dockerfile, /\/usr\/local\/bin\/mju-timetable-planner/);
  assert.match(dockerfile, /\/usr\/local\/bin\/mju-graduation-roadmap/);
});

test("setup pins mju-cli to the deployment branch", () => {
  const setup = fs.readFileSync(path.join(root, "setup.sh"), "utf8");
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

  assert.match(setup, /read_dotenv_value\(\)/);
  assert.match(setup, /MJU_CLI_BRANCH="\$\{MJU_CLI_BRANCH:-\$\(read_dotenv_value MJU_CLI_BRANCH\)\}"/);
  assert.match(setup, /MJU_CLI_BRANCH="\$\{MJU_CLI_BRANCH:-main\}"/);
  assert.match(setup, /git clone --branch "\$BRANCH" "\$REPO" "\$DIR"/);
  assert.match(setup, /clone_or_pull mju-cli https:\/\/github\.com\/university-claw\/mju-cli\.git "\$MJU_CLI_BRANCH"/);
  assert.match(setup, /clone_or_pull mju-news https:\/\/github\.com\/university-claw\/mju-public-data-reader\.git "\$MJU_NEWS_BRANCH"/);
  assert.match(dockerfile, /git clone --branch main https:\/\/github\.com\/university-claw\/mju-cli\.git/);
  assert.match(dockerfile, /git clone https:\/\/github\.com\/university-claw\/mju-public-data-reader\.git mju-news/);
  assert.match(readme, /git clone --branch main https:\/\/github\.com\/university-claw\/mju-cli\.git/);
  assert.match(readme, /mju-public-data-reader/);
});
