Updated September 1, 2026

# Dev Program - Quick Start

**TABLE OF CONTENTS**

- [Preface](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Preface)
- [Step 1: Create an Application](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Step-1%3A-Create-an-Application)
- [Step 2: Install the Application](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Step-2%3A-Install-the-Application)
- [Step 3: Test the Application](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Step-3%3A-Test-the-Application)
- [Step 4: Publish your App](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Step-4%3A-Publish-your-App)
- [What's next](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#What's-next)
- [How to Use the Auth Block](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-the-Auth-Block)
- [Setting up Global Variables within Auth Block](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Setting-up-Global-Variables-within-Auth-Block)
- [How to Use Payload](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-Payload)
- [How to Use Sources](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-Sources)  - [enum:static](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#enum%3Astatic)
  - [enum:rpc](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#enum%3Arpc)
- [How To Use Guidance](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-To-Use-Guidance)
- [How To Make Fields Optional](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-To-Make-Fields-Optional)
- [How to Use Triggers](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-Triggers)
- [How to Use System Fields](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-System-Fields)
- [Summary](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Summary)

* * *

## Preface

Manychat Applications is a way to connect Manychat and 3rd party tools.

It requires understanding of:

- API authentication
- API calls
- JSON

If you have dev experience, this article and provided examples may be used as a comprehensive guide for building your first Manychat Application.

For customers without dev experience, Manychat currently doesn't provide any educational support, but you may find the following resources useful:

- [authenticating and making calls with Postman](https://learning.postman.com/docs/postman/sending-api-requests/requests/)
- [JSON definition by W3Schools](https://www.w3schools.com/js/js_json_intro.asp)
- [JSON path finder](http://jsonpathfinder.com/)

* * *

Let's review how the Manychat Application works. Application consists of name, description, and JSON.

Application Name and Application Description are self-explanatory - please refer to the image attached below. This shows how the Application Name imports into the Actions List after installation:

![WtFURHmhVI_WHwO1eyYzmIUNNlrRP6oRQw.png?1686560375](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-WtFURHmhVI_WHwO1eyYzmIUNNlrRP6oRQw.png)

JSON is a core concept for Manychat Applications as it specifies your integration's details. Then Manychat observes this specification to find out what your app is capable of and transforms JSON into native UI elements for end-users.

A typical App contains:

- `auth` \- If a platform you connect Manychat to requires authorization, set this block up and specify it as `"auth": null`
- `actions` \- Each App should contain at least 1 action
- `sources` \- This is optional. You can set up a source for variables used in your action/actions if needed.

Here is a brief overview of how Manychat identifies Action Title and Description:

![7B9jwITSKcJ_UeGCbnIMko8hXZObLJ0Xgg.png?1686560376](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-7B9jwITSKcJ_UeGCbnIMko8hXZObLJ0Xgg.png)

Let's dive deeper into the details and go through how to develop your own Application.

Below you can find a step-by-step process revealing the app creation process (with open-source examples and use cases). The technical specification is available [here](https://www.notion.so/manychat/Technical-Specification-e82c575bd98045f2bd81cfcfd166673b).

## Step 1: Create an Application

Let's create a simple example application that generates a random number within a given range.

Check these pre-requisites:

- [https://csrng.net/documentation/csrng-lite/](https://csrng.net/documentation/csrng-lite/) will be used as an API
- We expect that the end-user will specify the range using bot fields

Follow these steps to create an app:

- Go to [Applications](https://manychat.com/profile/dashboard#applications) and click '+New Application' button

- Complete these fields:
  - Application Name: _Random Number App_
  - Application Description: _Best Random Number Generation App_
  - Application JSON (refer to the Glitch Project, if you want to try this App — use app\_for\_copy.json, as it doesn't contain comments, the current App JSON field only accepts JSON without comments):

    [![remix this](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-J57wK6Lkz5XTFuFOp7hXYjq1n7dmB_b1yg.png)](https://glitch.com/edit/?utm_content=project_random-number-app-v1&utm_source=remix_this&utm_medium=button&utm_campaign=glitchButton#!/remix/random-number-app-v1)

  - Click the "Create the Application" button

Here are some examples of how this data is imported by Manychat:

Forms JSON → Forms UI:

![FkF4FvjffIzO8oGOat_qIT4587mZ7nQvvg.png?1686560379](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-FkF4FvjffIzO8oGOat_qIT4587mZ7nQvvg.png)

The data captured through the form is used in request: ![4Kl1LmNZhGZyxQNdxwLP7-xU4WPncukxzw.png?1686560380](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-4Kl1LmNZhGZyxQNdxwLP7-xU4WPncukxzw.png)

Mapping:

![8-1.png](https://help.manychat.com/hc/article_attachments/24016636891420)

## Step 2: Install the Application

- Click the 'Install' button under three-dots menu
- Choose the account you want to apply this to and and finish the installation.

## Step 3: Test the Application

- Go to Flow builder and select your App in the Actions List
- Setup the Action

![EoO-KyuPVkKtn9KAuH7SEVPjfQDhM2i1bQ.png?1686560383](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-EoO-KyuPVkKtn9KAuH7SEVPjfQDhM2i1bQ.png)

- Build a new flow like this example:

![UlcnTZmbFi7fWfufPPlcginxAqREzSPLQQ.png?1686560385](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-UlcnTZmbFi7fWfufPPlcginxAqREzSPLQQ.png)

- Preview your flow:

![X6gitMEWmYvl_3rhkpxYW0VaixsXM_LJ9g.png?1686560386](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-X6gitMEWmYvl_3rhkpxYW0VaixsXM_LJ9g.png)


## Step 4: Publish your App

After your application is ready, you can get it reviewed and published.

When you click on the 'Publish' button, you start the [review process](https://help.manychat.com/hc/en-us/articles/14281269734428) conducted by the Manychat team to make your app public. We will review the latest version of your app and inspect the App JSON to make a decision to approve or decline your app.

- If your app is approved for a public version:
  - We will delete the disclaimer from your app page
  - Assign a version number to your app
  - Protect this version from any changes (accidental or intended) that are made to the 'dev' version of your app
- If your app is declined:
  - We will provide feedback and restart the review process as soon as all necessary changes are implemented and you hit the 'Republish' button.

If your app is public, you can list it in [Manychat App Store](https://apps.manychat.com/). It's optional, for more details please contact devprogram@manychat.com

## What's next

We've gone through 4 steps to understand the basic concepts behind creating simple apps. These concepts are pretty the same, no matter what you build: random number generators, data-syncing apps for your CRM. As a next step I would recommend discovering our advanced "how-to" articles below. They will introduce you to creating authorization inside the app, replacing hardcoded values with static and dynamic data sources, adding guidance sections into your app. All these capabilities make your app more functional and user-friendly and therefore more competitive within the Manychat ecosystem.

## How to Use the Auth Block

Random Number API doesn't require the API key, but many other APIs do.

For creating a connection with these APIs, you can set up an `auth` block.

Pre-requisites (we will Taste Dive as an example):

- Create an account here: [https://tastedive.com/account/api\_access](https://tastedive.com/account/api_access)
- View the API docs here:  [https://tastedive.com/read/api](https://tastedive.com/read/api)

Let's try creating an app that requires an API key and then uses it as a query param:

![9VsWJIKLvw18vzX1wLXVE7V41UsKM65bww.png?1686560386](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-9VsWJIKLvw18vzX1wLXVE7V41UsKM65bww.png)

Here is the full code example: [![remix this](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-J57wK6Lkz5XTFuFOp7hXYjq1n7dmB_b1yg.png)](https://glitch.com/edit/?utm_content=project_similar-to-music-app&utm_source=remix_this&utm_medium=button&utm_campaign=glitchButton#!/remix/similar-to-music-app)

## Setting up Global Variables within Auth Block

The Auth Block also can be used to set up global variables like domain names, base URLs, etc.

You may include as many `params objects` as you need. All data entered by your users will be saved and available for re-use in actions.

Here is an example for ActiveCampaign API:

```auto
"params":
  [\
    {\
      "name": "base",\
      "title": "Please enter your Active Campaign base URL"\
    },\
    {\
      "name": "token",\
      "title": "Please enter your Active Campaign token"\
    }\
  ]
```

Then your action request URL may come as `https://[[base]]/api/3/`

This will save time to your users: no need for an additional action form, reusable data can be asked once.

## How to Use Payload

Some API endpoints require payloads.

To make JSON work for these cases, you can add `payload {}` as shown below. Values for payload can be passed from `forms [[]]` .

In this case, we created a record in Pipedrive CRM. API endpoint requires payload with name and email. When the end-user configures action, they choose custom fields for name and email. Then Manychat fires the action adding to payload specific for each contact values associated with custom fields.

![r28AGo_D04tXlbybiYtETuLoZBRccey6YA.png?1686560388](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-r28AGo_D04tXlbybiYtETuLoZBRccey6YA.png)

Here is Glitch link, feel free to use this project as an example:   [![remix this](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-J57wK6Lkz5XTFuFOp7hXYjq1n7dmB_b1yg.png)](https://glitch.com/edit/?utm_content=project_crm-app-with-payload&utm_source=remix_this&utm_medium=button&utm_campaign=glitchButton#!/remix/crm-app-with-payload)

In some cases, there is no need to pass dynamic values for the payload. So it can look like this:

![UCqV0SiGhB4qNfXmL690xka4XH9qgtVI0w.png?1686560389](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-UCqV0SiGhB4qNfXmL690xka4XH9qgtVI0w.png)

Each time action is being processed, we will pass the same payload to the specified URL.

## How to Use Sources

### enum:static

For `random-number-app-v1` we used Min and Max field provided by the user through custom fields.

If we want to provide our own values, we can utilize the `sources` concept.

Refer to the Glitch example and check comments for `forms` and `sources` blocks: [![remix this](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-J57wK6Lkz5XTFuFOp7hXYjq1n7dmB_b1yg.png)](https://glitch.com/edit/?utm_content=project_random-number-app-v2&utm_source=remix_this&utm_medium=button&utm_campaign=glitchButton#!/remix/random-number-app-v2)

Here is how Manychat operates with this data:

![8-2.png](https://help.manychat.com/hc/article_attachments/24016591967900)

### enum:rpc

For `similar-to-music-app` we used custom field for `q` parameter.

Using `enum:rpc` we can provide the list of musicians and bands from this API. Look at this Glitch project to understand how to add `enum:rpc` source to your App:   [![remix this](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-J57wK6Lkz5XTFuFOp7hXYjq1n7dmB_b1yg.png)](https://glitch.com/edit/?utm_content=project_similar-to-music-app-v2&utm_source=remix_this&utm_medium=button&utm_campaign=glitchButton#!/remix/similar-to-music-app-v2)

Here is an example of an implemented code:

![8-3.png](https://help.manychat.com/hc/article_attachments/24016591968284)

## How To Use Guidance

In some cases app action setup may require step-by-step guidance. If action description is not enough to communicate all necessary details, you can add `guidance` field into `action block`.

This is example of a three-step guidance, for line breaks you can use `\n` (which is optional)

![x1ojK_0Clw1YG_jSQgakKBLspGNOO1p-ZQ.gif?1686560393](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-x1ojK_0Clw1YG_jSQgakKBLspGNOO1p-ZQ.gif)

For your app users, it will appear like shown below:

![8-4.png](https://help.manychat.com/hc/article_attachments/24016636893212)

## How To Make Fields Optional

Sometimes action fields aren't required or can be populated with default values. To make setup easier we allow fields to be preconfigured with a new parameter called `default`. ![uMsZo3ciUKFjKGKSgLrNGvVkPNtYrlvVUQ.gif?1686560394](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-uMsZo3ciUKFjKGKSgLrNGvVkPNtYrlvVUQ.gif)

You, as an app developer, can specify the default value for a particular field. This will make the field optional. Until your users specify their own value, you will receive the default one every time this action fires.

How the action form looks like:

![OMTL5iApYTAE_gISe7XNRrr8HklvkTiWFQ.png?1686560395](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-OMTL5iApYTAE_gISe7XNRrr8HklvkTiWFQ.png)

App users are able to skip this field:

![8.gif](https://help.manychat.com/hc/article_attachments/24016750688412)

## How to Use Triggers

Triggers let you start flows when an event takes place in an external app.

Examples of such events:

- contact creates an order or pays for something outside of Manychat
- contact gets tagged in your CRM
- a scheduled event is happening

If you want to send flows when these events happen — triggers are at your disposal.

From a developer's perspective there are a few steps to make triggers work:

- Specify triggers in App JSON (more details are available [here](https://www.notion.so/manychat/Technical-Specification-e82c575bd98045f2bd81cfcfd166673b#77394761ae1142a284a36f6fd0a5f44d))

```auto
"triggers": [\
    {\
      "name": "trigger_tag_added",\
      "title": "Tag added",\
      "description": "Tag \"Deal closed\" is added in X CRM"\
    }\
  ]
```

- Send a hook on the following endpoint [https://hooks.manychat.com/apps/wh](https://hooks.manychat.com/apps/wh) adding the authorization header with App Key each time when the event takes place. Payloads should be in a following format:

```auto
curl -H "Authorization: Bearer <token>" \
-H "Content-type: application/json" \
-X POST \
-d '{"version": 1, "subscriber_id": <sub_id>, "trigger_name": <trigger>}' \
https://hooks.manychat.com/apps/wh
```

### How to get an App Key

When a customer installs your app, Manychat notifies them that this app has triggers and prompts them to provide app developer with the App Key.

We encourage you to clearly communicate with your customers the way you want to obtain the App Key (though the usual way is a special page at your side for configuring external integrations)

![L_k_zhRqTgqHUK5znVrJhrw81dj2Hh-vgw.png?1686560397](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-L_k_zhRqTgqHUK5znVrJhrw81dj2Hh-vgw.png)

### Triggers with context

You can enrich your trigger with external context. Let's check the difference:

|     |     |
| --- | --- |
| **Simple trigger** | **Trigger with context** |
| _Order created_ | _Order created, **order sum is 107 USD**_ |
| _Contact gets tagged as "lead"_ | _Contact gets tagged as "lead", **deal probability is 90%**_ |

Here is JSON example how to specify the trigger with an external context.

Within the `context` you may provide as many variables as you want. All these variables can be used in flow builder for more smart automations.

```auto
"triggers": [\
  {\
    "name": "trigger_tag_added",\
    "title": "Tag added",\
    "context": [\
      {\
        "name": "deal_probability",\
        "type": "number",\
        "title": "Deal Probability"\
      }\
    ],\
    "description": "Tag Deal is added in CRM"\
  }\
]
```

Here is the flow with trigger + context. You can use this context as a condition, as a part of content node and make your automations smart, personalised.

![IaH55lZv_cYYS__iOI8fJ1dfQWPST8qWYw.png?1686560397](https://manychat-remote-images-dev.s3.eu-central-1.amazonaws.com/36000228026-IaH55lZv_cYYS__iOI8fJ1dfQWPST8qWYw.png)

```auto
curl -H "Authorization: Bearer <token>" \
-H "Accept: application/json" \
-X POST \
-d '{"version": 1, "subscriber_id": <sub_id>, "trigger_name": <trigger>, "context": { deal_probability: 90}}' \
https://hooks.manychat.com/apps/wh
```

## How to Use System Fields

For easy access to system fields you can specify them using curly braces {{ }}. All data will be captured automatically.

Here is an example app showing how to capture system fields data without creating forms.

[![8-5.png](https://help.manychat.com/hc/article_attachments/24016636893468)](https://glitch.com/edit/?utm_content=project_webhook-site-mcapp&utm_source=remix_this&utm_medium=button&utm_campaign=glitchButton#!/remix/webhook-site-mcapp)

![8-6.png](https://help.manychat.com/hc/article_attachments/24016636893852)

## Summary

1. Explore this documentation and Glitch projects to understand how to make App JSON for different purposes
2. Click 'Remix to Edit' to make your own app using our examples
3. Copy and paste JSON into Manychat Applications
4. Install your app to get more results with your own integration
5. ```auto
Share your app with clients to get kudos
```


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

- [How to generate a token for the Manychat API and where to get parameters](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBygTAibDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJzvyR%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJvL2hjL2VuLXVzL2FydGljbGVzLzE0OTU5NTEwMzMxNDIwLUhvdy10by1nZW5lcmF0ZS1hLXRva2VuLWZvci10aGUtTWFueWNoYXQtQVBJLWFuZC13aGVyZS10by1nZXQtcGFyYW1ldGVycwY7CFQ6CXJhbmtpBg%3D%3D--f80cd1b1f80f4ad561446c920f4a84b3bcd0dea8)
- [Dev Tools: External request](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJwR8R79DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJzvyR%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJBL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjg1Mzc0MzY0LURldi1Ub29scy1FeHRlcm5hbC1yZXF1ZXN0BjsIVDoJcmFua2kH--05b04b6bbae06bb6b3aead5b7dd1f32fadbf2dce)
- [Conversions API (CAPI) integration](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJz8NeFCDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJzvyR%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJHL2hjL2VuLXVzL2FydGljbGVzLzE0NTgwODk3NDE0MzAwLUNvbnZlcnNpb25zLUFQSS1DQVBJLWludGVncmF0aW9uBjsIVDoJcmFua2kI--5e6afbbbca81671f9f87d3354de5af80f998d503)
- [Can't connect Facebook to Manychat](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBx1Eij9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJzvyR%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJJL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxNDM4NTU3NDY4LUNhbi10LWNvbm5lY3QtRmFjZWJvb2stdG8tTWFueWNoYXQGOwhUOglyYW5raQk%3D--d6d4e50914dda6ad67a2a259d5fcb5cbd49795bc)
- [WhatsApp pricing guide](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBypmCT9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJzvyR%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSI9L2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMzgwMjQzNzQwLVdoYXRzQXBwLXByaWNpbmctZ3VpZGUGOwhUOglyYW5raQo%3D--1e02f467236f9b445be31d48d70aa71f04317c3c)

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

- [Preface](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Preface)
- [Step 1: Create an Application](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Step-1:-Create-an-Application)
- [Step 2: Install the Application](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Step-2:-Install-the-Application)
- [Step 3: Test the Application](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Step-3:-Test-the-Application)
- [Step 4: Publish your App](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Step-4:-Publish-your-App)
- [What's next](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#h_01JEXVNRRNZRDQ3TC7EC8TEEYH)
- [How to Use the Auth Block](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-the-Auth-Block)
- [Setting up Global Variables within Auth Block](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Setting-up-Global-Variables-within-Auth-Block)
- [How to Use Payload](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-Payload)
- [How to Use Sources](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-Sources)
- [enum:static](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#enum:static)
- [enum:rpc](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#enum:rpc)
- [How To Use Guidance](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-To-Use-Guidance)
- [How To Make Fields Optional](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-To-Make-Fields-Optional)
- [How to Use Triggers](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-Triggers)
- [How to get an App Key](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#h_01JEXVNRRPZ4JFETGAHMDBX749)
- [Triggers with context](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#h_01JEXVNRRP6SPDRRKFCSJ3W9SY)
- [How to Use System Fields](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#How-to-Use-System-Fields)
- [Summary](https://help.manychat.com/hc/en-us/articles/14281299586972-Dev-Program-Quick-Start#Summary)