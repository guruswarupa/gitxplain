import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
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

  return {
    type: "node",
    displayName: packageJson.name || path.basename(cwd),
    packageManager,
    packageJson,
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
  const primary = node ?? python ?? go ?? rust;

  if (!primary) {
    return {
      supported: false,
      reason: "No supported Node, Python, Go, or Rust project files were detected.",
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
    }
  ];

  if (primary.release.supported) {
    options.push({
      id: "ci-release",
      label: `CI plus ${primary.release.type} release automation`,
      description:
        primary.type === "node"
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
    return [
      "name: Release",
      "",
      "on:",
      "  push:",
      "    tags:",
      "      - 'v*.*.*'",
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
      "      - 'v*.*.*'",
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
    "      - 'v*.*.*'",
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
    "      - 'v*.*.*'",
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
    } else if (analysis.primary.release.type === "pypi") {
      notes.push("Add a `PYPI_TOKEN` repository secret before pushing a release tag.");
    } else if (analysis.primary.release.type === "crates") {
      notes.push("Add a `CARGO_REGISTRY_TOKEN` repository secret before pushing a release tag.");
    }
  }

  if (selection.id === "container") {
    writeWorkflow(".github/workflows/container.yml", buildContainerWorkflow());
  }

  if (selection.id === "container" && !selection.files.includes(".github/workflows/ci.yml")) {
    notes.push("This option only creates the container workflow. Run `gitxplain pipeline` again if you also want CI verification.");
  }

  return { writtenFiles, notes };
}
