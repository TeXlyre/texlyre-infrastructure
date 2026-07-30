const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const REGISTRY_PREFIX = 'ghcr.io/';
const DEFAULT_PLATFORMS = ['linux/amd64'];

function normalizeBuild(build) {
	return typeof build === 'string' ? { context: build } : build;
}

function normalizeArgs(args) {
	if (!args) return [];
	if (Array.isArray(args)) return args;
	return Object.entries(args).map(([key, value]) => `${key}=${value}`);
}

function dockerfileFor(build) {
	if (!build.dockerfile) return path.posix.join(build.context, 'Dockerfile');
	if (path.posix.isAbsolute(build.dockerfile)) return build.dockerfile;
	if (build.context === '.' || build.context === './') return build.dockerfile;
	return path.posix.join(build.context, build.dockerfile);
}

function collect(composeFile) {
	const compose = yaml.load(fs.readFileSync(composeFile, 'utf8'));
	const include = [];

	for (const [name, service] of Object.entries(compose.services ?? {})) {
		const publish = service['x-publish'];

		if (!publish || !service.image || !service.build) continue;
		if (!service.image.startsWith(REGISTRY_PREFIX)) continue;

		const build = normalizeBuild(service.build);

		if (!build.context) {
			throw new Error(`Service "${name}" has x-publish but no build context`);
		}

		include.push({
			name,
			image: service.image,
			context: build.context,
			dockerfile: dockerfileFor(build),
			source: publish.source ?? build.context,
			args: normalizeArgs(build.args).join('\n'),
			platforms: (publish.platforms ?? DEFAULT_PLATFORMS).join(','),
		});
	}

	return include;
}

const composeFile = process.argv[2] ?? 'docker-compose.yml';
const include = collect(composeFile);

if (include.length === 0) {
	console.error(`No publishable services found in ${composeFile}`);
	process.exit(1);
}

process.stdout.write(`matrix=${JSON.stringify({ include })}\n`);
