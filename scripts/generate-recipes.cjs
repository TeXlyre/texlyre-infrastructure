const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const COMPOSE_FILE = 'docker-compose.recipes.yml';
const USERDATA_FILE = 'frontend/userdata.overrides/recipes.json';
const DEFAULT_REGISTRY = 'https://texlyre.github.io/chelys-recipes';
const SOURCE_REPOSITORY = 'https://github.com/TeXlyre/chelys-recipes.git';
const SOURCE_REF = 'main';
const REGISTRY_IMAGE = /^[^/]+[.:][^/]*\//;
const BLOCK_SUFFIX = '-server';

const SETTING_KEYS = {
	lsp: 'generic-lsp-configs',
	typesetter: 'generic-typesetter-configs',
};

function selection() {
	const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
	const source = args.length > 0 ? args : [process.env.RECIPES ?? ''];

	return source.flatMap((value) => value.split(/[,\s]+/)).filter(Boolean);
}

function parseReference(reference) {
	const match =
		/^(?:([^/?@\s]+)\/)?([^/?@\s]+)(?:@([^?\s]+))?(?:\?(\S*))?$/.exec(
			reference,
		);

	if (!match) {
		throw new Error(
			`Invalid recipe "${reference}", expected "[<type>/]<id>[@<version>][?<key>=<value>]"`,
		);
	}

	return {
		type: match[1],
		id: match[2],
		version: match[3],
		variables: Object.fromEntries(new URLSearchParams(match[4] ?? '')),
	};
}

async function fetchJson(url) {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`${url} responded with ${response.status}`);
	}

	return response.json();
}

async function loadIndex(registry) {
	const api = await fetchJson(`${registry}/api/recipes.json`);
	const index = new Map();

	for (const category of api.categories ?? []) {
		for (const recipe of category.recipes ?? []) {
			index.set(recipe.id, {
				id: recipe.id,
				type: recipe.type ?? category.id,
				name: recipe.name,
				versions: recipe.versions ?? [
					{ version: recipe.version, manifestUrl: recipe.manifestUrl },
				],
			});
		}
	}

	return index;
}

function resolveReference(reference, index) {
	const listed = index.get(reference.id);

	if (!listed) {
		throw new Error(`Recipe "${reference.id}" is not in the registry`);
	}

	if (reference.type && reference.type !== listed.type) {
		throw new Error(
			`Recipe "${reference.id}" is of type "${listed.type}", not "${reference.type}"`,
		);
	}

	const version = reference.version
		? listed.versions.find((entry) => entry.version === reference.version)
		: listed.versions[0];

	if (!version) {
		throw new Error(
			`Recipe "${reference.id}" has no version "${reference.version}"`,
		);
	}

	return { ...reference, ...version, type: listed.type };
}

function resolveValues(manifest, overrides) {
	const values = {};

	for (const variable of manifest.variables ?? []) {
		values[variable.key] = variable.default ?? '';
	}

	for (const [key, value] of Object.entries(overrides)) {
		if (!(key in values)) {
			throw new Error(`Recipe "${manifest.id}" declares no variable "${key}"`);
		}
		values[key] = String(value);
	}

	return values;
}

function substitute(node, values) {
	if (typeof node === 'string') {
		return node.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, key) =>
			key in values ? values[key] : match,
		);
	}

	if (Array.isArray(node)) {
		return node.map((item) => substitute(item, values));
	}

	if (node && typeof node === 'object') {
		return Object.fromEntries(
			Object.entries(node).map(([key, value]) => [
				key,
				substitute(value, values),
			]),
		);
	}

	return node;
}

function servicePort(manifest, values) {
	const key = Object.keys(values).find((name) => /port$/i.test(name));
	const port = key ? values[key] : '';

	if (!/^\d+$/.test(port)) {
		throw new Error(
			`Recipe "${manifest.id}" declares no numeric port variable`,
		);
	}

	return port;
}

