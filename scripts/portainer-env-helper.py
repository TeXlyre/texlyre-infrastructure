#!/usr/bin/env python3
"""
Helper script to show how to configure environment variables in Portainer UI
"""
import yaml
import os


def show_portainer_instructions():
    if not os.path.exists('generated/env-inventory.yml'):
        print("Run './scripts/generate-configs.py' first")
        return

    with open('generated/env-inventory.yml', 'r') as f:
        inventory = yaml.safe_load(f)

    print("Portainer Environment Configuration Guide")
    print("=" * 50)
    print()

    for env_info in inventory['environment_files']:
        service = env_info['service']
        env_file = env_info['env_file']
        variables = env_info['variables']

        print(f"Service: {service}")
        print(f"Env File: config/env/{env_file}")
        print(f"Variables to set in Portainer stack environment:")

        if variables:
            for var in variables:
                print(f"   {var}=<your_value>")
        else:
            print("   (no variables found - check template)")

        print(f"Description: {env_info['description']}")
        print()

    print("In Portainer:")
    print("1. Go to Stacks → Add Stack")
    print("2. Paste the stack YAML from generated/stacks/")
    print("3. In 'Environment variables' section, add variables listed above")
    print("4. Deploy the stack")


if __name__ == "__main__":
    show_portainer_instructions()