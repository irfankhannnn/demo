# Playwright MCP Setup for Cascade

## What We've Done

✅ Installed Playwright MCP server globally
✅ Created `mcp-config.json` configuration

## Next Step: Configure Cascade to Use MCP Server

### How to Add MCP Server to Cascade

1. **Open Cascade Settings**
   - Look for MCP/MCP Servers configuration in Cascade settings
   - This is typically in Settings → MCP or Tools → MCP

2. **Add New Server**
   - Add a new MCP server with name: `playwright`
   - Point to the config file: `mcp-config.json`
   - Or configure manually with these settings:
     ```
     Command: npx
     Args: -y @executeautomation/playwright-mcp-server
     Environment:
       HEADLESS=false
       BROWSER=chromium
       SLOW_MO=500
       TIMEOUT=60000
     ```

3. **Test Connection**
   - Cascade should show the MCP server as connected
   - You should see Playwright tools available in the MCP tool list

## Once Configured

I will be able to use these MCP tools:
- `playwright_navigate` - Navigate to URLs
- `playwright_click` - Click elements
- `playwright_fill` - Fill form inputs
- `playwright_screenshot` - Take screenshots
- `playwright_get_text` - Get text from elements
- `playwright_wait_for_selector` - Wait for elements
- `playwright_evaluate` - Execute JavaScript
- `playwright_get_page_info` - Get page information
- And more...

## First Test Flow

Once MCP is connected, we'll test:
1. Navigate to http://localhost:3000
2. Click "Continue with Phone"
3. Enter phone: 8291537522
4. Click "Send OTP"
5. Wait for OTP inputs
6. Enter OTP: 123456
7. Verify login success

## Need Help Configuring?

If you're not sure how to add the MCP server to Cascade:
1. Check Cascade documentation for MCP setup
2. Look for "MCP Servers" or "Model Context Protocol" in settings
3. The config file is at: `real-estate-crm-app/mcp-config.json`

Let me know when MCP is configured and I'll start testing!
