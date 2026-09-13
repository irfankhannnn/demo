Updated December 3, 2025

# System Fields

**System Fields** are one of the essential features in Manychat, offering a seamless way to manage and utilize critical contact, account, or system-related information within your automations. System Fields are particularly powerful because of their versatility.

- [What are System Fields and where to find them](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDECAA1FM6GJMC9QM2)
- [System Fields across different channels in Manychat](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDGKDGEXEYBK3443DM)
- [Using System Fields in your automations](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDFT5VZCV5V9RP1MDW)

## What are System Fields and where to find them

System Fields form the backbone of your automations, providing dynamic data that can be used to personalize user experiences, build advanced logic, and optimize your automations’ performance.

While many System Fields store contact-related data, such as the user’s **first name**, **phone number**, or **Instagram profile name**, others store **system-level information** that’s not user-specific. For example:

**Contact-specific fields**:

- First name: Automatically stores the user’s first name.
- Email: Holds the user’s email address.
- Gender: Captures the gender information of the user.

**System-level fields**:

- Last interaction: Tracks the timestamp of the user’s most recent interaction with the account.
- Messaging window segment: Determines whether the user is within the active 24-hour messaging window or outside of it.

These fields are automatically populated as users interact with your account, ensuring real-time data accuracy without manual updates.

Unlike other types of fields in Manychat, System Fields are **not collected in a dedicated section** within your account. However, they are easily accessible when you’re building automations or personalizing messages.

## How to use System Fields

The two most common ways to find and use System Fields are **through variables** and **inside the condition block**:

### Through variables

While building or editing your automations, you can find System Fields in the **variables** menu inside a message node. Simply click the **{}** button to browse all available fields, including System Fields, and insert them into your messages.

