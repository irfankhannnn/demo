#!/usr/bin/env node
/**
 * Generate CloudFormation YAML for missing API Gateway routes
 * Run: node scripts/generate-missing-cfn-routes.js > infra/missing-routes-patch.yaml
 */

const missingRoutes = [
  { method: 'POST', path: '/api/crm/buyers/:id/list-property', resourceName: 'CrmBuyerListProperty' },
  { method: 'POST', path: '/api/crm/contacts/migrate/all', resourceName: 'CrmContactMigrateAll' },
  { method: 'POST', path: '/api/crm/contacts/migrate/customer/:customerId', resourceName: 'CrmContactMigrateCustomer' },
  { method: 'POST', path: '/api/crm/contacts/migrate/owner/:ownerId', resourceName: 'CrmContactMigrateOwner' },
  { method: 'POST', path: '/api/crm/customers/:id/archive-rental', resourceName: 'CrmCustomerArchiveRental' },
  { method: 'PUT', path: '/api/crm/customers/:id/current-rental', resourceName: 'CrmCustomerCurrentRental' },
  { method: 'GET', path: '/api/crm/customers/:id/rental-history', resourceName: 'CrmCustomerRentalHistory' },
  { method: 'GET', path: '/api/crm/meetings/upcoming', resourceName: 'CrmMeetingsUpcoming' },
  { method: 'GET', path: '/api/crm/properties/:id/rental-history', resourceName: 'CrmPropertyRentalHistory' },
  { method: 'GET', path: '/api/crm/properties/list/detailed', resourceName: 'CrmPropertiesListDetailed' },
  { method: 'PUT', path: '/api/enquiries/:id/close', resourceName: 'EnquiryClose' },
  { method: 'PUT', path: '/api/enquiries/:id/reopen', resourceName: 'EnquiryReopen' },
  { method: 'POST', path: '/api/enquiries/consultation', resourceName: 'EnquiriesConsultation' },
  { method: 'POST', path: '/api/enquiries/contact', resourceName: 'EnquiriesContact' },
  { method: 'POST', path: '/api/notifications/:notificationId/read', resourceName: 'NotificationRead' },
  { method: 'DELETE', path: '/api/notifications/cleanup', resourceName: 'NotificationsCleanup' },
  { method: 'GET', path: '/api/notifications/counts', resourceName: 'NotificationCounts' },
  { method: 'POST', path: '/api/notifications/generate-rent-expiry', resourceName: 'NotificationsGenerateRentExpiry' },
  { method: 'POST', path: '/api/notifications/mark-all-read', resourceName: 'NotificationsMarkAllRead' },
  { method: 'POST', path: '/api/notifications/process-all', resourceName: 'NotificationsProcessAll' },
  { method: 'POST', path: '/api/notifications/process-scheduled', resourceName: 'NotificationsProcessScheduled' },
  { method: 'GET', path: '/api/notifications/settings', resourceName: 'NotificationSettings' },
  { method: 'PUT', path: '/api/notifications/settings', resourceName: 'NotificationSettings' },
  { method: 'POST', path: '/api/notifications/test', resourceName: 'NotificationsTest' },
];

function generateMethodResponses(httpMethod) {
  const statusCodes = ['200', '201', '400', '401', '403', '404', '500'];
  const responses = [];
  
  // For GET/DELETE, only include 200, 400, 401, 403, 404, 500
  const applicableStatuses = (httpMethod === 'GET' || httpMethod === 'DELETE') 
    ? ['200', '400', '401', '403', '404', '500']
    : statusCodes;
  
  for (const status of applicableStatuses) {
    responses.push(`        - StatusCode: ${status}`);
    responses.push(`          ResponseParameters:`);
    responses.push(`            method.response.header.Access-Control-Allow-Origin: true`);
    responses.push(`            method.response.header.Access-Control-Allow-Headers: true`);
    responses.push(`            method.response.header.Access-Control-Allow-Methods: true`);
  }
  
  return responses.join('\n');
}

