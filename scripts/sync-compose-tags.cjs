const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

function usage() {
	console.log(`Usage: scripts/sync-compose-tags.cjs [--check] [COMPOSE_FILE ...]

Updates buildable service image tags to match the Git tag declared for the source
submodule in .gitmodules, or the exact tag checked out when the source is not a
submodule. With no file arguments, all docker-compose*.yml/yaml files in the
repository root are inspected. A leading "v" is removed from semantic version tags
(v1.2.3 -> 1.2.3), and other invalid Docker tag characters become hyphens.`);
}

function defaultComposeFiles() {
	return fs
		.readdirSync(process.cwd())
		.filter((name) => /^docker-compose(?:\..+)?\.ya?ml$/i.test(name))
		.sort();
}

function git(args, cwd) {
	return execFileSync('git', args, {
		cwd,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();
}

function tryGit(args, cwd) {
	try {
		return git(args, cwd);
	} catch {
		return null;
	}
}

function declaredTags() {
	const tags = new Map();
	const listed = tryGit([
		'config',
		'-f',
		'.gitmodules',
		'--get-regexp',
		'\\.tag$',
	]);

	if (!listed) return tags;

	for (const line of listed.split('\n').filter(Boolean)) {
		const separator = line.indexOf(' ');
		const key = line.slice(0, separator);
		const tag = line.slice(separator + 1).trim();
		const submodulePath = tryGit([
			'config',
			'-f',
			'.gitmodules',
			'--get',
			`${key.slice(0, -4)}.path`,
		]);

		if (submodulePath) tags.set(path.posix.normalize(submodulePath), tag);
	}

	return tags;
}

const DECLARED_TAGS = declaredTags();

function normalizeBuild(build) {
	return typeof build === 'string' ? { context: build } : (build ?? {});
}

function exactGitTag(source, sourceValue) {
	const declared = DECLARED_TAGS.get(path.posix.normalize(sourceValue));

	if (declared) {
		const tagged = tryGit(
			['rev-parse', `refs/tags/${declared}^{commit}`],
			source,
		);
		const head = tryGit(['rev-parse', 'HEAD'], source);

		if (tagged && tagged === head) return declared;

		throw new Error(`Source "${sourceValue}" is not checked out at "${declared}"`);
	}

	const described = tryGit(['describe', '--tags', '--exact-match', 'HEAD'], source);

	if (!described) {
		throw new Error(`Source "${sourceValue}" is not checked out at an exact Git tag`);
	}

	return described;
}

function dockerTagFor(gitTag) {
	let tag = gitTag.replace(/^refs\/tags\//, '');
	if (/^v\d/.test(tag)) tag = tag.slice(1);

	tag = tag
		.replace(/[^A-Za-z0-9_.-]+/g, '-')
		.replace(/^[.-]+/, '')
		.replace(/-+/g, '-');

	if (!tag)
		throw new Error(`Git tag "${gitTag}" cannot be converted to a Docker tag`);
	if (tag.length > 128) tag = tag.slice(0, 128);
	return tag;
}

function withImageTag(image, tag) {
	if (image.includes('@')) {
		throw new Error(`Digest-pinned image cannot be retagged: ${image}`);
	}

	const slash = image.lastIndexOf('/');
	const colon = image.lastIndexOf(':');
	const repository = colon > slash ? image.slice(0, colon) : image;
	return `${repository}:${tag}`;
}

function serviceUpdates(composeFile, compose) {
	const updates = new Map();
	const directory = path.dirname(path.resolve(composeFile));

	for (const [name, service] of Object.entries(compose.services ?? {})) {
		const publish = service?.['x-publish'];
		if (!publish || !service.image || !service.build) continue;

		const build = normalizeBuild(service.build);
		const sourceValue = publish.source ?? build.context;
		if (!sourceValue) {
			throw new Error(
				`Service "${name}" has x-publish but no source or build context`,
			);
		}

		const source = path.resolve(directory, sourceValue);
		const gitTag = exactGitTag(source, sourceValue);
		const imageTag = dockerTagFor(gitTag);
		const image = withImageTag(service.image, imageTag);

		if (image !== service.image) updates.set(name, { image, gitTag });
	}

	return updates;
}

function replaceImageLines(content, updates, composeFile) {
	if (updates.size === 0) return content;

	const lines = content.split(/(?<=\n)/);
	let inServices = false;
	let currentService = null;
	const applied = new Set();

	for (let index = 0; index < lines.length; index += 1) {
		const raw = lines[index];
		const line = raw.replace(/\r?\n$/, '');

		if (/^services:\s*(?:#.*)?$/.test(line)) {
			inServices = true;
			currentService = null;
			continue;
		}
		if (inServices && /^\S/.test(line) && !/^services:/.test(line)) {
			inServices = false;
			currentService = null;
		}
		if (!inServices) continue;

		const serviceMatch = line.match(/^ {2}([^\s#][^:]*):\s*(?:#.*)?$/);
		if (serviceMatch) {
			currentService = serviceMatch[1].trim();
			continue;
		}

		const update = currentService ? updates.get(currentService) : null;
		if (!update) continue;

		const imageMatch = line.match(
			/^(\s{4}image:\s*)(["']?)([^\s#"']+)\2(\s*(?:#.*)?)$/,
		);
		if (!imageMatch) continue;

		const newline = raw.endsWith('\r\n')
			? '\r\n'
			: raw.endsWith('\n')
				? '\n'
				: '';
		lines[index] =
			`${imageMatch[1]}${imageMatch[2]}${update.image}${imageMatch[2]}${imageMatch[4]}${newline}`;
		applied.add(currentService);
	}

	for (const service of updates.keys()) {
		if (!applied.has(service)) {
			throw new Error(
				`Could not locate image line for service "${service}" in ${composeFile}`,
			);
		}
	}

	return lines.join('');
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
	usage();
	process.exit(0);
}

const check = args.includes('--check');
const files = args.filter((arg) => arg !== '--check');
const composeFiles = files.length > 0 ? files : defaultComposeFiles();

if (composeFiles.length === 0) {
	console.error('sync-compose-tags: no Compose files found');
	process.exit(1);
}

let changed = false;

for (const composeFile of composeFiles) {
	const original = fs.readFileSync(composeFile, 'utf8');
	const compose = yaml.load(original);
	const updates = serviceUpdates(composeFile, compose);
	const next = replaceImageLines(original, updates, composeFile);

	if (next === original) {
		console.log(`${composeFile}: already synchronized`);
		continue;
	}

	changed = true;
	for (const [service, update] of updates) {
		console.log(
			`${composeFile}: ${service} -> ${update.image} (${update.gitTag})`,
		);
	}

	if (!check) fs.writeFileSync(composeFile, next);
}

if (check && changed) process.exit(1);
