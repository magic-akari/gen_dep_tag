import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { jsdelivr, type CDN } from "./cdn.js";
import { sri } from "./sri.js";

export * from "./cdn.js";
export * from "./presets.js";

function pkgVersion(pkgName: string): string {
	return pkgJson(pkgName).version || "";
}

function pkgJson(pkgName: string) {
	const pkgFile = pkgPath(pkgName, "package.json");
	return JSON.parse(fs.readFileSync(pkgFile, "utf8"));
}

function pkgPath(pkgName: string, ...subPath: string[]) {
	const pwd = process.cwd();
	return path.join(pwd, "node_modules", pkgName, ...subPath);
}

function resolveEntry(pkgName: string): string {
	const package_json = pkgJson(pkgName);

	if (package_json.unpkg) {
		return package_json.unpkg;
	}

	if (package_json.jsdelivr) {
		return package_json.jsdelivr;
	}

	if (typeof package_json.browser === "string") {
		return package_json.browser;
	}

	if (package_json.main) {
		return package_json.main;
	}

	throw Error(`Cannot resolve entry for package ${pkgName}`);
}

function tag(packageName: string, algorithm: string | boolean, filePath?: string) {
	let file_path = filePath || resolveEntry(packageName);
	if (file_path.startsWith("./")) {
		file_path = file_path.slice(2);
	}

	const local_path = pkgPath(packageName, file_path);
	const version = pkgVersion(packageName);
	let integrity = "";

	if (algorithm) {
		integrity = sri(local_path, "sha256");
	}

	return {
		version,
		path: file_path,
		integrity,
	};
}

type Algorithm = "sha256" | "sha384" | "sha512" | (string & {});

interface Source {
	name: string;
	/**
	 * path of the file relative to the package root
	 * usually the `main` field in package.json
	 */
	entry?: string;
}

type UrlOnly = {
	url: string;
};

type UrlAndIntegrity = {
	url: string;
	integrity: string;
};

type ReturnFn = (source: Source | string) => UrlOnly;
type ReturnFnWithSri = (source: Source | string) => UrlAndIntegrity;

export function tagBuilder(config: { sri: Algorithm | true; cdn?: CDN }): ReturnFnWithSri;
export function tagBuilder(config?: { sri?: undefined | false; cdn?: CDN }): ReturnFn;
export function tagBuilder(config?: any): ReturnFn | ReturnFnWithSri {
	const algorithm = config?.sri || false;
	const cdn = config?.cdn || jsdelivr;

	return (source: Source | string) => {
		let name: string, entry: string | undefined;

		if (typeof source === "string") {
			name = source;
		} else {
			name = source.name;
			entry = source.entry;
		}

		const { version, path, integrity } = tag(name, algorithm, entry);

		const url = cdn(name, version, path);

		if (algorithm) {
			return { url } as UrlOnly;
		} else {
			return { url, integrity } as UrlAndIntegrity;
		}
	};
}
