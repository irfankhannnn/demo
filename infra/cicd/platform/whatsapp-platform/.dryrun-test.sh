#!/usr/bin/env bash
set -e
TMPBIN=$(mktemp -d)

cat > "$TMPBIN/aws" << 'AWSSTUB'
#!/usr/bin/env bash
ARGS="$*"
case "$ARGS" in
  "sts get-caller-identity --query Account --output text")
    echo "123456789012" ;;
  "ecr describe-repositories --repository-names dev-whatsapp-platform --region ap-south-1")
    exit 1 ;;
  "ecr create-repository --repository-name dev-whatsapp-platform --region ap-south-1")
    echo "created" ;;
  "ecr get-login-password --region ap-south-1")
    echo "fake-password" ;;
  *"ec2 describe-vpcs --filters Name=isDefault,Values=true"*)
    echo "vpc-0123456789abcdef0" ;;
  *"ec2 describe-vpcs --vpc-ids vpc-0123456789abcdef0"*)
    echo "10.0.0.0/16" ;;
  *"ec2 describe-subnets"*)
    printf "subnet-aaa\tsubnet-bbb\n" ;;
  *"cloudformation deploy"*)
    echo "stack deployed (fake)" ;;
  *"cloudformation describe-stacks"*)
    echo "[]" ;;
  *"docker login"*)
    echo "login ok" ;;
  *)
    echo "UNHANDLED AWS CALL: $ARGS" >&2
    exit 1 ;;
esac
AWSSTUB
chmod +x "$TMPBIN/aws"

cat > "$TMPBIN/docker" << 'DOCKERSTUB'
#!/usr/bin/env bash
echo "docker $*"
exit 0
DOCKERSTUB
chmod +x "$TMPBIN/docker"

export PATH="$TMPBIN:$PATH"
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rm -f .generated-dev.env
bash deploy.sh deploy dev
echo "---SCRIPT EXIT: $?---"
