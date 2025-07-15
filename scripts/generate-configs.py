#!/usr/bin/env python3
import yaml
import os
import sys
import shutil
from pathlib import Path


def load_services_config():
    """Load services configuration"""
    with open('services/services.yml', 'r') as f:
        return yaml.safe_load(f)


def load_environment():
    """Load environment variables from .env file"""
    env_vars = {}
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    env_vars[key] = value
    return env_vars


def detect_service_config(service_path):
    """Detect which docker-compose file to use based on environment"""
    service_dir = Path(service_path)

    # Check for environment-specific compose files
    compose_files = {
        'default': service_dir / 'docker-compose.yml',
        'production': service_dir / 'docker-compose.production.yml',
        'cloudflare': service_dir / 'docker-compose.cloudflare.yml'
    }

    # Load environment to determine which compose file to use
    env_vars = load_environment()
    environment = env_vars.get('ENVIRONMENT', 'local')

    if environment == 'production' and compose_files['cloudflare'].exists():
        return 'docker-compose.cloudflare.yml'
    elif environment == 'production' and compose_files['production'].exists():
        return 'docker-compose.production.yml'
    else:
        return 'docker-compose.yml'


def sync_env_templates():
    """Copy env templates from submodules to templates directory"""
    print("Syncing environment templates from submodules...")

    os.makedirs('config/env-templates', exist_ok=True)

    for service_dir in Path('services').iterdir():
        if service_dir.is_dir():
            # Check for envfile or .env.example
            template_sources = ['envfile', '.env.example', '.env.template']
            source_file = None

            for template_name in template_sources:
                template_path = service_dir / template_name
                if template_path.exists():
                    source_file = template_path
                    break

            if source_file:
                dest_path = f'config/env-templates/{service_dir.name}.env'
                shutil.copy2(source_file, dest_path)
                print(f"  ✅ Synced template: {service_dir.name}.env (from {source_file.name})")
            else:
                print(f"  ⚠️  No env template found for: {service_dir.name}")


def setup_env_files(services_config):
    """Setup actual env files from templates if they don't exist"""
    print("Setting up environment files...")

    os.makedirs('config/env', exist_ok=True)

    for service_name, config in services_config['services'].items():
        env_file = config.get('env_file', f'{service_name}.env')
        actual_env_path = f'config/env/{env_file}'
        template_env_path = f'config/env-templates/{env_file}'

        if not os.path.exists(actual_env_path):
            if os.path.exists(template_env_path):
                shutil.copy2(template_env_path, actual_env_path)
                print(f"  Created env file: {env_file} (from template)")
            else:
                # Create empty env file with comment
                with open(actual_env_path, 'w') as f:
                    f.write(f"# Environment file for {service_name}\n")
                    f.write(f"# Copy variables from services/{service_name}/envfile\n\n")
                print(f"  Created empty env file: {env_file}")
        else:
            print(f"  Using existing env file: {env_file}")


def setup_shared_services():
    """Setup shared services like Redis for services that need it"""
    shared_services = []

    # Check if any service needs Redis
    services_config = load_services_config()
    needs_redis = any('redis' in service.get('description', '').lower() or
                      'filepizza' in service_name or
                      'y-webrtc' in service_name
                      for service_name, service in services_config['services'].items())

    if needs_redis:
        shared_services.append({
            'name': 'redis',
            'image': 'redis:alpine',
            'port': 6379
        })

    return shared_services


def generate_portainer_stacks(services_config, env_vars):
    """Generate Portainer stack files for each service"""

    with open('templates/service-template.yml', 'r') as f:
        template = f.read()

    os.makedirs('generated/stacks', exist_ok=True)
    shared_services = setup_shared_services()
    environment = env_vars.get('ENVIRONMENT', 'local')

    for service_name, config in services_config['services'].items():
        env_file = config.get('env_file', f'{service_name}.env')
        service_path = f'services/{service_name}'

        # Determine SSL labels based on environment
        if environment == 'production':
            ssl_labels = f'''
      - "traefik.http.routers.infra-{service_name}.tls=true"
      - "traefik.http.routers.infra-{service_name}.tls.certresolver=letsencrypt"'''
        else:
            ssl_labels = ""

        # Check if service directory exists
        if os.path.exists(service_path):
            # Use build context for local services
            service_definition = f'''
  {service_name}:
    build:
      context: ../../services/{service_name}
    container_name: infra-{service_name}
    restart: unless-stopped
    env_file:
      - ../../config/env/{env_file}
    networks:
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.infra-{service_name}.rule=Host(`{config['subdomain']}.{env_vars.get('BASE_DOMAIN', 'localhost')}`)"
      - "traefik.http.services.infra-{service_name}.loadbalancer.server.port={config['port']}"{ssl_labels}'''
        else:
            # Use placeholder image for missing services
            service_definition = f'''
  {service_name}:
    image: nginx:alpine
    container_name: infra-{service_name}
    restart: unless-stopped
    environment:
      - SERVICE_NAME={service_name}
      - SERVICE_STATUS=not_configured
    networks:
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.infra-{service_name}.rule=Host(`{config['subdomain']}.{env_vars.get('BASE_DOMAIN', 'localhost')}`)"
      - "traefik.http.services.infra-{service_name}.loadbalancer.server.port=80"{ssl_labels}
    command: |
      sh -c "echo '<h1>Service {service_name} not configured</h1><p>Please set up the service in services/{service_name}/</p>' > /usr/share/nginx/html/index.html && nginx -g 'daemon off;'"'''

        # Create stack content
        stack_content = f'''services:{service_definition}

networks:
  traefik:
    name: {env_vars.get('COMPOSE_PROJECT_NAME', 'texlyre')}-traefik
    external: true
'''

        # Add shared services if needed
        if service_name in ['filepizza-server', 'y-webrtc-server'] and shared_services:
            stack_yaml = yaml.safe_load(stack_content)

            # Add Redis service
            stack_yaml['services']['redis'] = {
                'image': 'redis:alpine',
                'container_name': f"infra-{service_name}-redis",
                'restart': 'unless-stopped',
                'networks': ['traefik'],
                'volumes': [f"{service_name}-redis-data:/data"]
            }

            # Add volume
            if 'volumes' not in stack_yaml:
                stack_yaml['volumes'] = {}
            stack_yaml['volumes'][f'{service_name}-redis-data'] = {
                'name': f'infra-{service_name}-redis-data'
            }

            stack_content = yaml.dump(stack_yaml, default_flow_style=False)

        # Write stack file
        with open(f'generated/stacks/{service_name}-stack.yml', 'w') as f:
            f.write(stack_content)

        print(f"Generated stack: {service_name}-stack.yml")


