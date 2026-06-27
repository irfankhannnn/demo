#!/bin/bash

###############################################################################
# MCP Server Deployment Script
#
# Deploys the RealtyFlow MCP Server to AWS Lambda + API Gateway
#
# Usage:
#   ./infra/deploy-mcp.sh [dev|test|prod]
#
# Prerequisites:
#   - AWS CLI configured with credentials
#   - Node.js 20.x installed
#   - .env file with required environment variables
#   - S3 bucket for Lambda deployment packages
#
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENV=${1:-prod}
SERVICE_NAME="realtyflow-mcp"
REGION=${AWS_REGION:-ap-south-1}
LAMBDA_PACKAGES_BUCKET=${LAMBDA_PACKAGES_BUCKET:-realtyflow-lambda-packages}
LAMBDA_CODE_S3_KEY="mcp-function.zip"
CFN_STACK_NAME="${SERVICE_NAME}-${ENV}"
CFN_TEMPLATE="infra/cfn-mcp.yaml"
CFN_PARAMS_FILE="infra/cfn-params-${ENV}.json"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}MCP Server Deployment Script${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Environment: $ENV"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo "Stack: $CFN_STACK_NAME"
echo ""

# ============================================================================
# STEP 1: Validate Environment
# ============================================================================

echo -e "${YELLOW}[1/6] Validating environment...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

if [ ! -f "$CFN_TEMPLATE" ]; then
    echo -e "${RED}Error: CloudFormation template not found: $CFN_TEMPLATE${NC}"
    exit 1
fi

if [ ! -f "$CFN_PARAMS_FILE" ]; then
    echo -e "${RED}Error: CloudFormation parameters file not found: $CFN_PARAMS_FILE${NC}"
    echo "Create it from: infra/cfn-params-mcp.sample.json"
    exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Environment validated${NC}"
echo ""

# ============================================================================
# STEP 2: Install Dependencies
# ============================================================================

echo -e "${YELLOW}[2/6] Installing dependencies...${NC}"

cd server
npm install --production > /dev/null 2>&1
cd ..

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# ============================================================================
# STEP 3: Package Lambda Function
# ============================================================================

echo -e "${YELLOW}[3/6] Packaging Lambda function...${NC}"

# Remove old package if exists
rm -f "$LAMBDA_CODE_S3_KEY"

# Create deployment package
zip -r "$LAMBDA_CODE_S3_KEY" \
    server/mcp-server/ \
    server/shared/ \
    server/oauth/ \
    server/authorizers/ \
    server/crmDynamodbService.js \
    server/skillInvoker.js \
    server/logger.js \
    server/agents/ \
    server/userCategoryService.js \
    server/aiDtoMiddleware.js \
    server/node_modules \
    package.json \
    > /dev/null 2>&1

PACKAGE_SIZE=$(du -h "$LAMBDA_CODE_S3_KEY" | cut -f1)
echo -e "${GREEN}✓ Lambda package created: $LAMBDA_CODE_S3_KEY ($PACKAGE_SIZE)${NC}"
echo ""

# ============================================================================
# STEP 4: Upload to S3
# ============================================================================

echo -e "${YELLOW}[4/6] Uploading to S3...${NC}"

aws s3 cp "$LAMBDA_CODE_S3_KEY" "s3://${LAMBDA_PACKAGES_BUCKET}/${LAMBDA_CODE_S3_KEY}" \
    --region "$REGION" \
    > /dev/null 2>&1

echo -e "${GREEN}✓ Uploaded to s3://${LAMBDA_PACKAGES_BUCKET}/${LAMBDA_CODE_S3_KEY}${NC}"
echo ""

# ============================================================================
# STEP 5: Validate CloudFormation Template
# ============================================================================

echo -e "${YELLOW}[5/6] Validating CloudFormation template...${NC}"

aws cloudformation validate-template \
    --template-body "file://${CFN_TEMPLATE}" \
    --region "$REGION" \
    > /dev/null 2>&1

echo -e "${GREEN}✓ CloudFormation template is valid${NC}"
echo ""

# ============================================================================
# STEP 6: Deploy CloudFormation Stack
# ============================================================================

echo -e "${YELLOW}[6/6] Deploying CloudFormation stack...${NC}"

aws cloudformation deploy \
    --template-file "$CFN_TEMPLATE" \
    --stack-name "$CFN_STACK_NAME" \
    --parameter-overrides "file://${CFN_PARAMS_FILE}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION" \
    --no-fail-on-empty-changeset

echo -e "${GREEN}✓ CloudFormation stack deployed${NC}"
echo ""

# ============================================================================
# STEP 7: Get Stack Outputs
# ============================================================================

echo -e "${YELLOW}Retrieving stack outputs...${NC}"
echo ""

OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name "$CFN_STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs' \
    --output json)

MCP_API_URL=$(echo "$OUTPUTS" | grep -o '"McpApiUrl"[^}]*' | grep -o 'https://[^"]*' || echo "N/A")
MCP_LAMBDA_ARN=$(echo "$OUTPUTS" | grep -o '"McpLambdaArn"[^}]*' | grep -o 'arn:aws[^"]*' || echo "N/A")

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Stack Name:        $CFN_STACK_NAME"
echo "Environment:       $ENV"
echo "Region:            $REGION"
echo ""
echo "MCP API URL:       $MCP_API_URL"
echo "Lambda ARN:        $MCP_LAMBDA_ARN"
echo ""
echo "Next Steps:"
echo "1. Test the MCP endpoint:"
echo "   curl -X POST $MCP_API_URL \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'Authorization: Bearer <JWT_TOKEN>' \\"
echo "     -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":1}'"
echo ""
echo "2. Register with Anthropic and OpenAI (Phase 5)"
echo ""
echo "3. Create AI Integrations dashboard page (Phase 6)"
echo ""

# ============================================================================
# CLEANUP
# ============================================================================

echo -e "${YELLOW}Cleaning up...${NC}"

rm -f "$LAMBDA_CODE_S3_KEY"

echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

echo -e "${GREEN}Deployment finished successfully!${NC}"
