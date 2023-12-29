import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { jsdelivr, type CDN } from "./cdn.js";
import { sri } from "./sri.js";

export * from "./cdn.js";

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

	if (package_json.browser) {
		return package_json.browser;
	}

	if (package_json.main) {
		return package_json.main;
	}

	throw Error(`Cannot resolve entry for package ${pkgName}`);
}

function tag(
	packageName: string,
	algorithm: string | boolean,
	filePath?: string
) {
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
		name: packageName,
		version,
		path: file_path,
		integrity,
	};
}

type Algorithm = "sha256" | "sha384" | "sha512" | (string & {});

type Config =
	| {
			sri: Algorithm | true;
			cdn?: CDN;
	  }
	| { sri?: false; cdn?: CDN };

type ResultType<T> = T extends { sri: string | true }
	? { url: string; integrity: string }
	: { url: string };

export function tagBuilder<T extends Config>(config: T) {
	const algorithm = config.sri || false;
	const cdn = config.cdn || jsdelivr;

	return (packageName: string, filePath?: string): ResultType<T> => {
		const { name, version, path, integrity } = tag(
			packageName,
			algorithm,
			filePath
		);

		const url = cdn(name, version, path);

		if (algorithm) {
			return { url } as ResultType<T>;
		} else {
			return { url, integrity } as ResultType<T>;
		}
	};
}
