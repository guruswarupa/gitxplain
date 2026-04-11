import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const WORKFLOW_DIR = ".github/workflows";

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function fileExists(cwd, relativePath) {
  return existsSync(path.join(cwd, relativePath));
}

function detectPackageManager(cwd) {
  if (fileExists(cwd, "pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (fileExists(cwd, "yarn.lock")) {
    return "yarn";
  }

  if (fileExists(cwd, "package-lock.json")) {
    return "npm";
  }

  return "npm";
}

function normalizeNodeVersion(raw) {
  if (!raw) {
    return null;
  }

  const match = raw.trim().match(/\d+(?:\.\d+){0,2}/);
  return match ? match[0] : null;
}

function detectNodeVersion(cwd, packageJson) {
  if (fileExists(cwd, ".nvmrc")) {
    return {
      source: "file",
      value: ".nvmrc"
    };
  }

  const engineVersion = normalizeNodeVersion(packageJson?.engines?.node);
  if (engineVersion) {
    return {
      source: "value",
      value: engineVersion
    };
  }

  return {
    source: "value",
    value: "20"
  };
}

function detectGitHubRepository(cwd) {
  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();

    const match =
      remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i) ??
      remote.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);

    if (!match) {
      return null;
    }

    return {
      owner: match[1],
      repo: match[2],
      slug: `${match[1]}/${match[2]}`
    };
  } catch {
    return null;
  }
}