def generate_traefik_routes(services_config, env_vars):
    """Generate Traefik dynamic routing files"""

    os.makedirs('generated/traefik/dynamic', exist_ok=True)
    environment = env_vars.get('ENVIRONMENT', 'local')

    for service_name, config in services_config['services'].items():
        route_config = {
            'http': {
                'routers': {
                    service_name: {
                        'rule': f"Host(`{config['subdomain']}.{env_vars.get('BASE_DOMAIN', 'localhost')}`)",
                        'service': service_name
                    }
                },
                'services': {
                    service_name: {
                        'loadBalancer': {
                            'servers': [
                                {'url': f"http://infra-{service_name}_1:{config['port']}"}
                            ]
                        }
                    }
                }
            }
        }

        # Only add SSL for production
        if environment == 'production':
            route_config['http']['routers'][service_name]['tls'] = {
                'certResolver': 'letsencrypt'
            }

        with open(f'generated/traefik/dynamic/{service_name}.yml', 'w') as f:
            yaml.dump(route_config, f, default_flow_style=False)

        print(f"Generated route: {service_name}.yml")

def generate_env_inventory(services_config):
    """Generate inventory of all environment files for Portainer"""

    env_inventory = {
        'environment_files': []
    }

    for service_name, config in services_config['services'].items():
        env_file = config.get('env_file', f'{service_name}.env')
        env_path = f'config/env/{env_file}'

        # Read current env file to show variables
        variables = []
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    if '=' in line and not line.startswith('#'):
                        key = line.split('=')[0].strip()
                        variables.append(key)

        env_inventory['environment_files'].append({
            'service': service_name,
            'env_file': env_file,
            'path': env_path,
            'variables': variables,
            'description': config.get('description', '')
        })

    with open('generated/env-inventory.yml', 'w') as f:
        yaml.dump(env_inventory, f, default_flow_style=False)

    print("Generated environment inventory")


def generate_service_list(services_config, env_vars):
    """Generate a list of all services and their URLs"""

    services_list = []
    base_domain = env_vars.get('BASE_DOMAIN', 'localhost')
    protocol = 'https' if env_vars.get('ENVIRONMENT') == 'production' else 'http'

    for service_name, config in services_config['services'].items():
        services_list.append({
            'name': service_name,
            'url': f"{protocol}://{config['subdomain']}.{base_domain}",
            'description': config.get('description', ''),
            'port': config['port']
        })

    with open('generated/services-list.yml', 'w') as f:
        yaml.dump({'services': services_list}, f, default_flow_style=False)

    print("Generated services list")


def generate_service_readme():
    """Generate README with service-specific information"""
    services_config = load_services_config()
    env_vars = load_environment()

    readme_content = """# TeXlyre Services Configuration

## Available Services

"""

    for service_name, config in services_config['services'].items():
        base_domain = env_vars.get('BASE_DOMAIN', 'localhost')
        protocol = 'https' if env_vars.get('ENVIRONMENT') == 'production' else 'http'
        url = f"{protocol}://{config['subdomain']}.{base_domain}"
        env_file = config.get('env_file', f'{service_name}.env')

        readme_content += f"""### {service_name}
- **URL**: {url}
- **Port**: {config['port']}
- **Description**: {config['description']}
- **Environment**: config/env/{env_file}

"""

    readme_content += """
## Service Dependencies

- **filepizza-server**: Requires Redis
- **y-webrtc-server**: Requires Redis  
- **texlive-ondemand-server**: Standalone
- **peerjs-server**: Standalone

## Environment Configuration

Each service has its environment file in `config/env/`. These files are auto-generated from templates in `config/env-templates/` which are synced from each service's repository.

To modify a service configuration:
1. Edit `config/env/[service-name].env`
2. Restart the service in Portainer
3. Changes take effect immediately

## Portainer Deployment

Use the generated stack files in `generated/stacks/` to deploy services in Portainer.
"""

    with open('generated/SERVICES.md', 'w') as f:
        f.write(readme_content)

    print("Generated services documentation")


def main():
    try:
        services_config = load_services_config()
        env_vars = load_environment()

        print("Generating TeXlyre service configurations...")

        # Sync templates from submodules
        sync_env_templates()

        # Setup actual env files
        setup_env_files(services_config)

        # Generate all configs
        generate_portainer_stacks(services_config, env_vars)
        generate_traefik_routes(services_config, env_vars)
        generate_env_inventory(services_config)
        generate_service_list(services_config, env_vars)
        generate_service_readme()

        print("\n✅ All TeXlyre configurations generated successfully!")
        print("📁 Environment files: config/env/")
        print("📁 Portainer stacks: generated/stacks/")
        print("📁 Service documentation: generated/SERVICES.md")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()