function generateRoute(route) {
  const { method, path, resourceName } = route;
  const pathParts = path.split('/').filter(p => p && p !== 'api');
  const lastPart = pathParts[pathParts.length - 1];
  
  let output = '';
  
  // Generate Resource
  output += `  ${resourceName}Resource:\n`;
  output += `    Type: AWS::ApiGateway::Resource\n`;
  output += `    Properties:\n`;
  output += `      RestApiId: !Ref RestApiId\n`;
  
  // Determine parent resource
  if (pathParts.length === 1) {
    output += `      ParentId: !Ref ApiResource\n`;
  } else if (path.includes('/crm/buyers/')) {
    output += `      ParentId: !Ref CrmBuyerResource\n`;
  } else if (path.includes('/crm/contacts/')) {
    output += `      ParentId: !Ref CrmContactsResource\n`;
  } else if (path.includes('/crm/customers/')) {
    output += `      ParentId: !Ref CrmCustomerResource\n`;
  } else if (path.includes('/crm/properties/')) {
    output += `      ParentId: !Ref CrmPropertyResource\n`;
  } else if (path.includes('/crm/meetings/')) {
    output += `      ParentId: !Ref CrmMeetingsResource\n`;
  } else if (path.includes('/enquiries/')) {
    output += `      ParentId: !Ref EnquiryResource\n`;
  } else if (path.includes('/notifications/')) {
    output += `      ParentId: !Ref NotificationsResource\n`;
  }
  
  output += `      PathPart: ${lastPart}\n\n`;
  
  // Generate Method
  output += `  ${resourceName}${method}Method:\n`;
  output += `    Type: AWS::ApiGateway::Method\n`;
  output += `    Properties:\n`;
  output += `      RestApiId: !Ref RestApiId\n`;
  output += `      ResourceId: !Ref ${resourceName}Resource\n`;
  output += `      HttpMethod: ${method}\n`;
  output += `      AuthorizationType: NONE\n`;
  output += `      Integration:\n`;
  output += `        Type: AWS_PROXY\n`;
  output += `        IntegrationHttpMethod: POST\n`;
  output += `        Uri: !Sub "arn:aws:apigateway:\${AWS::Region}:lambda:path/2015-03-31/functions/\${LambdaFunctionArn}/invocations"\n`;
  output += `      MethodResponses:\n`;
  output += generateMethodResponses(method) + '\n\n';
  
  // Generate OPTIONS Method
  output += `  ${resourceName}OptionsMethod:\n`;
  output += `    Type: AWS::ApiGateway::Method\n`;
  output += `    Properties:\n`;
  output += `      RestApiId: !Ref RestApiId\n`;
  output += `      ResourceId: !Ref ${resourceName}Resource\n`;
  output += `      HttpMethod: OPTIONS\n`;
  output += `      AuthorizationType: NONE\n`;
  output += `      Integration:\n`;
  output += `        Type: MOCK\n`;
  output += `        PassthroughBehavior: NEVER\n`;
  output += `        ContentHandling: CONVERT_TO_TEXT\n`;
  output += `        RequestTemplates:\n`;
  output += `          application/json: '{"statusCode": 200}'\n`;
  output += `        IntegrationResponses:\n`;
  output += `          - StatusCode: 200\n`;
  output += `            ContentHandling: CONVERT_TO_TEXT\n`;
  output += `            ResponseParameters:\n`;
  output += `              method.response.header.Access-Control-Allow-Headers: !Sub "'\${AllowHeaders}'"\n`;
  output += `              method.response.header.Access-Control-Allow-Methods: !Sub "'\${AllowMethods}'"\n`;
  output += `              method.response.header.Access-Control-Allow-Origin: !Sub "'\${AllowOrigin}'"\n`;
  output += `      MethodResponses:\n`;
  output += `        - StatusCode: 200\n`;
  output += `          ResponseParameters:\n`;
  output += `            method.response.header.Access-Control-Allow-Headers: true\n`;
  output += `            method.response.header.Access-Control-Allow-Methods: true\n`;
  output += `            method.response.header.Access-Control-Allow-Origin: true\n\n`;
  
  return output;
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate output
let output = '# Auto-generated CloudFormation resources for missing API Gateway routes\n';
output += '# Generated by: node scripts/generate-missing-cfn-routes.js\n';
output += '# Add these resources to server/infra/apigw-explicit-routes.yaml before the "CRM Developers" section\n\n';

// Generate all routes
for (const route of missingRoutes) {
  output += `  # ============== ${route.resourceName} ==============\n`;
  output += generateRoute(route);
}

output += `# Total resources generated: ${missingRoutes.length * 2} (Resource + Method pairs)\n`;

// Write to file with UTF-8 encoding
const outputPath = path.resolve(__dirname, '../infra/missing-routes-patch.yaml');
fs.writeFileSync(outputPath, output, { encoding: 'utf8' });
console.log(`Generated CFN patch file: ${outputPath}`);
console.log(`Total routes: ${missingRoutes.length}`);
console.log(`Total resources: ${missingRoutes.length * 2}`);