function detectNodePackaging(cwd, packageJson) {
  const packageName = (packageJson?.name ?? "package").replace(/^@[^/]+\//, "");
  const githubRepository = detectGitHubRepository(cwd);
  const homebrewFormulaPath = `packaging/homebrew-tap/Formula/${packageName}.rb`;

  return {
    deb: fileExists(cwd, "scripts/build-deb.sh"),
    aur: fileExists(cwd, "packaging/aur/PKGBUILD"),
    homebrew: fileExists(cwd, homebrewFormulaPath),
    homebrewFormulaPath,
    homebrewTapRepo: githubRepository ? `${githubRepository.owner}/homebrew-tap` : null,
    githubRepository
  };
}

function toHomebrewClassName(packageName) {
  return packageName
    .replace(/^@[^/]+\//, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function detectNodeProject(cwd) {
  if (!fileExists(cwd, "package.json")) {
    return null;
  }

  const packageJson = readJsonFile(path.join(cwd, "package.json"));
  const scripts = packageJson.scripts ?? {};
  const nodeVersion = detectNodeVersion(cwd, packageJson);
  const packageManager = detectPackageManager(cwd);
  const releaseSupported = packageJson.private !== true && typeof packageJson.name === "string";
  const packSupported = packageJson.private !== true || Boolean(packageJson.bin);
  const packaging = detectNodePackaging(cwd, packageJson);

  return {
    type: "node",
    displayName: packageJson.name || path.basename(cwd),
    packageManager,
    packageJson,
    packaging,
    nodeVersion,
    commands: {
      install:
        packageManager === "pnpm"
          ? "pnpm install --frozen-lockfile"
          : packageManager === "yarn"
            ? "yarn install --frozen-lockfile"
            : "npm ci",
      lint: typeof scripts.lint === "string" ? `${packageManager} run lint` : null,
      test: typeof scripts.test === "string" ? `${packageManager} test` : null,
      build: typeof scripts.build === "string" ? `${packageManager} run build` : null,
      pack: packSupported ? "npm pack --dry-run" : null
    },
    release: {
      supported: releaseSupported,
      type: "npm",
      packageName: packageJson.name || null
    }
  };
}

function detectPythonProject(cwd) {
  if (!fileExists(cwd, "pyproject.toml") && !fileExists(cwd, "requirements.txt")) {
    return null;
  }

  return {
    type: "python",
    displayName: path.basename(cwd),
    commands: {
      install: fileExists(cwd, "requirements.txt")
        ? "python -m pip install -r requirements.txt"
        : "python -m pip install -e .",
      lint: null,
      test: fileExists(cwd, "pytest.ini") || fileExists(cwd, "tests") ? "pytest" : null,
      build: "python -m build",
      pack: null
    },
    release: {
      supported: fileExists(cwd, "pyproject.toml"),
      type: "pypi",
      packageName: null
    }
  };
}

function detectGoProject(cwd) {
  if (!fileExists(cwd, "go.mod")) {
    return null;
  }

  return {
    type: "go",
    displayName: path.basename(cwd),
    commands: {
      install: "go mod download",
      lint: null,
      test: "go test ./...",
      build: "go build ./...",
      pack: null
    },
    release: {
      supported: false,
      type: null,
      packageName: null
    }
  };
}

function detectRustProject(cwd) {
  if (!fileExists(cwd, "Cargo.toml")) {
    return null;
  }

  return {
    type: "rust",
    displayName: path.basename(cwd),
    commands: {
      install: "cargo fetch",
      lint: "cargo fmt --check\ncargo clippy --all-targets --all-features -- -D warnings",
      test: "cargo test --all-features",
      build: "cargo build --release",
      pack: null
    },
    release: {
      supported: true,
      type: "crates",
      packageName: null
    }
  };
}

function detectGradleProject(cwd) {
  const hasGradleWrapper = fileExists(cwd, "gradlew");
  const settingsFiles = ["settings.gradle.kts", "settings.gradle"];
  const rootBuildFiles = ["build.gradle.kts", "build.gradle"];
  const appBuildFiles = [
    "app/build.gradle.kts",
    "app/build.gradle",
    "android/app/build.gradle.kts",
    "android/app/build.gradle"
  ];

  const hasSettings = settingsFiles.some((filePath) => fileExists(cwd, filePath));
  const hasRootBuild = rootBuildFiles.some((filePath) => fileExists(cwd, filePath));

  if (!hasGradleWrapper && !hasSettings && !hasRootBuild) {
    return null;
  }

  const appBuildPath = appBuildFiles.find((filePath) => fileExists(cwd, filePath)) ?? null;
  const appBuildContent = appBuildPath ? readFileSync(path.join(cwd, appBuildPath), "utf8") : "";
  const isAndroidApp =
    appBuildContent.includes("com.android.application") ||
    appBuildContent.includes("libs.plugins.android.application") ||
    appBuildContent.includes("android {");

  const gradleCommand = hasGradleWrapper ? "./gradlew" : "gradle";
  const displayName = path.basename(cwd);

  if (isAndroidApp) {
    const appModule = appBuildPath?.startsWith("android/") ? ":android:app" : ":app";

    return {
      type: "gradle-android",
      displayName,
      commands: {
        install: null,
        lint: `${gradleCommand} ${appModule}:lintDebug`,
        test: `${gradleCommand} ${appModule}:testDebugUnitTest`,
        build: `${gradleCommand} ${appModule}:assembleDebug`,
        pack: null
      },
      release: {
        supported: false,
        type: null,
        packageName: null
      }
    };
  }

  return {
    type: "gradle",
    displayName,
    commands: {
      install: null,
      lint: null,
      test: `${gradleCommand} test`,
      build: `${gradleCommand} build`,
      pack: null
    },
    release: {
      supported: false,
      type: null,
      packageName: null
    }
  };
}

function detectDockerSupport(cwd) {
  return fileExists(cwd, "Dockerfile");
}

function listExistingWorkflows(cwd) {
  const workflowDir = path.join(cwd, WORKFLOW_DIR);
  if (!existsSync(workflowDir)) {
    return [];
  }

  return readdirSync(workflowDir).filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"));
}

function formatRunStep(name, command, extraLines = []) {
  const lines = [`      - name: ${name}`];

  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (command.includes("\n")) {
    lines.push("        run: |");
    lines.push(...command.split("\n").map((line) => `          ${line}`));
  } else {
    lines.push(`        run: ${command}`);
  }

  return lines.join("\n");
}

function buildNodeSetupStep(nodeVersion, packageManager = "npm") {
  if (nodeVersion.source === "file") {
    return [
      "      - name: Setup Node.js",
      "        uses: actions/setup-node@v4",
      "        with:",
      "          node-version-file: .nvmrc",
      `          cache: ${packageManager}`
    ].join("\n");
  }

  return [
    "      - name: Setup Node.js",
    "        uses: actions/setup-node@v4",
    "        with:",
    `          node-version: '${nodeVersion.value}'`,
    `          cache: ${packageManager}`
  ].join("\n");
}

function buildInstallStep(context) {
  if (context.type === "node" && (context.packageManager === "pnpm" || context.packageManager === "yarn")) {
    return [
      "      - name: Enable Corepack",
      "        run: corepack enable",
      "      - name: Install dependencies",
      `        run: ${context.commands.install}`
    ].join("\n");
  }

  if (context.type === "python") {
    return [
      "      - name: Setup Python",
      "        uses: actions/setup-python@v5",
      "        with:",
      "          python-version: '3.12'",
      "      - name: Install dependencies",
      `        run: ${context.commands.install}`
    ].join("\n");
  }

  if (context.type === "go") {
    return [
      "      - name: Setup Go",
      "        uses: actions/setup-go@v5",
      "        with:",
      "          go-version: '1.22'",
      "      - name: Download modules",
      `        run: ${context.commands.install}`
    ].join("\n");
  }

  if (context.type === "rust") {
    return [
      "      - name: Install Rust toolchain",
      "        uses: dtolnay/rust-toolchain@stable",
      formatRunStep("Fetch dependencies", context.commands.install)
    ].join("\n");
  }

  if (context.type === "gradle" || context.type === "gradle-android") {
    return [
      "      - name: Setup Java",
      "        uses: actions/setup-java@v4",
      "        with:",
      "          distribution: temurin",
      "          java-version: '17'",
      "      - name: Setup Gradle",
      "        uses: gradle/actions/setup-gradle@v4",
      "      - name: Make Gradle wrapper executable",
      "        run: chmod +x gradlew"
    ].join("\n");
  }

  return formatRunStep("Install dependencies", context.commands.install);
}

function buildNodeReleaseSetup(context) {
  const lines = [];

  lines.push(buildNodeSetupStep(context.nodeVersion, context.packageManager));

  if (context.packageManager === "pnpm" || context.packageManager === "yarn") {
    lines.push("      - name: Enable Corepack");
    lines.push("        run: corepack enable");
  }

  lines.push(formatRunStep("Install dependencies", context.commands.install));

  return lines.join("\n");
}

function buildRunSteps(context) {
  const steps = [];

  if (context.commands.lint) {
    steps.push(formatRunStep("Lint", context.commands.lint));
  }

  if (context.commands.test) {
    steps.push(formatRunStep("Test", context.commands.test));
  }

  if (context.commands.build) {
    steps.push(formatRunStep("Build", context.commands.build));
  }

  if (context.commands.pack) {
    const extraLines =
      context.type === "node"
        ? [
            "        env:",
            "          npm_config_cache: ${{ runner.temp }}/npm-cache"
          ]
        : [];
    steps.push(formatRunStep("Verify package", context.commands.pack, extraLines));
  }

  return steps.join("\n");
}

export function inspectRepositoryForPipeline(cwd) {
  const node = detectNodeProject(cwd);
  const python = detectPythonProject(cwd);
  const go = detectGoProject(cwd);
  const rust = detectRustProject(cwd);
  const gradle = detectGradleProject(cwd);
  const primary = node ?? python ?? go ?? rust ?? gradle;

  if (!primary) {
    return {
      supported: false,
      reason: "No supported Node, Python, Go, Rust, or Gradle project files were detected.",
      existingWorkflows: listExistingWorkflows(cwd),
      options: []
    };
  }

  const options = [
    {
      id: "ci",
      label: "GitHub Actions CI verification",
      description: "Runs install, lint, test, build, and package checks when supported.",
      files: [".github/workflows/ci.yml"]
    },
    {
      id: "gitlab-ci",
      label: "GitLab CI verification",
      description: "Creates a .gitlab-ci.yml pipeline with install, lint, test, and build stages.",
      files: [".gitlab-ci.yml"]
    },
    {
      id: "circleci",
      label: "CircleCI verification",
      description: "Creates a .circleci/config.yml pipeline for verification jobs.",
      files: [".circleci/config.yml"]
    },
    {
      id: "bitbucket-pipelines",
      label: "Bitbucket Pipelines verification",
      description: "Creates bitbucket-pipelines.yml with install, test, and build steps.",
      files: ["bitbucket-pipelines.yml"]
    }
  ];

  if (primary.release.supported) {
    options.push({
      id: "ci-release",
      label: `CI plus ${primary.release.type} release automation`,
      description:
        primary.type === "node" && (primary.packaging?.deb || primary.packaging?.homebrew || primary.packaging?.aur)
          ? "Publishes to npm on version tags, builds Debian packages, updates Homebrew when configured, and prints AUR update instructions."
          : primary.type === "node"
            ? "Publishes to npm when you push a version tag like v1.2.3."
          : primary.type === "python"
            ? "Builds and publishes to PyPI when you push a version tag like v1.2.3."
            : "Publishes to crates.io when you push a version tag like v1.2.3.",
      files: [".github/workflows/ci.yml", ".github/workflows/release.yml"]
    });
  }

  if (detectDockerSupport(cwd)) {
    options.push({
      id: "container",
      label: "Container build and GHCR publish",
      description: "Builds the Docker image in CI and publishes it to GitHub Container Registry on tags.",
      files: [".github/workflows/container.yml"]
    });
  }

  return {
    supported: true,
    primary,
    existingWorkflows: listExistingWorkflows(cwd),
    options
  };
}

export function formatPipelineRecommendations(analysis) {
  if (!analysis.supported) {
    return analysis.reason;
  }

  const lines = [
    `Detected project type: ${analysis.primary.type}`,
    `Project: ${analysis.primary.displayName}`
  ];

  if (analysis.primary.type === "node") {
    lines.push(`Package manager: ${analysis.primary.packageManager}`);
    if (analysis.primary.commands.lint) {
      lines.push(`Lint command: ${analysis.primary.commands.lint}`);
    }
    if (analysis.primary.commands.test) {
      lines.push(`Test command: ${analysis.primary.commands.test}`);
    }
    if (analysis.primary.commands.build) {
      lines.push(`Build command: ${analysis.primary.commands.build}`);
    }
  } else {
    if (analysis.primary.commands.lint) {
      lines.push(`Lint command: ${analysis.primary.commands.lint}`);
    }
    if (analysis.primary.commands.test) {
      lines.push(`Test command: ${analysis.primary.commands.test}`);
    }
    if (analysis.primary.commands.build) {
      lines.push(`Build command: ${analysis.primary.commands.build}`);
    }
  }

  if (analysis.existingWorkflows.length > 0) {
    lines.push(`Existing workflows: ${analysis.existingWorkflows.join(", ")}`);
  } else {
    lines.push("Existing workflows: none");
  }

  lines.push("");
  lines.push("Available pipeline options:");

  analysis.options.forEach((option, index) => {
    lines.push(`${index + 1}. ${option.label}`);
    lines.push(`   ${option.description}`);
    lines.push(`   Files: ${option.files.join(", ")}`);
  });

  return lines.join("\n");
}

export function resolvePipelineSelection(analysis, response) {
  const normalized = response.trim().toLowerCase();

  if (normalized === "cancel" || normalized === "q" || normalized === "quit") {
    return null;
  }

  const numeric = Number.parseInt(normalized, 10);
  if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= analysis.options.length) {
    return analysis.options[numeric - 1];
  }

  return analysis.options.find((option) => option.id === normalized) ?? null;
}

export function buildCiWorkflow(context) {
  const lines = [
    "name: CI",
    "",
    "on:",
    "  push:",
    "    branches: [main, master]",
    "  pull_request:",
    "",
    "jobs:",
    "  verify:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - name: Checkout",
    "        uses: actions/checkout@v4"
  ];

  if (context.type === "node") {
    lines.push(buildNodeSetupStep(context.nodeVersion, context.packageManager));
  }

  lines.push(buildInstallStep(context));

  const runSteps = buildRunSteps(context);
  if (runSteps) {
    lines.push(runSteps);
  }

  return `${lines.join("\n")}\n`;
}

export function buildReleaseWorkflow(context) {
  if (!context.release.supported) {
    throw new Error(`Release automation is not supported for ${context.type} repositories.`);
  }

  if (context.type === "node") {
    const packaging = context.packaging ?? {};
    const githubRepository = packaging.githubRepository?.slug ?? null;
    const homebrewTapRepo = packaging.homebrewTapRepo ?? null;
    const packageName = context.packageJson?.name ?? context.displayName ?? "package";
    const formulaClassName = toHomebrewClassName(packageName);
    const binEntries = Object.entries(context.packageJson?.bin ?? {});
    const executablePath = (binEntries[0]?.[1] ?? "cli/index.js").replace(/^\.\//, "");
    const executableNames = binEntries.length > 0 ? binEntries.map(([name]) => name) : [packageName];

    if (packaging.deb || packaging.homebrew || packaging.aur) {
      return [
        "name: Release",
        "",
        "on:",
        "  push:",
        "    tags:",
        "      - 'v*'",
        "",
        "permissions:",
        "  contents: write",
        "",
        "jobs:",
        "  release:",
        "    runs-on: ubuntu-latest",
        "",
        "    steps:",
        "      - name: Checkout",
        "        uses: actions/checkout@v4",
        buildNodeReleaseSetup(context),
        "      - name: Derive release metadata",
        "        id: meta",
        "        run: |",
        "          VERSION=\"${GITHUB_REF_NAME#v}\"",
        "          echo \"version=${VERSION}\" >> \"${GITHUB_OUTPUT}\"",
        packaging.deb ? `          echo "deb_path=dist/${packageName}_\${VERSION}_all.deb" >> "\${GITHUB_OUTPUT}"` : "",
        context.commands.test ? formatRunStep("Test", context.commands.test) : "",
        context.commands.build ? formatRunStep("Build", context.commands.build) : "",
        packaging.deb ? formatRunStep("Build Debian package", "./scripts/build-deb.sh") : "",
        "      - name: Publish to npm",
        "        env:",
        "          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}",
        "        run: npm publish",
        "      - name: Compute npm tarball SHA-256",
        "        id: npm",
        "        run: |",
        "          VERSION=\"${{ steps.meta.outputs.version }}\"",
        `          TARBALL_URL="https://registry.npmjs.org/${packageName}/-/${packageName}-\${VERSION}.tgz"`,
        `          curl -fsSL "\${TARBALL_URL}" -o "${packageName}-\${VERSION}.tgz"`,
        `          SHA256="$(sha256sum "${packageName}-\${VERSION}.tgz" | awk '{print $1}')"`,
        "          echo \"tarball_url=${TARBALL_URL}\" >> \"${GITHUB_OUTPUT}\"",
        "          echo \"sha256=${SHA256}\" >> \"${GITHUB_OUTPUT}\"",
        packaging.homebrew && homebrewTapRepo
          ? [
              "      - name: Checkout Homebrew tap",
              "        uses: actions/checkout@v4",
              "        with:",
              `          repository: ${homebrewTapRepo}`,
              "          token: ${{ secrets.HOMEBREW_TAP_TOKEN }}",
              "          path: homebrew-tap",
              "      - name: Update Homebrew formula",
              "        run: |",
              "          VERSION=\"${{ steps.meta.outputs.version }}\"",
              "          SHA256=\"${{ steps.npm.outputs.sha256 }}\"",
              `          FORMULA_PATH="homebrew-tap/Formula/${packageName}.rb"`,
              "          mkdir -p \"$(dirname \"${FORMULA_PATH}\")\"",
              "          cat > \"${FORMULA_PATH}\" <<EOF",
              `          class ${formulaClassName} < Formula`,
              `            desc ${JSON.stringify(context.packageJson?.description ?? "")}`,
              `            homepage ${JSON.stringify(githubRepository ? `https://github.com/${githubRepository}` : "")}`,
              `            url "https://registry.npmjs.org/${packageName}/-/${packageName}-${"${VERSION}"}.tgz"`,
              "            sha256 \"${SHA256}\"",
              `            license ${JSON.stringify(context.packageJson?.license ?? "MIT")}`,
              "",
              "            depends_on \"node\"",
              "",
              "            def install",
              "              libexec.install Dir[\"package/*\"]",
              ...executableNames.map((name) => `              bin.install_symlink libexec/"${executablePath}" => "${name}"`),
              "            end",
              "",
              "            test do",
              `              assert_match ${JSON.stringify(executableNames[0])}, shell_output("#{bin}/${executableNames[0]} --help")`,
              "            end",
              "          end",
              "          EOF",
              "      - name: Commit and push Homebrew tap changes",
              "        working-directory: homebrew-tap",
              "        run: |",
              "          git config user.name \"github-actions[bot]\"",
              "          git config user.email \"41898282+github-actions[bot]@users.noreply.github.com\"",
              `          git add Formula/${packageName}.rb`,
              "          if git diff --cached --quiet; then",
              "            echo \"No Homebrew formula changes to commit.\"",
              "            exit 0",
              "          fi",
              "          git commit -m \"gitxplain ${GITHUB_REF_NAME}\"",
              "          git push"
            ].join("\n")
          : "",
        packaging.deb
          ? [
              "      - name: Create GitHub release and upload Debian package",
              "        uses: softprops/action-gh-release@v2",
              "        with:",
              "          files: ${{ steps.meta.outputs.deb_path }}"
            ].join("\n")
          : "",
        packaging.aur
          ? [
              "      - name: Print AUR update instructions",
              "        run: |",
              "          VERSION=\"${{ steps.meta.outputs.version }}\"",
              "          SHA256=\"${{ steps.npm.outputs.sha256 }}\"",
              "          echo \"Manual AUR update steps:\"",
              "          echo \"1. Update packaging/aur/PKGBUILD with pkgver=${VERSION} and sha256sums=('${SHA256}').\"",
              "          echo \"2. Run: makepkg --printsrcinfo > .SRCINFO\"",
              "          echo \"3. Commit PKGBUILD and .SRCINFO to the AUR git repository and push.\""
            ].join("\n")
          : ""
      ]
        .filter(Boolean)
        .join("\n")
        .concat("\n");
    }

    return [
      "name: Release",
      "",
      "on:",
      "  push:",
      "    tags:",
      "      - 'v*'",
      "",
      "jobs:",
      "  publish:",
      "    runs-on: ubuntu-latest",
      "    permissions:",
      "      contents: read",
      "    steps:",
      "      - name: Checkout",
      "        uses: actions/checkout@v4",
      buildNodeReleaseSetup(context),
      context.commands.test ? formatRunStep("Test", context.commands.test) : "",
      context.commands.build ? formatRunStep("Build", context.commands.build) : "",
      "      - name: Publish to npm",
      "        env:",
      "          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}",
      "        run: npm publish"
    ]
      .filter(Boolean)
      .join("\n")
      .concat("\n");
  }

  if (context.type === "python") {
    return [
      "name: Release",
      "",
      "on:",
      "  push:",
      "    tags:",
      "      - 'v*'",
      "",
      "jobs:",
      "  publish:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Checkout",
      "        uses: actions/checkout@v4",
      "      - name: Setup Python",
      "        uses: actions/setup-python@v5",
      "        with:",
      "          python-version: '3.12'",
      "      - name: Install build tools",
      "        run: python -m pip install build twine",
      "      - name: Build package",
      "        run: python -m build",
      "      - name: Publish to PyPI",
      "        env:",
      "          TWINE_USERNAME: __token__",
      "          TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}",
      "        run: python -m twine upload dist/*"
    ].join("\n").concat("\n");
  }

  return [
    "name: Release",
    "",
    "on:",
    "  push:",
    "    tags:",
    "      - 'v*'",
    "",
    "jobs:",
    "  publish:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - name: Checkout",
    "        uses: actions/checkout@v4",
    "      - name: Install Rust toolchain",
    "        uses: dtolnay/rust-toolchain@stable",
    "      - name: Publish to crates.io",
    "        env:",
    "          CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}",
    "        run: cargo publish --locked"
  ].join("\n").concat("\n");
}

export function buildContainerWorkflow() {
  return [
    "name: Container",
    "",
    "on:",
    "  push:",
    "    branches: [main, master]",
    "    tags:",
    "      - 'v*'",
    "  pull_request:",
    "",
    "jobs:",
    "  docker:",
    "    runs-on: ubuntu-latest",
    "    permissions:",
    "      contents: read",
    "      packages: write",
    "    steps:",
    "      - name: Checkout",
    "        uses: actions/checkout@v4",
    "      - name: Log in to GHCR",
    "        if: github.event_name != 'pull_request'",
    "        uses: docker/login-action@v3",
    "        with:",
    "          registry: ghcr.io",
    "          username: ${{ github.actor }}",
    "          password: ${{ secrets.GITHUB_TOKEN }}",
    "      - name: Extract metadata",
    "        id: meta",
    "        uses: docker/metadata-action@v5",
    "        with:",
    "          images: ghcr.io/${{ github.repository }}",
    "      - name: Build and push image",
    "        uses: docker/build-push-action@v6",
    "        with:",
    "          context: .",
    "          push: ${{ github.event_name != 'pull_request' }}",
    "          tags: ${{ steps.meta.outputs.tags }}",
    "          labels: ${{ steps.meta.outputs.labels }}"
  ].join("\n").concat("\n");
}

function buildPipelineCommands(context) {
  return [context.commands.install, context.commands.lint, context.commands.test, context.commands.build, context.commands.pack]
    .filter(Boolean);
}

export function buildGitLabCiWorkflow(context) {
  const commands = buildPipelineCommands(context);
  const image =
    context.type === "python"
      ? "python:3.12"
      : context.type === "go"
        ? "golang:1.22"
        : context.type === "rust"
          ? "rust:latest"
          : "node:20";

  return [
    `image: ${image}`,
    "",
    "stages:",
    "  - verify",
    "",
    "verify:",
    "  stage: verify",
    "  script:",
    ...commands.map((command) => `    - ${command}`)
  ].join("\n").concat("\n");
}

export function buildCircleCiWorkflow(context) {
  const image =
    context.type === "python"
      ? "cimg/python:3.12"
      : context.type === "go"
        ? "cimg/go:1.22"
        : context.type === "rust"
          ? "cimg/rust:1.83"
          : "cimg/node:20.10";
  const commands = buildPipelineCommands(context);

  return [
    "version: 2.1",
    "",
    "jobs:",
    "  verify:",
    "    docker:",
    `      - image: ${image}`,
    "    steps:",
    "      - checkout",
    ...commands.map((command) => `      - run: ${command}`),
    "",
    "workflows:",
    "  verify:",
    "    jobs:",
    "      - verify"
  ].join("\n").concat("\n");
}

export function buildBitbucketPipelinesWorkflow(context) {
  const image =
    context.type === "python"
      ? "python:3.12"
      : context.type === "go"
        ? "golang:1.22"
        : context.type === "rust"
          ? "rust:latest"
          : "node:20";
  const commands = buildPipelineCommands(context);

  return [
    `image: ${image}`,
    "",
    "pipelines:",
    "  default:",
    "    - step:",
    "        name: Verify",
    "        script:",
    ...commands.map((command) => `          - ${command}`)
  ].join("\n").concat("\n");
}

export function writePipelineFiles(cwd, analysis, selection) {
  if (!analysis.supported) {
    throw new Error(analysis.reason);
  }

  const workflowDir = path.join(cwd, WORKFLOW_DIR);
  mkdirSync(workflowDir, { recursive: true });

  const writtenFiles = [];
  const notes = [];

  const writeWorkflow = (relativePath, contents) => {
    const absolutePath = path.join(cwd, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
    writtenFiles.push(relativePath);
  };

  if (selection.id === "ci" || selection.id === "ci-release") {
    writeWorkflow(".github/workflows/ci.yml", buildCiWorkflow(analysis.primary));
  }

  if (selection.id === "ci-release") {
    writeWorkflow(".github/workflows/release.yml", buildReleaseWorkflow(analysis.primary));

    if (analysis.primary.release.type === "npm") {
      notes.push("Add an `NPM_TOKEN` repository secret before pushing a release tag.");
      if (analysis.primary.packaging?.homebrew) {
        notes.push("Add a `HOMEBREW_TAP_TOKEN` repository secret so CI can update your tap repository.");
      }
      if (analysis.primary.packaging?.aur) {
        notes.push("AUR updates are still manual. The generated release workflow prints the exact PKGBUILD and .SRCINFO refresh steps.");
      }
    } else if (analysis.primary.release.type === "pypi") {
      notes.push("Add a `PYPI_TOKEN` repository secret before pushing a release tag.");
    } else if (analysis.primary.release.type === "crates") {
      notes.push("Add a `CARGO_REGISTRY_TOKEN` repository secret before pushing a release tag.");
    }
  }

  if (selection.id === "container") {
    writeWorkflow(".github/workflows/container.yml", buildContainerWorkflow());
  }

  if (selection.id === "gitlab-ci") {
    writeWorkflow(".gitlab-ci.yml", buildGitLabCiWorkflow(analysis.primary));
  }

  if (selection.id === "circleci") {
    writeWorkflow(".circleci/config.yml", buildCircleCiWorkflow(analysis.primary));
  }

  if (selection.id === "bitbucket-pipelines") {
    writeWorkflow("bitbucket-pipelines.yml", buildBitbucketPipelinesWorkflow(analysis.primary));
  }

  if (selection.id === "container" && !selection.files.includes(".github/workflows/ci.yml")) {
    notes.push("This option only creates the container workflow. Run `gitxplain --pipeline` again if you also want CI verification.");
  }

  return { writtenFiles, notes };
}
