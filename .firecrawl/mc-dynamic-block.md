Updated December 3, 2025

# Dev Tools: Dynamic block

DevTools provide much more flexibility in customizing automations. In this article, we'll examine the Dynamic block feature more closely.

Dynamic block allows you to receive a message created on the remote server and then send it to your contacts. Note that the message should be created in a specific format as described in the documentation:

- For Facebook Messenger: [https://manychat.github.io/dynamic\_block\_docs/](https://manychat.github.io/dynamic_block_docs/)
- For Instagram, WhatsApp, and Telegram: [https://manychat.github.io/dynamic\_block\_docs/channels/](https://manychat.github.io/dynamic_block_docs/channels/)

You can find the dynamic block in the content node:

![](https://help.manychat.com/hc/article_attachments/17032839618972)

To set up the dynamic block, follow the instructions below.

1. Choose a request type (POST, GET, PUT, or DELETE)
2. Enter your HTTPS link to the Request URL field

If you don't have your own server yet but want to try this feature, check this article to set up a test server: [Dev Tools: Quick Test with Glitch](https://help.manychat.com/hc/en-us/articles/14281285475484-Dev-Tools-Quick-Test-with-Glitch)
3. Fill in the headers and body if needed

![9-3.png](https://help.manychat.com/hc/article_attachments/24016539277084)

You can test your request by selecting a contact for testing, then switching to the response tab, and clicking the **Test Request** button.

An important option to keep in mind is fallback. It allows the automation to perform a separate step in case of an error with the server response. Setting up a fallback step is not mandatory, but in case it’s missing, you will not know if something goes wrong with the server response.

![](https://help.manychat.com/hc/article_attachments/17032851178140)

💡 You can see error and warning logs related to the dynamic block requests in **Settings → Logs**.

Was this article helpful?

Yes

Yes

Yes

No

No

No

### Related articles

Articles and guides users are reading right now.

## Related articles

- [Dev Tools: External request](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJwR8R79DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwa8B39DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJBL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjg1Mzc0MzY0LURldi1Ub29scy1FeHRlcm5hbC1yZXF1ZXN0BjsIVDoJcmFua2kG--af0a499860c63e23386b594c4d8bb200fbfdcfed)
- [How to generate a token for the Manychat API and where to get parameters](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBygTAibDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwa8B39DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJvL2hjL2VuLXVzL2FydGljbGVzLzE0OTU5NTEwMzMxNDIwLUhvdy10by1nZW5lcmF0ZS1hLXRva2VuLWZvci10aGUtTWFueWNoYXQtQVBJLWFuZC13aGVyZS10by1nZXQtcGFyYW1ldGVycwY7CFQ6CXJhbmtpBw%3D%3D--6b77e25c3193c9dd7b564b76657177dae4ab5e95)
- [Dev Tools: Basics](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJzu8xz9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwa8B39DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSI3L2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjUyMDA3NTgwLURldi1Ub29scy1CYXNpY3MGOwhUOglyYW5raQg%3D--af0eb2ca5edd860be3cf2d282154ec3362a51367)
- [Dev Program - Quick Start](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJzvyR%2F9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwa8B39DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSI%2BL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjk5NTg2OTcyLURldi1Qcm9ncmFtLVF1aWNrLVN0YXJ0BjsIVDoJcmFua2kJ--b3d3864e26df1692faebb70bd02b1d4b887316f0)
- [Conversions API (CAPI) integration](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJz8NeFCDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBwa8B39DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJHL2hjL2VuLXVzL2FydGljbGVzLzE0NTgwODk3NDE0MzAwLUNvbnZlcnNpb25zLUFQSS1DQVBJLWludGVncmF0aW9uBjsIVDoJcmFua2kK--ac7482ad3d87ed83538006d0f8d522e6937209df)

We're sorry you didn't find this article helpful. Please tell us why:

The information was unclear or confusing

The article didn't answer my question

The content was outdated or incorrect

I don't like how this feature works

Other (please specify)

Please note that your feedback here will **not** [create a support ticket](https://help.manychat.com/hc/en-us/articles/14281086345244-How-to-get-support-from-Manychat#h_01J0X28XZ80REE9NXY2BGQXYQS).

Submit feedbackSubmit feedbackSubmit feedback