Updated December 3, 2025

# How to generate a token for the Manychat API and where to get parameters

This article explains how to generate a token for the Manychat API and where to get parameters. The following questions will be covered:

- [What is API Key?](https://help.manychat.com/hc/en-us/articles/14959510331420-How-to-generate-a-token-for-the-Manychat-API-and-where-to-get-parameters#h_01JCR55RJ03A6DHNT7TX141BX2)
- [How to generate and authorize your token](https://help.manychat.com/hc/en-us/articles/14959510331420-How-to-generate-a-token-for-the-Manychat-API-and-where-to-get-parameters#h_01JCR55RJ0ZRJE3HVWXVE0BZ33)
- [Where can I get parameters (like tag ID)?](https://help.manychat.com/hc/en-us/articles/14959510331420-How-to-generate-a-token-for-the-Manychat-API-and-where-to-get-parameters#h_01JCR55RJ0B0PQW6HDW6RW0A42)
- [Is there any limit to the number of API calls?](https://help.manychat.com/hc/en-us/articles/14959510331420-How-to-generate-a-token-for-the-Manychat-API-and-where-to-get-parameters#h_01JCR55RJ0E8SK91Q8772WGYQD)

The URL to the website listing all the API commands can be found [here](https://api.manychat.com/).

## What is API Key?

API Key is a code used to identify the user, developer, or calling program for a website. Manychat provides API Key (available on [certain paid plans](https://manychat.com/pricing)) to use with the Account Public API. Public API Key can be found in **Settings** **→** **API**.

There is also a Profile Public API that's used for connection to non-bot-specific things like Templates. It requires a different key that can be found [here](https://app.manychat.com/profile/dashboard#settings).

## How to generate and authorize API Key

To use the Manychat API, you need to generate an API Key. Navigate to **Settings** **→** **API** and click **Generate your API Key** button.

![](https://help.manychat.com/hc/article_attachments/16931931702684)

**⚠️ Note:** Refreshing and deleting your token will disable all connected API methods.

![](https://help.manychat.com/hc/article_attachments/16931931703964)

After a successful token generation, you can use our Swagger to experiment with API. It is available [here](https://api.manychat.com/swagger).

To add your token to Swagger, click the **Authorize** button:

![](https://help.manychat.com/hc/article_attachments/16931917552284)

To authorize your token, paste your API Key as a Bearer value and click **Authorize**:

![](https://help.manychat.com/hc/article_attachments/16931931709596)

You also can regenerate or delete your API Key in the Settings tab.

## Where can I get parameters (like tag ID)?

**Contact ID** can be found in a contact card in Contacts:

![](https://help.manychat.com/hc/article_attachments/16931917555868)

**Flow\_ns** can be found in your Automation URL in the address bar:

![](https://help.manychat.com/hc/article_attachments/16931931712924)

**Tag ID** – use [/fb/page/getTags](https://api.manychat.com/swagger#/Page/55f8b0c6040a20ba811a08eb4d92b9c2) API method to get a list of all Tag IDs. You can also find it in the interface by proceeding to **Settings** **→** **Tags** and hovering the cursor over the desired tag.

![](https://help.manychat.com/hc/article_attachments/16931931716892)

**Custom User Field ID** – use [/fb/page/getCustomFields](https://api.manychat.com/swagger#/Page/2bc43834222da265c4c41fbd129d1392) API method to get a list of all User Field IDs. You can also find it in the interface by proceeding to **Settings** **→** **Fields** **→** **User Fields** and hovering the cursor over the desired user field.

![to-1.png](https://help.manychat.com/hc/article_attachments/24016355270940)

## Is there any limit to the number of API calls?

Yes, Manychat has a request-based limit. Refer to the table below for details. When you reach the limits, Manychat may stop processing requests for 24 hours.

|     |     |
| --- | --- |
| **PAGE**<br>/fb/page/getInfo<br>/fb/page/getTags<br>fb/page/getGrowthTools <br>/fb/page/getCustomFields <br>/fb/page/getOtnTopics<br>/fb/page/getBotFields | 100RPS |
| **PAGE**<br>/fb/page/getFlows | 10RPS |
| **PAGE**<br>/fb/page/createTag<br>/fb/page/removeTag<br>/fb/page/removeTagByName<br>/fb/page/createCustomField<br>/fb/page/createBotField<br>/fb/page/setBotField<br>/fb/page/setBotFieldByName<br>/fb/page/setBotFields | 10RPS |
| **SENDING**<br>/fb/sending/sendContent<br>/fb/sending/sendContentByUserRef<br>/fb/sending/sendFlow | 25RPS |
| **SUBSCRIBER**<br>/fb/subscriber/getInfo<br>/fb/subscriber/findByName<br>/fb/subscriber/findByCustomField | 10RPS |
| **SUBSCRIBER**<br>/fb/subscriber/findBySystemField | 100RPS |
| **SUBSCRIBER**<br>/fb/subscriber/addTag<br>/fb/subscriber/addTagByName<br>/fb/subscriber/removeTag<br>/fb/subscriber/removeTagByName<br>/fb/subscriber/setCustomField<br>/fb/subscriber/setCustomFields<br>/fb/subscriber/setCustomFieldByName<br>/fb/subscriber/verifyBySignedRequest<br>/fb/subscriber/createSubscriber<br>/fb/subscriber/updateSubscriber | 10RPS |

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

- [Dev Tools: External request](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJwR8R79DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBygTAibDToLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJBL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjg1Mzc0MzY0LURldi1Ub29scy1FeHRlcm5hbC1yZXF1ZXN0BjsIVDoJcmFua2kG--1645d91c3599d1694dbb4e49f0b867118ab8e193)
- [Conversions API (CAPI) integration](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJz8NeFCDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBygTAibDToLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJHL2hjL2VuLXVzL2FydGljbGVzLzE0NTgwODk3NDE0MzAwLUNvbnZlcnNpb25zLUFQSS1DQVBJLWludGVncmF0aW9uBjsIVDoJcmFua2kH--b98e7e4c5c1731f5a07cfc66268846ef211ab931)
- [How to transfer your own WhatsApp number to Manychat](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBxoCSGbDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBygTAibDToLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJbL2hjL2VuLXVzL2FydGljbGVzLzE0OTU5OTI1MzU2NTcyLUhvdy10by10cmFuc2Zlci15b3VyLW93bi1XaGF0c0FwcC1udW1iZXItdG8tTWFueWNoYXQGOwhUOglyYW5raQg%3D--7cf04a01765640c8d0e0750c348a794dd698ca3b)
- [Why WhatsApp messages are sometimes not delivered](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJyrwrQrDjoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBygTAibDToLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJYL2hjL2VuLXVzL2FydGljbGVzLzE1NTgwODc5MDM5Mzg4LVdoeS1XaGF0c0FwcC1tZXNzYWdlcy1hcmUtc29tZXRpbWVzLW5vdC1kZWxpdmVyZWQGOwhUOglyYW5raQk%3D--09ec39d89cd064c59224e6dea4131d637de752b8)
- [WhatsApp pricing guide](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBypmCT9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCBygTAibDToLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSI9L2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMzgwMjQzNzQwLVdoYXRzQXBwLXByaWNpbmctZ3VpZGUGOwhUOglyYW5raQo%3D--a59e7bcd399ac9d06ede6befc743e22b52446d76)

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

- [What is API Key?](https://help.manychat.com/hc/en-us/articles/14959510331420-How-to-generate-a-token-for-the-Manychat-API-and-where-to-get-parameters#h_01JCR55RJ03A6DHNT7TX141BX2)
- [How to generate and authorize API Key](https://help.manychat.com/hc/en-us/articles/14959510331420-How-to-generate-a-token-for-the-Manychat-API-and-where-to-get-parameters#h_01JCR55RJ0ZRJE3HVWXVE0BZ33)
- [Where can I get parameters (like tag ID)?](https://help.manychat.com/hc/en-us/articles/14959510331420-How-to-generate-a-token-for-the-Manychat-API-and-where-to-get-parameters#h_01JCR55RJ0B0PQW6HDW6RW0A42)
- [Is there any limit to the number of API calls?](https://help.manychat.com/hc/en-us/articles/14959510331420-How-to-generate-a-token-for-the-Manychat-API-and-where-to-get-parameters#h_01JCR55RJ0E8SK91Q8772WGYQD)