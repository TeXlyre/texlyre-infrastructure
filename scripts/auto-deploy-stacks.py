#!/usr/bin/env python3
import os
import yaml
import subprocess


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


def check_service_availability(service_name):
    """Check if service directory exists and is properly configured"""
    service_path = f'services/{service_name}'

    if not os.path.exists(service_path):
        return False, f"Service directory not found: {service_path}"

    # Check for Dockerfile or docker-compose.yml
    has_dockerfile = os.path.exists(f'{service_path}/Dockerfile')
    has_compose = os.path.exists(f'{service_path}/docker-compose.yml')

    if not (has_dockerfile or has_compose):
        return False, f"No Dockerfile or docker-compose.yml found in {service_path}"

    return True, "Service is available"


def deploy_stack(stack_name, stack_path, env_vars):
    """Deploy a stack using docker compose"""

    # Check service availability first
    available, message = check_service_availability(stack_name)
    if not available:
        print(f"⚠️  Skipping {stack_name}: {message}")
        return None

    print(f"Deploying stack: {stack_name}")

    # Set project name for the stack
    project_name = f"infra-{stack_name}"

    # Create environment for docker compose
    compose_env = os.environ.copy()
    compose_env.update(env_vars)
    compose_env['COMPOSE_PROJECT_NAME'] = project_name

    try:
        # Deploy using docker compose
        result = subprocess.run([
            'docker', 'compose',
            '-f', stack_path,
            'up', '-d', '--build'
        ],
            env=compose_env,
            capture_output=True,
            text=True,
            check=True
        )

        print(f"✅ Successfully deployed: {stack_name}")
        return True

    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to deploy {stack_name}:")
        print(f"Error: {e.stderr}")
        return False


def main():
    env_vars = load_environment()

    # Check if stacks directory exists
    stack_dir = "generated/stacks"
    if not os.path.exists(stack_dir):
        print("❌ No stacks directory found. Run './scripts/generate-configs.py' first.")
        return

    print("Deploying service stacks...")

    deployed_count = 0
    failed_count = 0
    skipped_count = 0

    # Deploy all stack files
    for filename in sorted(os.listdir(stack_dir)):
        if filename.endswith("-stack.yml"):
            stack_name = filename.replace("-stack.yml", "")
            stack_path = os.path.join(stack_dir, filename)

            result = deploy_stack(stack_name, stack_path, env_vars)
            if result is True:
                deployed_count += 1
            elif result is False:
                failed_count += 1
            else:
                skipped_count += 1

    print(f"\n📊 Deployment Summary:")
    print(f"   ✅ Deployed: {deployed_count}")
    print(f"   ❌ Failed: {failed_count}")
    print(f"   ⚠️  Skipped: {skipped_count}")

    if deployed_count > 0:
        print(f"\n🎉 Available services deployed successfully!")
        base_domain = env_vars.get('BASE_DOMAIN', 'localhost')
        http_port = env_vars.get('HTTP_PORT', '80')
        port_suffix = f":{http_port}" if http_port != '80' else ""

        print(f"\n📋 Service URLs:")

        # Show service URLs based on deployed stacks
        service_urls = {
            'filepizza-server': f"http://files.{base_domain}{port_suffix}",
            'y-webrtc-server': f"http://sync.{base_domain}{port_suffix}",
            'peerjs-server': f"http://peer.{base_domain}{port_suffix}",
            'texlive-ondemand-server': f"http://compile.{base_domain}{port_suffix}"
        }

        for filename in os.listdir(stack_dir):
            if filename.endswith("-stack.yml"):
                stack_name = filename.replace("-stack.yml", "")
                if stack_name in service_urls:
                    available, _ = check_service_availability(stack_name)
                    if available:
                        print(f"   {stack_name}: {service_urls[stack_name]}")

    if skipped_count > 0:
        print(f"\n📝 To enable skipped services:")
        print(f"   1. Initialize submodules: git submodule update --init --recursive")
        print(f"   2. Or add missing services manually to services/ directory")
        print(f"   3. Re-run this script")


if __name__ == "__main__":
    main()