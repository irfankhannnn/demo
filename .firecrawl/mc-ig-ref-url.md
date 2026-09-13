Updated August 27, 2026

# Instagram Ref URL Trigger

The **Instagram Ref URL trigger** in Manychat is a versatile tool that helps you direct people straight to your Instagram DM through a specific URL, automatically starting a conversation.

You can use this feature for various purposes. Whether you’re driving traffic from loyalty programs, newsletters, or other channels, the ref URL creates a seamless entry point into your Instagram automation.

This tool is particularly useful for campaigns, promotions, or customer support. It allows you to engage users in real time and pass and save important data, such as names or affiliate IDs, into custom user fields (CUF) when someone clicks on the link.

By sharing this unique URL across multiple platforms—emails, social media posts, or your website—you can capture leads, nurture relationships, and drive meaningful interactions with your audience, all while keeping everything organized within Manychat.

The Instagram Ref URL trigger is currently supported only on the Instagram mobile app. This functionality is not available on the desktop version of Instagram.

In this article, we'll walk you through how to set up and make the most of the Instagram ref URL trigger to boost engagement and enhance your user experience.

## How to set up an Instagram Ref URL trigger

01. Open your Manychat workspace and click the **Automation** tab in the sidebar.
02. Click the **\+ New Automation** button.
03. Click **\+ Start From Scratch**.
04. Select the **Start with a blank** option.
05. Once the Flow Builder opens, click the **+New Trigger** button. ![](https://help.manychat.com/hc/article_attachments/15910510942748)
06. Select the **User clicks a referral link** trigger from the **Instagram** tab. ![](https://help.manychat.com/hc/article_attachments/15910534733468)
07. Next, the panel opens, where you can find your referral link. ![](https://help.manychat.com/hc/article_attachments/15910510944924)
08. Click **Copy URL** to copy the link. ![](https://help.manychat.com/hc/article_attachments/15910534734620)
09. If you want to change the link, switch the toggle on for the **Additional settings**. ![](https://help.manychat.com/hc/article_attachments/15910534734876)
10. Here you can change how the link looks after "Ref" to make the URL more user-friendly. ![](https://help.manychat.com/hc/article_attachments/15910510947996)
11. Also, you can select to save your data, like names or affiliate ID, to custom fields of your choice when someone clicks on the link. ![](https://help.manychat.com/hc/article_attachments/15910510952732)
12. Click **Save** to add the trigger. ![](https://help.manychat.com/hc/article_attachments/15910534736284)

After copying the Ref URL, add the data you want to store in a Custom Field to the end of the link using --, as shown in the example below.

https://ig.me/m/accounthandle?ref=manychat\_giveaway--data

## Set up an automated message in DMs

The Ref URL trigger is just the starting point. To turn engagement into a real conversation, you need to send a private message.

That’s why the next step is to add at least one Instagram message to your flow — this is what brings the automation to life and allows you to publish and run it successfully.

To add a message to your automation:

1. Go back to the automation containing your Instagram Ref URL trigger.
2. Add a next step: select **Instagram** to add a **Send Message** node to your automation.
3. Make sure that the **Send within 24 hours** option is selected. Since the user already opted in to receive messages from you, you have to communicate with them within the allowed 24-hour period.
4. You can select to simply reply with a text message, or add a button, Quick Reply, link, or any other available [content block](https://help.manychat.com/hc/en-us/articles/14281196200604-Content-Block-types#h_01KBMRZM51QWG4F66TR7WJH79E).
5. After configuring the first reply, you can continue building the rest of your automation as needed.
6. To see how it works, you can click the **Preview** button at the top of the Flow Builder.
7. You can choose to preview the automation either in Manychat or directly on Instagram.
8. The second option lets you see everything exactly as your audience will experience it. Click the arrow icon next to the **Preview** button to select the preview mode.
9. Once you’ve finished setting up the automation, click the **Set Live** button.

Due to Meta’s current limitations, [Conversation Starters](https://help.manychat.com/hc/en-us/articles/14281274304924-Conversation-Starters-for-Instagram) must be enabled for the Instagram Ref URL trigger to work for new users. If a user hasn’t interacted with your account before and Conversation Starters aren’t set up, they’ll need to send a message manually to trigger the automation. For users with an existing DM conversation, the Ref URL trigger will work as expected.

Also, if a user opens Instagram DMs via a Ref URL and clicks a Conversation Starter, they won’t receive the response linked to that starter. Instead, the message from the Ref URL trigger will be sent.

Was this article helpful?

Yes

Yes

Yes

No

No

No

On this pageOn this pageOn this page

### Related articles

Articles and guides users are reading right now.

## Related articles

- [Conversation Starters for Instagram](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJwpSB79DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwhYh79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJKL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjc0MzA0OTI0LUNvbnZlcnNhdGlvbi1TdGFydGVycy1mb3ItSW5zdGFncmFtBjsIVDoJcmFua2kG--db924f813f0521a99ae482360aa84b305dae0199)
- [Instagram Ads Trigger](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJwNHyH9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwhYh79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSI8L2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMzIxOTQyNDI4LUluc3RhZ3JhbS1BZHMtVHJpZ2dlcgY7CFQ6CXJhbmtpBw%3D%3D--d9aee20cb841e4b8946f500241ab0ccd98dbcbf1)
- [Conversions API (CAPI) integration](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJz8NeFCDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwhYh79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJHL2hjL2VuLXVzL2FydGljbGVzLzE0NTgwODk3NDE0MzAwLUNvbnZlcnNpb25zLUFQSS1DQVBJLWludGVncmF0aW9uBjsIVDoJcmFua2kI--3ae22f1abbe29498163bf5dde4620c5dfa8ad906)
- [Can't connect Facebook to Manychat](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBx1Eij9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwhYh79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJJL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxNDM4NTU3NDY4LUNhbi10LWNvbm5lY3QtRmFjZWJvb2stdG8tTWFueWNoYXQGOwhUOglyYW5raQk%3D--89771f46a85b465bbed7d5a0dc29fdca3f0223d2)
- [Instagram automation troubleshooting](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBzFUCD9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwhYh79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJLL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMzA4NDIzNDUyLUluc3RhZ3JhbS1hdXRvbWF0aW9uLXRyb3VibGVzaG9vdGluZwY7CFQ6CXJhbmtpCg%3D%3D--d0c4b8a0715e67df0193eff92ccf0aa8b29a0779)

We're sorry you didn't find this article helpful. Please tell us why:

The information was unclear or confusing

The article didn't answer my question

The content was outdated or incorrect

I don't like how this feature works

Other (please specify)

Please note that your feedback here will **not** [create a support ticket](https://help.manychat.com/hc/en-us/articles/14281086345244-How-to-get-support-from-Manychat#h_01J0X28XZ80REE9NXY2BGQXYQS).

Submit feedbackSubmit feedbackSubmit feedback

Contents

On this page

- [How to set up an Instagram Ref URL trigger](https://help.manychat.com/hc/en-us/articles/14281276006684-Instagram-Ref-URL-Trigger#h_01J7V6D06HTA77EV91KEXSAPV5)
- [Set up an automated message in DMs](https://help.manychat.com/hc/en-us/articles/14281276006684-Instagram-Ref-URL-Trigger#h_01KN75XNGKGSZM6ZE7B2PY1CS9)