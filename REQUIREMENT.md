# Coding Assignment: Candidate Communication Platform

## Implementation Checklist

### Core requirements

- [x] Store candidate name, phone number, and email address.
- [x] Add, list, search, and view candidate details.
- [x] Send a message to an individual candidate through Resend.
- [x] Select multiple candidates and track each delivery result independently.
- [x] Show supported message statuses: Scheduled, Sent, Delivered, Read, and Failed.
- [x] Receive Resend status updates through a signed webhook and safely ignore duplicate events.
- [x] Show recruiter-friendly provider failure reasons and whether a message can be retried.
- [x] View each candidate's message history, timestamps, statuses, and failure reasons.
- [x] Handle loading, empty, and request-failure states in the recruiter interface.
- [x] Paginate the candidate list in the frontend, including page size, range, and navigation controls.

### Optional bonus features

- [x] Create, edit, delete, and reuse personalized message templates.
- [x] Schedule messages for a future date and time.
- [ ] Support multiple selectable communication providers.
- [ ] Show communication-provider health and aggregate delivery statistics.
- [x] Retry eligible failed messages as separately tracked attempts.

## 1. Overview

Build a **Candidate Communication Platform** for recruiters to communicate with candidates and track the complete communication journey.

The platform should allow a recruiter to:

- Create and manage candidates
- Send messages to individual candidates
- Send messages to multiple candidates
- Track message delivery status
- Receive updates when message status changes
- Handle communication failures
- Retry messages when appropriate
- View the complete communication history of a candidate

The goal is to build a product that feels like a simple, usable communication tool for a recruitment team.

# 2. Candidate Management

Recruiters should be able to manage candidates.

Each candidate should have basic information such as:

- Name
- Phone number
- Email address

Recruiters should be able to:

- Add a candidate
- View all candidates
- Search for candidates
- View candidate details

# 3. Send Message

Recruiters should be able to send a message to an individual candidate.

When a message is sent, the platform should record the communication and its current status.

The message should be sent through a communication provider.

# 4. Bulk Messaging

Recruiters should be able to select multiple candidates and send the same message to all selected candidates.

Example:

```text
Candidates

☑ Rahul Sharma
☑ Priya Shah
☐ Amit Kumar
☑ Neha Patel
☐ Rohan Mehta

Message

┌─────────────────────────────────────────────┐
│ Your interview is scheduled for tomorrow.  │
└─────────────────────────────────────────────┘

              [ Send to 3 Candidates ]
```

Each candidate's message should be tracked independently.

For example, if a message succeeds for two candidates and fails for one candidate, the platform should clearly show the individual result for each candidate.

One candidate's failure should not prevent the remaining messages from being processed.

# 5. Message Status

Recruiters should be able to see the current status of each message.

The platform should support statuses appropriate to the selected communication provider.

For example:

- Sent
- Delivered
- Read
- Failed

The status should reflect the latest information received from the communication provider.

# 6. Communication Provider

The platform must communicate with an external communication service.

You may choose one of the following approaches:

### Use a real communication provider

You may use a suitable communication service such as:

- WhatsApp API / WhatsApp Sandbox
- Twilio
- Resend
- Another similar communication service

Use an appropriate test/developer environment where possible.

### Build a dummy communication provider

If you do not want to use a real provider, you may create your own dummy communication service.

The dummy service should behave like an independent communication provider.

It should allow the platform to:

- Send messages
- Return a message/reference ID
- Provide message status updates
- Simulate successful messages
- Simulate failed messages
- Simulate temporary provider failures

The dummy communication service should be separate from the main application.

# 7. Message Status Updates

Message status can change after a message has been sent.

For example:

```text
Message Sent
     ↓
Sent
     ↓
Delivered
     ↓
Read
```

The platform should receive these updates from the communication provider and reflect the latest status to the recruiter.

The platform should also behave correctly if the same update is received more than once.

# 8. Handling Communication Failures

Communication providers can fail for different reasons.

The platform should handle situations such as:

- Invalid recipient
- Temporary provider failure
- Rate limiting
- Message delivery failure
- Communication service unavailable
- Other provider-related errors

The recruiter should receive a meaningful message rather than a raw technical error.

# 10. Communication History

Recruiters should be able to view the communication history of each candidate.

Example:

```text
Candidate: Rahul Sharma
Phone: +91 9876543210

--------------------------------------------------

08 Oct 2026, 10:30 AM

Hello Rahul, your interview is scheduled for
tomorrow at 11:00 AM.

Status: ✓ Delivered

--------------------------------------------------

07 Oct 2026, 09:15 AM

Welcome to our hiring process.

Status: ✓ Read

--------------------------------------------------
```

The history should provide enough information for the recruiter to understand:

- What was sent
- When it was sent
- Current status
- Whether it failed
- Why it failed, where applicable

# 11. User Experience

The platform should provide a clean and intuitive experience for recruiters.

The application should clearly handle situations such as:

- Loading
- Sending a message
- Empty candidate lists
- Empty communication history
- Failed requests
- Failed messages
- Updating message statuses
- Bulk message results

The recruiter should always have a clear understanding of what is happening.

---

# Bonus Features

The following features are optional and can be implemented for additional consideration.

Focus on completing the core requirements before working on these features.

## A. Message Templates

Allow recruiters to create and reuse message templates.

When sending the message, candidate-specific information should be used where applicable.

## B. Scheduled Messages

Allow recruiters to schedule messages to be sent at a future date and time.

Recruiters should be able to see whether a message is:

- Scheduled
- Sent
- Delivered
- Read
- Failed



## C. Multiple Communication Providers

Allow the platform to support more than one communication provider.

The recruiter should be able to select the preferred communication method when sending a message.

## D. Provider Health

Provide visibility into the current health of the communication service.

For example:

```text
Communication Service

● Operational

Messages Sent       127
Messages Delivered  118
Messages Failed       9
```



## E. Retry Failed Messages

Recruiters should be able to retry failed messages when appropriate.

The platform should make a reasonable distinction between failures that can be retried and failures that are permanent.

If the communication provider becomes unavailable, the platform should clearly communicate this to the recruiter.