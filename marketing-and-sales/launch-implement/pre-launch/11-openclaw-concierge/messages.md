# AI Employee — Customer Message Templates

## 1. Paid Acknowledgement (sent immediately after webhook)

**Channel:** Email (Brevo template: `BREVO_AI_EMPLOYEE_PAID_TEMPLATE_ID`)
**Subject:** Welcome to AI Employee — setup starts now

**Body:**
```
Hi {{agencyName}},

Thank you for adding AI Employee to your RealEstateFlow account! 🎉

Here's what happens next:

1. Our team has received your activation request
2. We're configuring your AI Employee with your CRM data, WhatsApp Business, and Telegram
3. You'll receive a 90-second walkthrough video once everything is live

⏱️ Expected setup time: within 24 hours
📱 We'll WhatsApp you at your registered number when ready

If you need anything urgent in the meantime, reply to this email or chat with us at realestateflow.in.

— Team RealEstateFlow
```

---

## 2. Activation (sent after status flips to live)

**Channel:** Email (Brevo template: `BREVO_AI_EMPLOYEE_LIVE_TEMPLATE_ID`) + WhatsApp

**Subject:** 🎉 Your AI Employee is live!

**Body:**
```
Hi {{agencyName}},

Your AI Employee is live and ready to work! Here's everything you need:

📹 90-sec Walkthrough: {{loomUrl}}
📱 WhatsApp: {{whatsappNumber}}
💬 Telegram: {{telegramBotLink}}

🔥 Quick tips for your first 7 days:

1. Send a test lead qualification message to your WhatsApp number
2. Check your CRM dashboard — new leads from AI Employee show up automatically
3. Try asking your AI Employee: "Show me buyers looking for 2BHK in Andheri"
4. Set up auto-replies for after-hours messages
5. Add team members so they can see AI Employee activity too

Need help? Reply to this email or tap the chat button inside your CRM.

— Team RealEstateFlow
```

---

## 3. 24h Escalation (sent if SLA missed)

**Channel:** Email (Brevo template: `BREVO_AI_EMPLOYEE_ESCALATED_TEMPLATE_ID`) + WhatsApp

**Subject:** We missed our 24h SLA — sorry. Here's a ₹500 credit.

**Body:**
```
Hi {{agencyName}},

We're sorry. We promised your AI Employee setup within 24 hours, and we missed that deadline.

Here's what we're doing about it:

💰 A ₹500 credit has been applied to your next invoice
📱 Our founder will WhatsApp you within 1 hour with a personal update
🔧 Your setup is now highest priority — expected completion: {{newETA}}

We take our SLA seriously and this shouldn't have happened. Thank you for your patience.

If you need immediate help:
📞 Founder direct: {{founderWhatsApp}}
💬 Chat: realestateflow.in (bottom right)

— {{founderName}}, Founder, RealEstateFlow
```
