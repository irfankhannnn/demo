Updated February 17, 2026

# Dev Tools: External request

External request (available on [certain paid plans](https://manychat.com/pricing)) allows you to establish a connection with any integration via HTTP request in case our native integrations don't support your particular case. In this article, we will cover:

- [Supported data types and methods](https://help.manychat.com/hc/en-us/articles/14281285374364-Dev-Tools-External-request#h_01JD7SFYBE9DMFWE0ZD2NFD2VY)
- [How to set up an external request](https://help.manychat.com/hc/en-us/articles/14281285374364-Dev-Tools-External-request#h_01JD7SFYBEA7XY2V7JGFCP07AS)
- [Example of a use case](https://help.manychat.com/hc/en-us/articles/14281285374364-Dev-Tools-External-request#h_01JD7SFYBER18GSRZJCKGKTXR6)

## Supported data types and methods

This feature allows to send to an external server different types of data including contact data such as:

- Contact status
- First name
- Last name
- Name
- Gender
- Language
- Timezone
- Inbox chat URL
- Custom user fields

The supported HTTP methods are POST, GET, PUT, and DELETE.

## How to set up an external request

To create an external request, add an action block to your automation:

![](https://help.manychat.com/hc/article_attachments/17031905911964)

Next, go to **Automation → Make External Request**:

![](https://help.manychat.com/hc/article_attachments/17031883214108)

Once you click on **Add your request**, it will open the configuration window:

![](https://help.manychat.com/hc/article_attachments/17031883214876)

In the configuration window, you will be able to choose a request type (POST, GET, PUT, DELETE):

![](https://help.manychat.com/hc/article_attachments/17031883215772)

After you have specified your request type, you will need to enter the request URL and fill in the headers if necessary.

**⚠️ Note:** only HTTPS links are allowed.

If you are sending a POST or PUT request, the next step is to fill in the request body in JSON format. Here’s an example:

```auto
{

  "id": 123456,

  "first_name": "John",

  "last_name": "Doe",

  "email": "me@mail.com"

}
```

Once it’s done, you can test your request by selecting a contact for testing, then switching to the Response tab, and clicking the **Test Request** button:

![](https://help.manychat.com/hc/article_attachments/17031905918364)

If everything is set up correctly, you will get an HTTP 200 code like this:

![9-2.png](https://help.manychat.com/hc/article_attachments/24016499643420)

## Example of a use case

There is a good free API test service called [SWAPI](https://swapi.dev/), so let’s create a default reply automation for Star Wars fans. We want to get the film title and the opening crawl by sending any word in a message to the Facebook page. If the word is in the title, then the page will respond with the mentioned information.

Firstly, create two custom user fields of text type for the title and the opening crawl. Then, go to the default reply automation, create an action block, and choose an external request.

![](https://help.manychat.com/hc/article_attachments/17031905922460)

We will be making a GET request to [https://swapi.co/api/films/?search=](https://swapi.co/api/films/?search=) to search for a film with a contact’s last text input appended to the end of the link. Lastly, we need to specify [JSON Paths](https://goessner.net/articles/JsonPath/) in the response mapping tab to save the film title and opening crawl values from the response to the corresponding custom user fields.

![](https://help.manychat.com/hc/article_attachments/17031883222300)

After saving the changes and setting the automation live, this is what we will see in Facebook Messenger:

![X7soUCZPYN8gFttkaCJSk7C1mkbEM7IQ0A.png?1686559737](https://help.manychat.com/hc/article_attachments/17031883223964)

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

- [How to generate a token for the Manychat API and where to get parameters](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBygTAibDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwR8R79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJvL2hjL2VuLXVzL2FydGljbGVzLzE0OTU5NTEwMzMxNDIwLUhvdy10by1nZW5lcmF0ZS1hLXRva2VuLWZvci10aGUtTWFueWNoYXQtQVBJLWFuZC13aGVyZS10by1nZXQtcGFyYW1ldGVycwY7CFQ6CXJhbmtpBg%3D%3D--3d5a634b5907339cf41aba3b65e4d5b128348292)
- [Dev Tools: Basics](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJzu8xz9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwR8R79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSI3L2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjUyMDA3NTgwLURldi1Ub29scy1CYXNpY3MGOwhUOglyYW5raQc%3D--64b521ea8642962d6c4c6cf1777f3fd07b46a60c)
- [Custom User Fields and Bot Fields](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBzv5Bf9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwR8R79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJIL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMTY3MTM4NTg4LUN1c3RvbS1Vc2VyLUZpZWxkcy1hbmQtQm90LUZpZWxkcwY7CFQ6CXJhbmtpCA%3D%3D--e90e204554ff3a42fd5079a7d5294ddaf56d14bc)
- [Conversions API (CAPI) integration](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJz8NeFCDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwR8R79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJHL2hjL2VuLXVzL2FydGljbGVzLzE0NTgwODk3NDE0MzAwLUNvbnZlcnNpb25zLUFQSS1DQVBJLWludGVncmF0aW9uBjsIVDoJcmFua2kJ--b50dbd3f22aa11d0fee4a838e8e17708d69dea96)
- [How to export contacts' data](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJwXICj9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwR8R79DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJCL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxNDM5NDUxMDM2LUhvdy10by1leHBvcnQtY29udGFjdHMtZGF0YQY7CFQ6CXJhbmtpCg%3D%3D--1a5e730f53dac35a742a432d28945084daad173f)

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

- [Supported data types and methods](https://help.manychat.com/hc/en-us/articles/14281285374364-Dev-Tools-External-request#h_01JD7SFYBE9DMFWE0ZD2NFD2VY)
- [How to set up an external request](https://help.manychat.com/hc/en-us/articles/14281285374364-Dev-Tools-External-request#h_01JD7SFYBEA7XY2V7JGFCP07AS)
- [Example of a use case](https://help.manychat.com/hc/en-us/articles/14281285374364-Dev-Tools-External-request#h_01JD7SFYBER18GSRZJCKGKTXR6)