function imageSource(entry, manifest) {
	const mode = (manifest.modes ?? []).find((item) => item.kind === 'docker');

	if (!mode) {
		throw new Error(`Recipe "${manifest.id}" has no docker install mode`);
	}

	const image = typeof mode.image === 'string' ? mode.image : '';

	if (REGISTRY_IMAGE.test(image)) {
		return { image };
	}

	return {
		image: `${image.split(':')[0] || `chelys/${entry.id}`}:${entry.version}`,
		build: `${SOURCE_REPOSITORY}#${SOURCE_REF}:recipes/${entry.type}/${entry.id}/${entry.version}`,
	};
}

function transportConfig(entry, config) {
	return {
		type: 'websocket',
		url: `ws://${entry.type}.\${BASE_DOMAIN}:\${HTTP_PORT}/${entry.configId}`,
		...(config.contentLength === undefined
			? {}
			: { contentLength: config.contentLength }),
	};
}

function lspBlock(entry, manifest, config) {
	return {
		id: `${entry.configId}${BLOCK_SUFFIX}`,
		name: `${manifest.name} (server)`,
		enabled: true,
		fileExtensions: config.fileExtensions ?? [],
		languageIdMap: config.languageIdMap ?? {},
		transportConfig: transportConfig(entry, config),
		clientConfig: config.clientConfig ?? '{}',
	};
}

function typesetterBlock(entry, manifest, config) {
	return {
		id: `${entry.configId}${BLOCK_SUFFIX}`,
		name: `${manifest.name} (server)`,
		enabled: true,
		incrementalSync: config.incrementalSync,
		projectType: config.projectType,
		projectGroup: config.projectGroup,
		inputExtensions: config.inputExtensions ?? [],
		inputFiles: config.inputFiles,
		outputFormats: config.outputFormats ?? [],
		transportConfig: transportConfig(entry, config),
		capabilities: {
			outline: config.hasOutline,
			formatter: config.formatter,
		},
		ui: config.ui,
	};
}

const BLOCK_BUILDERS = { lsp: lspBlock, typesetter: typesetterBlock };

function composeService(entry) {
	const name = `recipe-${entry.configId}`;
	const host = `${entry.type}.\${BASE_DOMAIN}`;
	const production = `${entry.type}.\${PRODUCTION_DOMAIN:-yourdomain.com}`;
	const rule = `(Host(\`${host}\`) || Host(\`${production}\`)) && PathPrefix(\`/${entry.configId}\`)`;

	return [
		`  ${name}:`,
		`    image: ${entry.image}`,
		...(entry.build ? [`    build: ${entry.build}`] : []),
		`    container_name: chelys-recipe-${entry.configId}`,
		'    restart: unless-stopped',
		'    environment:',
		`      - WS_PORT=${entry.port}`,
		'    networks:',
		'      - traefik',
		'    labels:',
		'      - "traefik.enable=true"',
		`      - "traefik.http.routers.${name}.rule=${rule}"`,
		`      - "traefik.http.routers.${name}.entrypoints=web"`,
		`      - "traefik.http.routers.${name}.middlewares=${name}-strip"`,
		`      - "traefik.http.middlewares.${name}-strip.stripprefix.prefixes=/${entry.configId}"`,
		`      - "traefik.http.services.${name}.loadbalancer.server.port=${entry.port}"`,
		`      - "traefik.http.routers.${name}-secure.rule=${rule}"`,
		`      - "traefik.http.routers.${name}-secure.entrypoints=websecure"`,
		`      - "traefik.http.routers.${name}-secure.middlewares=${name}-strip"`,
		`      - "traefik.http.routers.${name}-secure.tls=true"`,
		`      - "traefik.http.routers.${name}-secure.service=${name}"`,
		'',
	].join('\n');
}

function composeFile(entries) {
	return [
		'# Generated by scripts/generate-recipes.cjs, do not edit',
		'services:',
		'  texlyre-frontend:',
		'    volumes:',
		`      - ./${USERDATA_FILE}:/etc/texlyre/overrides/recipes.json:ro`,
		'',
		...entries.map(composeService),
	].join('\n');
}