![sys1.png](https://help.manychat.com/hc/article_attachments/24006968080540)

### Inside the **Condition block**

System Fields are also available as options when setting up logic in a **Condition block**. To access them, select the field from the dropdown menu while configuring the block.

![](https://help.manychat.com/hc/article_attachments/17599863212572)

By accessing System Fields through variables or the Condition block, you can efficiently integrate them into your automations to create personalized, dynamic, and compliant user experiences.

## System Fields across different channels in Manychat

System Fields are divided into two categories: **general** ones, which are available across all channels, and **channel-specific ones**, which are exclusive to certain platforms like Instagram, Messenger, or WhatsAp, etc.

Below, you’ll find a complete list of all the System Fields, categorized by their availability across different channels, to help you leverage them effectively in your automations.

### General

**First name**: Stores the user’s first name, captured when they interact with the account. This is used to personalize messages, such as addressing users by their first name in conversations.

**Last name**: Stores the user’s last name. Like the first name, this field is useful for more formal personalization or when full names are needed.

**Full name**: Combines the user’s first and last name into a single field. This is ideal for scenarios where a complete name is required, such as in registration confirmations or detailed user reports.

**Email**: Captures and stores the user’s email address, often provided through forms or manual input. This field is commonly used for integrations with email marketing tools, sending notifications, or tracking user activity.

**Phone**: Stores the user’s phone number, typically collected during interactions or opt-ins. This is used for SMS campaigns, phone-based follow-ups, or further personalization.

**Last text input**: Records the most recent text input provided by the user during a conversation. This is particularly useful for troubleshooting, tracking user responses, or dynamically building logic in automations based on user input.

**Subscribed**: Captures the date when the user subscribed to your account. This field is helpful for tracking subscription timelines, analyzing user behavior over time, and triggering time-sensitive automations.

**Contact ID**: A unique identifier automatically assigned to each user interacting with your account. This ID is used for tracking and managing user data, creating reports, and integrating Manychat with external systems or CRMs.

### Facebook Messenger

**Locale**: Captures the language of the user's localization settings as configured in their Facebook account. This includes how Facebook’s interface, buttons, and content are displayed to them. Locale displays all available languages.

**Language**: Identifies the language specified by the user in their Facebook profile. Language shows only the languages of your Contacts. This distinction allows you to segment and personalize your communications more effectively based on linguistic preferences.

**Timezone**: Records the user’s timezone based on their Facebook profile settings. This is essential for scheduling time-sensitive messages like reminders, events, or broadcasts.

**Last interaction in Messenger**: Tracks the exact timestamp of the user’s most recent interaction with your page on Messenger. This helps in re-engagement strategies for determining user activity levels.

**Last Seen in Messenger**: Records the time when the contact last saw a message from your account’s automation on Messenger. Useful for understanding user engagement and optimizing re-engagement efforts.

**Messaging window segment**: Categorizes the user’s messaging eligibility according to Messenger’s [24-hour messaging window policy](https://help.manychat.com/hc/en-us/articles/14281199732892-How-to-send-messages-outside-the-24-hour-and-7-day-windows-in-Messenger-and-Instagram#h_01JDSTGH8YQKEA0RCS56QA44CV). This field determines whether the user is within the active messaging window or outside of it, ensuring compliance with Messenger’s rules for sending messages after the user’s initial interaction.

**Gender**: Captures the user’s gender as specified in their Facebook profile. This can be useful for audience segmentation and crafting personalized campaigns.

**Opted-in for Messenger**: Indicates whether the user has interacted with the Messenger of the Facebook page connected to your Manychat account, thereby automatically subscribing them to it. This interaction serves as an implicit opt-in for receiving messages on Messenger.

**Facebook page ID**: Stores the ID of the Facebook page connected to the Manychat account. This is particularly useful when managing multiple pages or analyzing data across different page environments.

**EEA affected**: Identifies whether a user is located within the European Economic Area (EEA), where stricter data privacy regulations (such as GDPR) apply. This field is essential for ensuring compliance with these regulations by enabling businesses to adjust automations and messaging practices accordingly.

### Instagram

**Last interaction in Instagram**: Tracks the timestamp of the user’s most recent interaction with your account on Instagram. This helps you understand when a user last engaged with your content, allowing you to build re-engagement strategies or segment users based on activity levels.

**Last Seen in Instagram**: Tracks the time when the contact last viewed a message from your automation on Instagram. This helps identify engaged users and adjust your messaging strategy accordingly.

**Messaging window segment**: Categorizes the user’s messaging eligibility according to Instagram’s [24-hour messaging window policy](https://help.manychat.com/hc/en-us/articles/14281199732892-How-to-send-messages-outside-the-24-hour-and-7-day-windows-in-Messenger-and-Instagram#h_01JDSTGH8YQKEA0RCS56QA44CV). This field determines whether the user is within the active messaging window or outside of it, helping you stay compliant with Instagram’s rules for sending messages after the initial interaction.

**Follower count on Instagram**: Displays the total number of followers on the Instagram account connected to Manychat. This field is useful for tracking the growth of your account’s audience and analyzing engagement strategies to optimize performance.

**Instagram username**: Captures the user’s Instagram handle (e.g., @username). This is useful for personalizing messages, creating custom experiences, or referencing their account in follow-ups.

**Opted-in for Instagram**: Indicates whether the user has interacted with your Instagram account connected to Manychat, automatically subscribing them to your account. This field ensures you can identify active subscribers and segment them for messaging and campaigns.

**Follows your Instagram account**: Shows whether the user currently follows your Instagram account. This field can be used to segment users into followers and non-followers, enabling targeted promotions or engagement strategies.

**Verified on Instagram**: Indicates whether the user’s Instagram account has a verification badge. This is useful for identifying verified users and tailoring interactions for high-profile accounts.

**Business follows contact on Instagram**: Tracks whether your Instagram account follows the user’s account. This can be valuable for building stronger connections with specific users or managing reciprocal follow relationships.

**Instagram page name**: Displays the name of your connected Instagram account. This is particularly useful when managing multiple accounts to ensure automations are aligned with the correct Instagram account.

**⚠️ Note**: Instagram contacts do not have a designated Time Zone. For this purpose, their Time Zone is defaulted to UTC+0.

### WhatsApp

**Last interaction in WhatsApp**: Tracks the timestamp of the user’s most recent interaction with your account on WhatsApp. This helps you identify active users and create re-engagement campaigns based on activity.

**Last Seen in WhatsApp**: Captures the time when the contact last viewed a message from your automation on WhatsApp. This allows you to monitor activity levels and tailor follow-ups effectively.

**WhatsApp ID**: Stores the contact's phone number used for WhatsApp. This field ensures accurate communication and allows for personalized messaging within your Manychat automations.

**Opted-in for WhatsApp**: Indicates whether the user has opted in to receive messages from your WhatsApp account. This happens when the user interacts with your account, ensuring compliance with WhatsApp messaging policies.

### Telegram

**Last interaction in Telegram**: Tracks the timestamp of the user’s most recent interaction with your bot on Telegram. This helps segment users by activity and drive follow-ups for inactive users.

**Telegram user ID**: Captures the unique identifier assigned to the user by Telegram. This ID is essential for accurate communication and personalization within Telegram automations.

**Telegram username**: Stores the user’s Telegram handle (e.g., @username). This field can be used to personalize messages or for referencing the user in follow-ups.

**Opted-in for Telegram**: Indicates whether the user has interacted with your Telegram bot, thereby opting in to receive messages. This ensures you can identify subscribers and manage targeted campaigns effectively.

### SMS

**U.S. state (phone-based)**: Identifies the U.S. state associated with the user’s phone number. This is helpful for segmenting audiences geographically and sending region-specific messages.

**Opted-in for SMS**: Indicates whether the user has opted in to receive SMS messages from your account. This happens when the user provides their phone number or interacts through SMS, ensuring compliance with messaging regulations.

**Phone country code**: Stores the country code associated with a user's phone number. This field allows you to identify the user's location based on their phone number and tailor your messaging accordingly.

### Email

**Opted-in for Email**: Tracks whether the user has opted in to receive emails. This typically occurs when the user provides their email address during an interaction, enabling you to include them in email campaigns and automations.

## Real-life examples of using System Fields in automations

System Fields are not just for storing information—they’re powerful tools for creating tailored automations that adapt to user behavior and platform-specific needs.

Let’s explore some practical applications of System Fields within your Manychat workflows, showing how you can use them to enhance engagement, streamline processes, and ensure compliance with messaging policies.

### Example 1: Appointment reminders for a beauty salon via Messenger

A beauty salon wants to send automated reminders to clients about their upcoming appointments while personalizing the experience.

**Expected results:** Clients are reminded on time, reducing no-shows and improving customer satisfaction.

**How to use System Fields:**

- Use **First name** to greet the client.
- Use **Last interaction in Messenger** to engage clients who haven’t responded to confirmations.
- Use **Messaging window segment** to ensure that contact is inside the 24-hour window.

**How to build the automation:**

1. When a client books an appointment through Messenger, schedule a reminder message to be sent 24 hours before the appointment. Include the **First Name** variable in the message to create a more personalized and engaging interaction.
2. Following the reminder message set up two **Conditions**:
   - The user's **Last interaction in Messenger** occurred more than 12 hours ago.
   - The **Messaging window segment** indicates the interaction is still within the 24-hour window.

These conditions ensure compliance with Messenger's [24-hour messaging window policy](https://help.manychat.com/hc/en-us/articles/14281199732892-How-to-send-messages-outside-the-24-hour-and-7-day-windows-in-Messenger-and-Instagram#h_01JDSTGH8YQKEA0RCS56QA44CV). If the user has not responded for more than 12 hours and a follow-up message is sent, the second condition confirms the user is still within the allowed messaging timeframe.

3. For users who respond within the 24-hour window, create a separate flow to send a thank-you message. Personalize this message by including the **First Name** variable to maintain a friendly and professional tone.

![fn.png](https://help.manychat.com/hc/article_attachments/24006968082588)

### Example 2: Online course notifications for an educational platform via Telegram

An online education platform wants to automate course notifications and updates for enrolled students via Telegram.

**Expected results:** The platform ensures students stay informed and engaged, leading to higher course completion rates and a better learning experience.

**How to use System Fields:**

- Use Telegram username to personalize notifications.
- Use Last interaction in Telegram to track engaged students.

**How to build the automation:**

1. When a student enrolls in a course through the Telegram bot, send a welcome message with course details:
2. Following the first message, set up a Condition block with the **Last interaction** in Telegram condition to monitor engagement. If no interaction occurs within 3 days, send a reminder:

![](https://help.manychat.com/hc/article_attachments/17599863216284)

To sum up, System Fields is a powerful tool for creating personalized and efficient automations in Manychat. By using them strategically, you can enhance user engagement, maintain compliance, and optimize your workflows. All in all, mastering System Fields allows you to deliver more dynamic and impactful experiences, helping you achieve your automation goals with confidence.

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

- [How to generate a token for the Manychat API and where to get parameters](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBygTAibDToYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwkXh%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJvL2hjL2VuLXVzL2FydGljbGVzLzE0OTU5NTEwMzMxNDIwLUhvdy10by1nZW5lcmF0ZS1hLXRva2VuLWZvci10aGUtTWFueWNoYXQtQVBJLWFuZC13aGVyZS10by1nZXQtcGFyYW1ldGVycwY7CFQ6CXJhbmtpBg%3D%3D--f6402c7bb42ad7a64512a1801b4de37bac935c0e)
- [How to export contacts' data](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJwXICj9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwkXh%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJCL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxNDM5NDUxMDM2LUhvdy10by1leHBvcnQtY29udGFjdHMtZGF0YQY7CFQ6CXJhbmtpBw%3D%3D--fd44886408904fc667bfdb821bca7299b0fab408)
- [Instagram Ref URL Trigger](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBwhYh79DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwkXh%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJAL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjc2MDA2Njg0LUluc3RhZ3JhbS1SZWYtVVJMLVRyaWdnZXIGOwhUOglyYW5raQg%3D--282f75fbdd1e698b228385d6321c4fa02b6ce016)
- [Instagram Live Comments Trigger](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCBwEYR79DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwkXh%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJGL2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMjc1OTMzNzI0LUluc3RhZ3JhbS1MaXZlLUNvbW1lbnRzLVRyaWdnZXIGOwhUOglyYW5raQk%3D--4714bebab3ee71ed9297639966313d4cfb9e0c57)
- [Instagram Story Mention Reply trigger](https://help.manychat.com/hc/en-us/related/click?data=BAh7CjobZGVzdGluYXRpb25fYXJ0aWNsZV9pZGwrCJw6YSD9DDoYcmVmZXJyZXJfYXJ0aWNsZV9pZGwrCJwkXh%2F9DDoLbG9jYWxlSSIKZW4tdXMGOgZFVDoIdXJsSSJML2hjL2VuLXVzL2FydGljbGVzLzE0MjgxMzA5NTAyMTA4LUluc3RhZ3JhbS1TdG9yeS1NZW50aW9uLVJlcGx5LXRyaWdnZXIGOwhUOglyYW5raQo%3D--f5d96c34081bd341845e59346aa534e490dd6d67)

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

- [What are System Fields and where to find them](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDECAA1FM6GJMC9QM2)
- [How to use System Fields](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW6NRHJECDN0G0CRY0S01M1)
- [Through variables](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDSCBAAGMCKR763PDD)
- [Inside the Condition block](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDK9J5BXQ6ZWYCNRDR)
- [System Fields across different channels in Manychat](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDGKDGEXEYBK3443DM)
- [General](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDW2TWVX1FS1J8HNK8)
- [Facebook Messenger](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDT9M7PTMZADM9AQ1T)
- [Instagram](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDYMSZF20701NAC5BC)
- [WhatsApp](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDVQMT9RMRKGZYSFE7)
- [Telegram](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYD222S686ZFP1KYVM6)
- [SMS](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYD6RWJGXSY8MMWKG08)
- [Email](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYD1WPSXKZ2FVH65TC4)
- [Real-life examples of using System Fields in automations](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDFT5VZCV5V9RP1MDW)
- [Example 1: Appointment reminders for a beauty salon via Messenger](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDWVV21TPR4W03A0KA)
- [Example 2: Online course notifications for an educational platform via Telegram](https://help.manychat.com/hc/en-us/articles/14281292522652-System-Fields#h_01JFW61FYDTYCCX7QTQX97AYET)