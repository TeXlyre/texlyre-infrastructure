const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const generator = path.resolve(__dirname, '../../scripts/generate-recipes.cjs');

function runGenerator(cwd, registry, reference) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [generator, reference], {
			cwd,
			env: { ...process.env, RECIPES_REGISTRY: registry },
		});
		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve(stdout);
				return;
			}
			reject(new Error(stderr || `generator exited with ${code}`));
		});
	});
}

test('generates storage config, route and persistent Compose volume', async (t) => {
	const manifest = {
		id: 'garage-storage',
		type: 'storage',
		name: 'Garage',
		version: '2.4.1',
		variables: [
			{
				key: 'wsPort',
				kind: 'number',
				default: '7060',
			},
		],
		modes: [
			{
				kind: 'docker',
				image: 'ghcr.io/texlyre/chelys-recipe-garage:2.4.1',
				volumes: [{ id: 'data/cache', target: '/var/lib/garage' }],
			},
		],
		typeConfig: {
			configId: 'garage-storage',
			transportType: 'websocket',
			transportUrl: 'ws://localhost:${wsPort}',
		},
	};
	const server = http.createServer((request, response) => {
		response.setHeader('content-type', 'application/json');
		if (request.url === '/api/recipes.json') {
			response.end(
				JSON.stringify({
					categories: [
						{
							id: 'storage',
							recipes: [
								{
									id: 'garage-storage',
									type: 'storage',
									name: 'Garage',
									versions: [
										{
											version: '2.4.1',
											manifestUrl: `http://127.0.0.1:${server.address().port}/garage.json`,
										},
									],
								},
							],
						},
					],
				}),
			);
			return;
		}
		if (request.url === '/garage.json') {
			response.end(JSON.stringify(manifest));
			return;
		}
		response.statusCode = 404;
		response.end('{}');
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	t.after(() => server.close());

	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'texlyre-recipes-'));
	t.after(() => fs.rm(cwd, { recursive: true, force: true }));
	const registry = `http://127.0.0.1:${server.address().port}`;

	await runGenerator(cwd, registry, 'storage/garage-storage@2.4.1');

	const compose = await fs.readFile(
		path.join(cwd, 'docker-compose.recipes.yml'),
		'utf8',
	);
	assert.match(
		compose,
		/image: ghcr\.io\/texlyre\/chelys-recipe-garage:2\.4\.1/,
	);
	assert.match(compose, /- WS_PORT=7060/);
	assert.match(
		compose,
		/- recipe-garage-storage-data-cache:\/var\/lib\/garage/,
	);
	assert.match(compose, /PathPrefix\(`\/garage-storage`\)/);
	assert.match(compose, /loadbalancer\.server\.port=7060/);
	assert.match(compose, /\nvolumes:\n  recipe-garage-storage-data-cache:\n/);

	const userdata = JSON.parse(
		await fs.readFile(
			path.join(cwd, 'frontend/userdata.overrides/recipes.json'),
			'utf8',
		),
	);
	const storageConfigs = JSON.parse(
		userdata.settings['generic-storage-configs'],
	);
	assert.deepEqual(storageConfigs, [
		{
			id: 'garage-storage-server',
			name: 'Garage (server)',
			enabled: true,
			transportConfig: {
				type: 'websocket',
				url: 'ws://storage.${BASE_DOMAIN}:${HTTP_PORT}/garage-storage',
			},
		},
	]);
	assert.equal(userdata.settings['generic-lsp-configs'], '[]');
	assert.equal(userdata.settings['generic-typesetter-configs'], '[]');
});

async function fixture(t, manifest) {
	const server = http.createServer((request, response) => {
		response.setHeader('content-type', 'application/json');
		if (request.url === '/api/recipes.json') {
			response.end(JSON.stringify({ categories: [{
				id: manifest.type,
				recipes: [{ id: manifest.id, type: manifest.type, name: manifest.name,
					versions: [{ version: manifest.version,
						manifestUrl: `http://127.0.0.1:${server.address().port}/manifest.json` }] }],
			}] }));
		} else if (request.url === '/manifest.json') {
			response.end(JSON.stringify(manifest));
		} else {
			response.statusCode = 404;
			response.end('{}');
		}
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	t.after(() => server.close());
	const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'texlyre-recipes-'));
	t.after(() => fs.rm(cwd, { recursive: true, force: true }));
	return { cwd, registry: `http://127.0.0.1:${server.address().port}` };
}