function userdataFile(entries) {
	const settings = {};

	for (const [type, key] of Object.entries(SETTING_KEYS)) {
		const blocks = entries
			.filter((entry) => entry.type === type)
			.map((entry) => entry.block);

		settings[key] = JSON.stringify(blocks);
	}

	const revision = crypto
		.createHash('sha256')
		.update(JSON.stringify(settings))
		.digest('hex')
		.slice(0, 12);

	return `${JSON.stringify(
		{
			version: `recipes-${revision}`,
			settings,
		},
		null,
		2,
	)}\n`;
}

function removeGenerated() {
	for (const file of [COMPOSE_FILE, USERDATA_FILE]) {
		fs.rmSync(file, { force: true });
	}
}

function column(values) {
	return values.length > 0
		? Math.max(...values.map((value) => value.length))
		: 0;
}

async function listRecipesVerbose(index) {
	const listed = [...index.values()];
	const manifests = await Promise.all(
		listed.map((recipe) => fetchJson(recipe.versions[0].manifestUrl)),
	);
	const variables = manifests.flatMap((manifest) => manifest.variables ?? []);
	const idWidth = column(listed.map((recipe) => recipe.id));
	const typeWidth = column(listed.map((recipe) => recipe.type));
	const keyWidth = column(variables.map((variable) => variable.key));
	const kindWidth = column(variables.map((variable) => variable.kind));
	const defaultWidth = column(
		variables.map((variable) => variable.default ?? ''),
	);

	listed.forEach((recipe, position) => {
		const versions = recipe.versions.map((entry) => entry.version).join(', ');

		console.log(
			`${recipe.id.padEnd(idWidth)}  ${recipe.type.padEnd(typeWidth)}  ${versions}`,
		);

		for (const variable of manifests[position].variables ?? []) {
			const options = variable.options
				? `  ${variable.options.join(' | ')}`
				: '';

			console.log(
				`  ${variable.key.padEnd(keyWidth)}  ${variable.kind.padEnd(kindWidth)}  ${(variable.default ?? '').padEnd(defaultWidth)}${options}`.trimEnd(),
			);
		}

		console.log('');
	});
}

async function main() {
	const registry = process.env.RECIPES_REGISTRY ?? DEFAULT_REGISTRY;
	const references = selection();

	if (process.argv.includes('--list')) {
		const index = await loadIndex(registry);

		for (const listed of index.values()) {
			console.log(
				`${listed.id.padEnd(20)} ${listed.type.padEnd(12)} ${listed.versions.map((entry) => entry.version).join(', ')}`,
			);
		}

		return;
	} else if (process.argv.includes('--list-verbose')) {
		await listRecipesVerbose(await loadIndex(registry));
		return;
	}

	if (references.length === 0) {
		removeGenerated();
		console.log(
			'generate-recipes: no recipes selected, removed generated files',
		);
		return;
	}

	const index = await loadIndex(registry);
	const entries = [];

	for (const reference of references) {
		const entry = resolveReference(parseReference(reference), index);
		const manifest = await fetchJson(entry.manifestUrl);
		const values = resolveValues(manifest, entry.variables);
		const config = substitute(manifest.typeConfig ?? {}, values);
		const builder = BLOCK_BUILDERS[entry.type];

		if (!builder) {
			throw new Error(`Unsupported recipe type "${entry.type}"`);
		}

		entry.configId =
			typeof config.configId === 'string' ? config.configId : manifest.id;
		entry.port = servicePort(manifest, values);
		entry.block = builder(entry, manifest, config);

		Object.assign(entry, imageSource(entry, manifest));
		entries.push(entry);
	}

	fs.mkdirSync(path.dirname(USERDATA_FILE), { recursive: true });
	fs.writeFileSync(COMPOSE_FILE, composeFile(entries));
	fs.writeFileSync(USERDATA_FILE, userdataFile(entries));

	for (const entry of entries) {
		console.log(
			`${entry.id}@${entry.version} -> ${entry.type}.\${BASE_DOMAIN}:\${HTTP_PORT}/${entry.configId}`,
		);
	}
}

main().catch((error) => {
	console.error(`generate-recipes: ${error.message}`);
	process.exit(1);
});
