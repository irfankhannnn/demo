# CloudFormation Deployment Troubleshooting

## Stack Event Timeline Analysis

Based on your events, here's what happened:

### First Attempt (Failed)
- **18:14:12** - `CrmPropertyAgreementPutMethod` UPDATE_FAILED
- **18:14:13** - PublicApiResourcesStack UPDATE_ROLLBACK_IN_PROGRESS
- **18:14:56** - PublicApiResourcesStack UPDATE_FAILED

### Second Attempt (Succeeded!)
- **18:15:07** - ApiLambdaFunction UPDATE_COMPLETE ✅
- **18:15:08** - Both nested stacks UPDATE_IN_PROGRESS
- **18:18:10/22** - Both nested stacks UPDATE_COMPLETE ✅
- **18:18:23** - Parent stack UPDATE_ROLLBACK_COMPLETE

---

## 🎯 Current Status

The **second deployment appears to have SUCCEEDED**!

The stack shows:
```
PublicApiResourcesStack: UPDATE_COMPLETE ✅
CrmApiResourcesStack: UPDATE_COMPLETE ✅
```

---

## ✅ Next Steps - Verify Deployment

### Step 1: Check Stack Status in AWS Console

```bash
# Or manually check AWS Console:
# 1. Go to CloudFormation
# 2. Select stack: cloudberry-dev-real-estate-agency
# 3. Look for Status: CREATE_COMPLETE or UPDATE_COMPLETE (green)
```

### Step 2: Test the API

Start your frontend:
```bash
cd real-estate-crm-app
npm run dev
```

Then test:
1. **Open**: http://localhost:8086
2. **Login**: admin / admin123098
3. **Check DevTools**:
   - Press F12 → Network tab
   - Click Login
   - Find POST request to `/auth/login`
   - Check Response Headers for:
     ```
     Access-Control-Allow-Origin: *
     Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH
     Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With,x-tenant-id
     ```

---

## ❌ If CORS Still Fails

This means the template didn't get fully applied. Try these troubleshooting steps:

### 1. Get Detailed Error from CloudFormation

```bash
# Replace with your region
aws cloudformation describe-stack-resource \
  --stack-name cloudberry-dev-real-estate-agency \
  --logical-resource-id CrmPropertyAgreementPutMethod \
  --region ap-south-1
```

### 2. Check the Stack Events

```bash
aws cloudformation describe-stack-events \
  --stack-name cloudberry-dev-real-estate-agency \
  --region ap-south-1 \
  --query 'StackEvents[0:20]' \
  --output table
```

### 3. Check Lambda Function Logs

```bash
aws logs tail /aws/lambda/dev-real-estate-crm-api \
  --follow \
  --region ap-south-1
```

### 4. Validate Template Syntax

```bash
aws cloudformation validate-template \
  --template-body file://server/cfn-template.yaml \
  --region ap-south-1
```

---

## 🔧 If You Need to Fix and Redeploy

If the issue persists, we can:

1. **Create a minimal test method** - Add a single test method with MethodResponses to isolate the issue
2. **Simplify the MethodResponses** - Reduce to just 200 and 500 status codes instead of all 7
3. **Use alternative approach** - Configure CORS at API Gateway level instead of in each method

Would you like me to proceed with any of these options?

---

## AWS Documentation References

- [AWS::ApiGateway::Method](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-method.html)
- [MethodResponse Reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-apigateway-method-methodresponse.html)
- [API Gateway CORS Configuration](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)

---

## Quick Commands to Run Now

```bash
# 1. Test the API
cd real-estate-crm-app && npm run dev

# 2. Try logging in - should work without CORS errors
# Username: admin
# Password: admin123098

# 3. If it fails, get the error details
aws cloudformation describe-stack-events \
  --stack-name cloudberry-dev-real-estate-agency \
  --region ap-south-1 | jq '.StackEvents[] | select(.ResourceStatus=="UPDATE_FAILED")'
```

---

## Expected Result if Successful

✅ Login succeeds
✅ No CORS errors in browser console
✅ CORS headers present in network response
✅ Frontend can call https://services-api.cloudberrysolutions.in/devrealestatecrm/api from localhost:8086

---

Let me know:
1. Did the login succeed?
2. Are CORS headers present in the response?
3. If it failed, please run one of the AWS CLI commands above and share the output