test('named Garage volume is external so missing existing data is not silently replaced', async (t) => {
	const manifest = {
		id: 'garage-storage', type: 'storage', name: 'Garage', version: '2.4.1',
		variables: [{ key: 'wsPort', kind: 'number', default: '7060' },
			{ key: 'garageVolumeName', kind: 'text', default: 'chelys-garage-storage-data' }],
		modes: [{ kind: 'docker', image: 'ghcr.io/texlyre/chelys-recipe-garage:2.4.1',
			volumes: [{ id: 'data', target: '/var/lib/garage', name: '${garageVolumeName}' }] }],
		typeConfig: { configId: 'garage-storage' },
	};
	const { cwd, registry } = await fixture(t, manifest);
	await runGenerator(cwd, registry, 'storage/garage-storage');
	const compose = await fs.readFile(path.join(cwd, 'docker-compose.recipes.yml'), 'utf8');
	assert.match(compose, /- recipe-garage-storage-data:\/var\/lib\/garage/);
	assert.match(compose, /volumes:\n  recipe-garage-storage-data:\n    name: "chelys-garage-storage-data"\n    external: true/);
	manifest.variables[1].default = '../unsafe';
	await assert.rejects(runGenerator(cwd, registry, 'storage/garage-storage'), /invalid docker volume name/);
});

test('generates ACP config and forwards API key without writing the secret', async (t) => {
	const manifest = {
		id: 'claude-agent', type: 'acp', name: 'Claude Agent (ACP)', version: '0.89.1',
		variables: [
			{ key: 'wsPort', kind: 'number', default: '7060' },
			{ key: 'anthropicApiKey', kind: 'secret' },
		],
		env: { ANTHROPIC_API_KEY: '${anthropicApiKey}', AGENT_MODE: 'test' },
		modes: [{ kind: 'docker', image: 'ghcr.io/texlyre/chelys-recipe-claude-agent:0.89.1',
			runArgs: ['--init'], volumes: [{ id: 'home', target: '/home/node' }] }],
		typeConfig: { configId: 'claude-agent', cwd: '/home/node', sessionMeta: '{}', mcpServers: '{}' },
	};
	const { cwd, registry } = await fixture(t, manifest);
	await runGenerator(cwd, registry, 'acp/claude-agent@0.89.1');
	const compose = await fs.readFile(path.join(cwd, 'docker-compose.recipes.yml'), 'utf8');
	const userdataText = await fs.readFile(path.join(cwd, 'frontend/userdata.overrides/recipes.json'), 'utf8');
	assert.match(compose, /init: true/);
	assert.match(compose, /- "ANTHROPIC_API_KEY"/);
	assert.match(compose, /- "AGENT_MODE=test"/);
	assert.match(compose, /- recipe-claude-agent-home:\/home\/node/);
	assert.match(compose, /Host\(`acp\.\$\{BASE_DOMAIN\}`\)/);
	assert.doesNotMatch(compose, /anthropicApiKey/);
	const userdata = JSON.parse(userdataText);
	assert.deepEqual(JSON.parse(userdata.settings['generic-acp-configs']), [{
		id: 'claude-agent-server', name: 'Claude Agent (ACP) (server)', enabled: true,
		transportConfig: { type: 'websocket',
			url: 'ws://acp.${BASE_DOMAIN}:${HTTP_PORT}/claude-agent', contentLength: false },
		cwd: '/home/node', sessionMeta: '{}', mcpServers: '{}',
	}]);
	assert.equal(userdata.settings['generic-storage-configs'], '[]');
	assert.doesNotMatch(userdataText, /anthropicApiKey|ANTHROPIC_API_KEY/);
	await assert.rejects(
		runGenerator(cwd, registry, 'acp/claude-agent@0.89.1?anthropicApiKey=should-not-appear'),
		/Set the secret 'anthropicApiKey' through the Compose environment/,
	);
	assert.doesNotMatch(await fs.readFile(path.join(cwd, 'docker-compose.recipes.yml'), 'utf8'), /should-not-appear/);
});
