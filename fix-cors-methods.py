#!/usr/bin/env python3
"""
Fix CORS MethodResponses in API Gateway CloudFormation template.

This script adds CORS header configuration to all POST/GET/PUT/DELETE methods
so that API Gateway properly passes through the CORS headers from the Lambda response.
"""

import yaml
import sys
import re
from pathlib import Path
from copy import deepcopy

# CORS header mappings to add to MethodResponses
CORS_METHOD_RESPONSES = {
    200: {
        'StatusCode': 200,
        'ResponseParameters': {
            'method.response.header.Access-Control-Allow-Origin': True,
            'method.response.header.Access-Control-Allow-Headers': True,
            'method.response.header.Access-Control-Allow-Methods': True
        }
    },
    201: {
        'StatusCode': 201,
        'ResponseParameters': {
            'method.response.header.Access-Control-Allow-Origin': True,
            'method.response.header.Access-Control-Allow-Headers': True,
            'method.response.header.Access-Control-Allow-Methods': True
        }
    },
    400: {
        'StatusCode': 400,
        'ResponseParameters': {
            'method.response.header.Access-Control-Allow-Origin': True,
            'method.response.header.Access-Control-Allow-Headers': True,
            'method.response.header.Access-Control-Allow-Methods': True
        }
    },
    401: {
        'StatusCode': 401,
        'ResponseParameters': {
            'method.response.header.Access-Control-Allow-Origin': True,
            'method.response.header.Access-Control-Allow-Headers': True,
            'method.response.header.Access-Control-Allow-Methods': True
        }
    },
    403: {
        'StatusCode': 403,
        'ResponseParameters': {
            'method.response.header.Access-Control-Allow-Origin': True,
            'method.response.header.Access-Control-Allow-Headers': True,
            'method.response.header.Access-Control-Allow-Methods': True
        }
    },
    404: {
        'StatusCode': 404,
        'ResponseParameters': {
            'method.response.header.Access-Control-Allow-Origin': True,
            'method.response.header.Access-Control-Allow-Headers': True,
            'method.response.header.Access-Control-Allow-Methods': True
        }
    },
    500: {
        'StatusCode': 500,
        'ResponseParameters': {
            'method.response.header.Access-Control-Allow-Origin': True,
            'method.response.header.Access-Control-Allow-Headers': True,
            'method.response.header.Access-Control-Allow-Methods': True
        }
    }
}

def load_yaml(file_path):
    """Load YAML file."""
    with open(file_path, 'r') as f:
        return yaml.safe_load(f)

def save_yaml(data, file_path):
    """Save YAML file with proper formatting."""
    # Custom representer for bool
    def bool_representer(dumper, data):
        return dumper.represent_scalar('tag:yaml.org,2002:bool', str(data))

    yaml.add_representer(bool, bool_representer)

    with open(file_path, 'w') as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

def should_add_cors(method_name, http_method):
    """Check if this method should have CORS headers."""
    # Skip OPTIONS methods - they already have CORS headers
    if http_method == 'OPTIONS':
        return False
    # Add CORS to POST, GET, PUT, DELETE, PATCH
    if http_method in ['POST', 'GET', 'PUT', 'DELETE', 'PATCH']:
        return True
    return False

def has_cors_headers(method_responses):
    """Check if MethodResponses already have CORS headers."""
    if not method_responses:
        return False

    for response in method_responses:
        params = response.get('ResponseParameters', {})
        if 'method.response.header.Access-Control-Allow-Origin' in params:
            return True
    return False

def fix_template(template_path):
    """Fix CORS MethodResponses in the template."""
    print(f"Loading template: {template_path}")
    template = load_yaml(template_path)

    if 'Resources' not in template:
        print("ERROR: No Resources section found in template")
        return False

    resources = template['Resources']
    methods_fixed = 0
    methods_skipped = 0

    # Iterate through all resources
    for resource_name, resource_def in resources.items():
        if resource_def.get('Type') != 'AWS::ApiGateway::Method':
            continue

        props = resource_def.get('Properties', {})
        http_method = props.get('HttpMethod', '')

        # Check if this method should have CORS headers
        if not should_add_cors(resource_name, http_method):
            methods_skipped += 1
            continue

        # Check if CORS headers already exist
        existing_responses = props.get('MethodResponses', [])
        if has_cors_headers(existing_responses):
            print(f"✓ {resource_name} ({http_method}) - Already has CORS headers")
            methods_skipped += 1
            continue

        # Add CORS MethodResponses
        method_responses = []

        # If there are existing MethodResponses, merge them
        if existing_responses:
            for response in existing_responses:
                status_code = response.get('StatusCode')
                # Add CORS headers to existing responses
                if status_code in CORS_METHOD_RESPONSES:
                    merged = deepcopy(CORS_METHOD_RESPONSES[status_code])
                    if 'ResponseParameters' in response:
                        merged['ResponseParameters'].update(response.get('ResponseParameters', {}))
                    method_responses.append(merged)
                else:
                    method_responses.append(response)
        else:
            # If no existing responses, add all CORS responses
            method_responses = list(CORS_METHOD_RESPONSES.values())

        # Update the template
        props['MethodResponses'] = method_responses
        print(f"✓ {resource_name} ({http_method}) - Added CORS headers to {len(method_responses)} responses")
        methods_fixed += 1

    # Save the fixed template
    print(f"\nSaving fixed template...")
    save_yaml(template, template_path)

    print(f"\n✅ Summary:")
    print(f"   Methods fixed: {methods_fixed}")
    print(f"   Methods skipped: {methods_skipped}")

    return True

if __name__ == '__main__':
    template_path = 'server/cfn/nested/apigw-explicit-routes.yaml'

    # Check if file exists
    if not Path(template_path).exists():
        print(f"ERROR: Template not found at {template_path}")
        sys.exit(1)

    # Create backup
    backup_path = f"{template_path}.backup-{Path(template_path).stat().st_mtime}"
    print(f"Creating backup: {backup_path}")
    import shutil
    shutil.copy(template_path, backup_path)

    # Fix the template
    if fix_template(template_path):
        print(f"\n✅ Template fixed successfully!")
        print(f"Backup saved at: {backup_path}")
        print(f"\nNext steps:")
        print(f"1. Review the changes: git diff {template_path}")
        print(f"2. Commit: git add {template_path}")
        print(f"3. Redeploy: ./deploy-lambda.ps1")
        sys.exit(0)
    else:
        print(f"\n❌ Failed to fix template")
        sys.exit(1)
