const { execFileSync } = require('node:child_process');

function usage() {
	console.log(`Usage: scripts/sync-submodule-tags.cjs [--check] [SUBMODULE ...]

Checks out each submodule at the Git tag declared by its "tag" entry in
.gitmodules and stages the resulting commit. With no arguments, every submodule
declaring a tag is processed; submodules without one are left alone. Arguments
match against submodule paths.

  --check   report submodules whose recorded commit does not match their tag,
            then exit 1 without modifying the working tree`);
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

function declaredSubmodules() {
	const listed = tryGit([
		'config',
		'-f',
		'.gitmodules',
		'--get-regexp',
		'\\.tag$',
	]);
	if (!listed) return [];

	return listed
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const separator = line.indexOf(' ');
			const key = line.slice(0, separator);
			const tag = line.slice(separator + 1).trim();
			const path = tryGit([
				'config',
				'-f',
				'.gitmodules',
				'--get',
				`${key.slice(0, -4)}.path`,
			]);

			if (!path)
				throw new Error(
					`No path recorded for "${key.slice(0, -4)}" in .gitmodules`,
				);
			return { path, tag };
		});
}

function tagCommit(path, tag) {
	const commit = tryGit(['rev-parse', `refs/tags/${tag}^{commit}`], path);
	if (!commit) throw new Error(`Submodule "${path}" has no tag "${tag}"`);
	return commit;
}

function recordedCommit(path) {
	const commit = tryGit(['rev-parse', `:${path}`]);
	if (!commit)
		throw new Error(`Submodule "${path}" is not tracked in the index`);
	return commit;
}

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
	usage();
	process.exit(0);
}

const check = args.includes('--check');
const selected = args.filter((arg) => arg !== '--check');

try {
	const declared = declaredSubmodules();
	const submodules =
		selected.length > 0
			? declared.filter((entry) => selected.includes(entry.path))
			: declared;

	if (submodules.length === 0) {
		console.error(
			'sync-submodule-tags: no submodules declare a tag in .gitmodules',
		);
		process.exit(1);
	}

	for (const name of selected) {
		if (!submodules.some((entry) => entry.path === name)) {
			throw new Error(`Submodule "${name}" declares no tag in .gitmodules`);
		}
	}

	let changed = false;

	for (const { path, tag } of submodules) {
		if (!tryGit(['rev-parse', '--git-dir'], path)) {
			throw new Error(
				`Submodule "${path}" is not checked out, run "git submodule update --init --recursive"`,
			);
		}

		tryGit(['fetch', '--tags', '--quiet', 'origin'], path);

		const wanted = tagCommit(path, tag);
		const recorded = recordedCommit(path);
		const head = tryGit(['rev-parse', 'HEAD'], path);

		if (recorded === wanted && head === wanted) {
			console.log(`${path}: already at ${tag}`);
			continue;
		}

		changed = true;
		console.log(
			`${path}: ${recorded.slice(0, 12)} -> ${tag} (${wanted.slice(0, 12)})`,
		);

		if (!check) {
			git(['checkout', '--quiet', `refs/tags/${tag}`], path);
			git(['add', '--', path]);
		}
	}

	if (check && changed) process.exit(1);
} catch (error) {
	console.error(`sync-submodule-tags: ${error.message}`);
	process.exit(1);
}
