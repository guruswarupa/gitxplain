import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildBitbucketPipelinesWorkflow,
  buildCiWorkflow,
  buildCircleCiWorkflow,
  buildGitLabCiWorkflow,
  formatPipelineRecommendations,
  inspectRepositoryForPipeline,
  resolvePipelineSelection,
  writePipelineFiles
} from "../cli/services/pipelineService.js";

function createTempRepo() {
  return mkdtempSync(path.join(os.tmpdir(), "gitxplain-pipeline-"));
}

test("inspectRepositoryForPipeline detects a node repository and release support", () => {
  const cwd = createTempRepo();

  try {
    writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "demo-cli",
          version: "1.0.0",
          scripts: {
            lint: "node --check index.js",
            test: "node --test",
            build: "node build.js"
          }
        },
        null,
        2
      )
    );
    writeFileSync(path.join(cwd, "package-lock.json"), "{}");

    const analysis = inspectRepositoryForPipeline(cwd);

    assert.equal(analysis.supported, true);
    assert.equal(analysis.primary.type, "node");
    assert.equal(analysis.primary.packageManager, "npm");
    assert.equal(analysis.primary.commands.lint, "npm run lint");
    assert.equal(analysis.primary.commands.test, "npm test");
    assert.equal(analysis.primary.commands.build, "npm run build");
    assert.equal(analysis.primary.commands.pack, "npm pack --dry-run");
    assert.equal(analysis.options.some((option) => option.id === "ci-release"), true);
    assert.equal(analysis.options.some((option) => option.id === "gitlab-ci"), true);
    assert.equal(analysis.options.some((option) => option.id === "circleci"), true);
    assert.equal(analysis.options.some((option) => option.id === "bitbucket-pipelines"), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("inspectRepositoryForPipeline detects an Android Gradle repository", () => {
  const cwd = createTempRepo();

  try {
    writeFileSync(path.join(cwd, "settings.gradle.kts"), 'rootProject.name = "launch"\ninclude(":app")\n');
    writeFileSync(path.join(cwd, "build.gradle.kts"), "plugins {}\n");
    writeFileSync(path.join(cwd, "gradlew"), "#!/bin/sh\n");
    mkdirSync(path.join(cwd, "app"), { recursive: true });
    writeFileSync(
      path.join(cwd, "app", "build.gradle.kts"),
      [
        "plugins {",
        "  alias(libs.plugins.android.application)",
        "  alias(libs.plugins.kotlin.android)",
        "}",
        "",
        "android {",
        '  namespace = "com.example.launch"',
        "}"
      ].join("\n"),
      "utf8"
    );

    const analysis = inspectRepositoryForPipeline(cwd);

    assert.equal(analysis.supported, true);
    assert.equal(analysis.primary.type, "gradle-android");
    assert.equal(analysis.primary.commands.lint, "./gradlew :app:lintDebug");
    assert.equal(analysis.primary.commands.test, "./gradlew :app:testDebugUnitTest");
    assert.equal(analysis.primary.commands.build, "./gradlew :app:assembleDebug");
    assert.equal(analysis.options.some((option) => option.id === "ci"), true);
    assert.equal(analysis.options.some((option) => option.id === "ci-release"), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("buildCiWorkflow includes detected node verification commands", () => {
  const workflow = buildCiWorkflow({
    type: "node",
    packageManager: "npm",
    nodeVersion: {
      source: "value",
      value: "20"
    },
    commands: {
      install: "npm ci",
      lint: "npm run lint",
      test: "npm test",
      build: "npm run build",
      pack: "npm pack --dry-run"
    }
  });

  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /run: npm pack --dry-run/);
  assert.match(workflow, /npm_config_cache/);
});

test("alternative CI builders generate expected config files", () => {
  const context = {
    type: "node",
    packageManager: "npm",
    nodeVersion: { source: "value", value: "20" },
    commands: {
      install: "npm ci",
      lint: "npm run lint",
      test: "npm test",
      build: "npm run build",
      pack: null
    }
  };

  assert.match(buildGitLabCiWorkflow(context), /image: node:20/);
  assert.match(buildCircleCiWorkflow(context), /version: 2\.1/);
  assert.match(buildBitbucketPipelinesWorkflow(context), /pipelines:/);
});

test("resolvePipelineSelection accepts numeric answers", () => {
  const selection = resolvePipelineSelection(
    {
      options: [
        { id: "ci", label: "CI" },
        { id: "ci-release", label: "Release" }
      ]
    },
    "2"
  );

  assert.deepEqual(selection, { id: "ci-release", label: "Release" });
});

test("writePipelineFiles creates ci and release workflows", () => {
  const cwd = createTempRepo();

  try {
    writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "demo-cli",
          version: "1.0.0",
          scripts: {
            test: "node --test"
          }
        },
        null,
        2
      )
    );
    writeFileSync(path.join(cwd, "package-lock.json"), "{}");

    const analysis = inspectRepositoryForPipeline(cwd);
    const selection = analysis.options.find((option) => option.id === "ci-release");
    const result = writePipelineFiles(cwd, analysis, selection);

    assert.deepEqual(result.writtenFiles, [
      ".github/workflows/ci.yml",
      ".github/workflows/release.yml"
    ]);
    assert.equal(result.notes.includes("Add an `NPM_TOKEN` repository secret before pushing a release tag."), true);

    const ciWorkflow = readFileSync(path.join(cwd, ".github/workflows/ci.yml"), "utf8");
    const releaseWorkflow = readFileSync(path.join(cwd, ".github/workflows/release.yml"), "utf8");

    assert.match(ciWorkflow, /name: CI/);
    assert.match(ciWorkflow, /run: npm test/);
    assert.match(releaseWorkflow, /name: Release/);
    assert.match(releaseWorkflow, /NODE_AUTH_TOKEN/);
    assert.match(releaseWorkflow, /npm publish/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("writePipelineFiles creates packaging-aware release workflow for node CLI repos", () => {
  const cwd = createTempRepo();

  try {
    execFileSync("git", ["init"], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"]
    });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:demo/gitxplain.git"], {
      cwd,
      stdio: ["ignore", "ignore", "ignore"]
    });

    writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "gitxplain",
          version: "1.0.0",
          description: "AI-powered Git commit explainer CLI",
          license: "MIT",
          bin: {
            gitxplain: "./cli/index.js",
            gitxplore: "./cli/index.js"
          },
          scripts: {
            test: "node --test"
          }
        },
        null,
        2
      )
    );
    writeFileSync(path.join(cwd, "package-lock.json"), "{}");
    mkdirSync(path.join(cwd, "scripts"), { recursive: true });
    writeFileSync(path.join(cwd, "scripts", "build-deb.sh"), "#!/usr/bin/env bash\n");
    mkdirSync(path.join(cwd, "packaging", "homebrew-tap", "Formula"), { recursive: true });
    writeFileSync(path.join(cwd, "packaging", "homebrew-tap", "Formula", "gitxplain.rb"), "class Gitxplain < Formula\nend\n");
    mkdirSync(path.join(cwd, "packaging", "aur"), { recursive: true });
    writeFileSync(path.join(cwd, "packaging", "aur", "PKGBUILD"), "pkgname=gitxplain\n");

    const analysis = inspectRepositoryForPipeline(cwd);
    const selection = analysis.options.find((option) => option.id === "ci-release");
    const result = writePipelineFiles(cwd, analysis, selection);
    const releaseWorkflow = readFileSync(path.join(cwd, ".github/workflows/release.yml"), "utf8");

    assert.equal(
      result.notes.includes("Add an `NPM_TOKEN` repository secret before pushing a release tag."),
      true
    );
    assert.equal(
      result.notes.includes("Add a `HOMEBREW_TAP_TOKEN` repository secret so CI can update your tap repository."),
      true
    );
    assert.equal(
      result.notes.includes("AUR updates are still manual. The generated release workflow prints the exact PKGBUILD and .SRCINFO refresh steps."),
      true
    );
    assert.match(releaseWorkflow, /run: \.\/scripts\/build-deb\.sh/);
    assert.match(releaseWorkflow, /HOMEBREW_TAP_TOKEN/);
    assert.match(releaseWorkflow, /repository: demo\/homebrew-tap/);
    assert.match(releaseWorkflow, /softprops\/action-gh-release@v2/);
    assert.match(releaseWorkflow, /Manual AUR update steps:/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("formatPipelineRecommendations shows available options clearly", () => {
  const output = formatPipelineRecommendations({
    supported: true,
    primary: {
      type: "node",
      displayName: "demo-cli",
      packageManager: "npm",
      commands: {
        lint: "npm run lint",
        test: "npm test",
        build: null
      }
    },
    existingWorkflows: [],
    options: [
      {
        id: "ci",
        label: "GitHub Actions CI verification",
        description: "Runs checks.",
        files: [".github/workflows/ci.yml"]
      }
    ]
  });

  assert.match(output, /Detected project type: node/);
  assert.match(output, /Available pipeline options:/);
  assert.match(output, /1\. GitHub Actions CI verification/);
});

test("writePipelineFiles creates GitLab CI and CircleCI files", () => {
  const cwd = createTempRepo();

  try {
    writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify({ name: "demo-cli", scripts: { test: "node --test" } }, null, 2)
    );
    writeFileSync(path.join(cwd, "package-lock.json"), "{}");

    const analysis = inspectRepositoryForPipeline(cwd);
    writePipelineFiles(cwd, analysis, analysis.options.find((option) => option.id === "gitlab-ci"));
    writePipelineFiles(cwd, analysis, analysis.options.find((option) => option.id === "circleci"));

    assert.match(readFileSync(path.join(cwd, ".gitlab-ci.yml"), "utf8"), /stages:/);
    assert.match(readFileSync(path.join(cwd, ".circleci", "config.yml"), "utf8"), /workflows:/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
