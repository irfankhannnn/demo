# Post-MVP Roadmap: Issues for Scale

**Target:** Address when MVP is launched and we have 100+ active users

---

## High Priority (Address First)

### 1. Notifications API Polling Optimization
**Current Issue:**
- `/notifications` and `/notifications/counts` APIs are called every 60 seconds per logged-in user
- ~2,880 API calls/day per user
- With 100 users = ~288,000 API calls/day just for notifications

**Impact:**
- High AWS API Gateway costs
- Unnecessary Lambda invocations
- DynamoDB read capacity consumption

**Suggested Solutions:**

| Option | Approach | Effort | Impact |
|--------|----------|--------|--------|
| Quick Fix | Increase polling interval to 2-3 minutes | Low | Reduces calls by 50-66% |
| Smart Polling | Only poll when notification dropdown is open | Low | Eliminates background polling |
| WebSocket/SSE | Implement real-time push notifications | High | Eliminates polling entirely, instant delivery |
| AWS AppSync | Use GraphQL subscriptions | High | Fully managed, real-time updates |

**Recommendation:** Start with Smart Polling (Option 2) for immediate relief, then implement WebSocket/SSE (Option 3) as the long-term solution.

---

## Medium Priority (Address Next)

*Add issues here as they are identified*

---

## Low Priority (Nice to Have)

*Add issues here as they are identified*

---

## How to Add New Issues

When you identify an issue that should be deferred to post-MVP:

1. Add it to the appropriate priority section above
2. Include:
   - Current Issue description
   - Impact at scale (100+ users)
   - Suggested Solutions with effort/impact analysis
   - Recommended approach

3. Keep this file updated as we discover issues during development

---

**Last Updated:** April 2026
