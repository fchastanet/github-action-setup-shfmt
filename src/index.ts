/**
 * Copyright 2021 Mario Finelli
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as https from "https";
import * as io from "@actions/io";
import * as os from "os";
import * as tc from "@actions/tool-cache";
import * as semver from "semver";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import { extractVersionFromUrl } from "./util";

const URL_BASE = "https://github.com/mvdan/sh";

async function getLatestVersionUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(`${URL_BASE}/releases/latest`, (res) => {
      const { statusCode } = res;

      if (statusCode !== 302) {
        reject(
          new Error(`Unable to get latest release (status code: ${statusCode}`),
        );
      } else if (String(res.headers["location"]) === "") {
        reject(
          new Error(
            `Unable to get latest release (location: ${res.headers["location"]})`,
          ),
        );
      } else {
        resolve(String(res.headers["location"]));
      }
    });
  });
}

function isExec(stats: fs.Stats) {
  return !!(stats.mode & fs.constants.S_IXUSR);
}

function getCurrentVersion(file: fs.PathLike): string | null {
  try {
    let stats = fs.statSync(file);
    if (stats.isFile() && isExec(stats)) {
      return execSync(`${file} --version`).toString();
    }
  } catch (err) {
    // file does not exists, ignore exception
  }
  return null;
}

function isUpdateNeeded(file: fs.PathLike, expectedVersion: string): boolean {
  const currentVersion: string | null = getCurrentVersion(file);
  if (!currentVersion) {
    core.info(
      "New version needs to be downloaded as there is no existing version of the software.",
    );
    return true;
  }
  const cleanedVersion: semver.SemVer | null = semver.coerce(currentVersion);
  if (!semver.valid(cleanedVersion)) {
    core.info(
      "New version needs to be downloaded as current software version is not readable.",
    );
    return true;
  }
  const fileVersion: semver.SemVer = cleanedVersion as semver.SemVer;
  const compareVersion = semver.compare(fileVersion, expectedVersion);
  if (compareVersion === 0) {
    core.info(
      `Version installed ${fileVersion} is the expected version ${expectedVersion}, skip the download.`,
    );
    return false;
  } else if (compareVersion === 1) {
    core.info(
      `Version installed ${fileVersion} is greater than the expected version ${expectedVersion}, skip the download.`,
    );
    return false;
  }
  core.info(
    `Version installed ${fileVersion} is lower than the expected version ${expectedVersion}, download the new version ...`,
  );
  return true;
}

function getDownloadUrl(version: string): string {
  let platform;

  if (process.platform === "win32") {
    platform = "windows";
  } else if (process.platform === "darwin") {
    platform = "darwin";
  } else {
    platform = "linux";
  }

  let artifact = `shfmt_v${version}_${platform}_amd64`;
  if (process.platform === "win32") {
    artifact += ".exe";
  }
  return `${URL_BASE}/releases/download/v${version}/${artifact}`;
}

function getBinName() {
  let binName = "shfmt";
  if (process.platform === "win32") {
    binName += ".exe";
  }
  return binName;
}

function getBinDir(): string {
  return core.getInput("shfmt-bin-dir") ?? `${os.homedir}/bin`;
}

async function ensureDirExists(dir: string) {
  await io.mkdirP(dir);
}

async function run(): Promise<void> {
  const version: string = core.getInput("shfmt-version");
  let expectedVersion: string = "";

  try {
    if (version === "latest") {
      let latestUrl = await getLatestVersionUrl();
      expectedVersion = extractVersionFromUrl(latestUrl);
      if (!semver.valid(expectedVersion)) {
        throw new Error(
          `Latest version format is invalid : '${expectedVersion}'.`,
        );
      }
      core.info(`Latest shfmt version is ${expectedVersion}`);
    } else if (semver.valid(version)) {
      expectedVersion = version;
    } else {
      throw new Error(`Version format provided ${version} is invalid.`);
    }

    const binDir: string = getBinDir();
    await ensureDirExists(binDir);
    const binName: string = getBinName();
    const binFilePath: string = `${binDir}/${binName}`;
    console.time("isUpdateNeeded");
    const updatedNeeded: boolean = isUpdateNeeded(binFilePath, expectedVersion);
    console.timeEnd("isUpdateNeeded");
    if (updatedNeeded) {
      console.time("downloadTool");
      const shfmtTempPath: string = await tc.downloadTool(
        getDownloadUrl(expectedVersion),
      );
      console.timeEnd("downloadTool");
      await io.mv(shfmtTempPath, binFilePath);
      exec.exec("chmod", ["+x", binFilePath]);
      core.addPath(binDir);
      core.info(`${binFilePath} updated to version ${expectedVersion}.`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("action failed and didn't return an error type!");
    }
  }
}

run();
