# EduGuide PH - Coding Handoff

This file records the implementation state reached during the long EduGuide PH coding session that completed the role-based dashboard, teacher verification, section/course management refinements, Gemini migration, and production merge.

It is intentionally stricter than a normal README. It separates:

- what is **implemented**;
- what was **actually tested**;
- what is **configured but untested**;
- what is **planned but unfinished**;
- and what can look broken even when the underlying workflow is behaving correctly.

Use this together with the repository history and `README.md`.

---

# 1. Non-Negotiable Handoff Rule

Future work must distinguish implementation plans from historical evidence.

## Safe rule

**Be proactive about future code, architecture, fixes, and drafts. Be conservative about past events, test results, approvals, deployment evidence, and measured performance.**

Examples:

- It is fine to say, “We should test multiple teachers per section next.”
- It is not fine to say, “Multiple teachers per section passed testing,” unless that was actually exercised and verified.
- It is fine to add a planned AI validation test set.
- It is not fine to state the 90% AI target was achieved without recorded results.
- It is fine to implement email sending.
- It is not fine to claim email delivery works until a real message was successfully delivered.

---

# 2. End-of-Session Repository State

Repository:

```text
MTFrontera/edu-guide-ph
```

The main implementation work was developed on:

```text
feature/planned-updates-dashboard-rbac
```

Pull Request:

```text
PR #1 - Add planned staff dashboard and RBAC baseline
```

PR #1 was merged into:

```text
main
```

Merge commit:

```text
0ef4d4901dbb02b18d844e8276da9d92a371afdb
```

After the merge, documentation was also updated directly on `main`.

The merged application received a successful Vercel production build.

## Important historical note

The PR description contains some statements that became outdated during the long-running branch:

- it says Gemini had not yet replaced Groq;
- it says local/build validation had not yet occurred.

Those statements describe an earlier point in the PR history. The final merged code does include the Gemini migration, and the production merge was built successfully by Vercel.

---

# 3. Current Technology Stack

Application:

```text
Next.js 16
React 19
JavaScript
Tailwind CSS 4 / PostCSS
```

Backend and data:

```text
Next.js API routes
Supabase PostgreSQL
Supabase Authentication
Supabase Storage
Supabase RLS
Supabase RPC functions
```

AI:

```text
Google Gemini REST API
Default coded model: gemini-3.8-flash
Optional override: GEMINI_MODEL
```

Hosting:

```text
Vercel
```

The old README incorrectly described Supabase Firestore and Supabase Cloud Functions. That documentation has been replaced.

---

# 4. Active Supabase Project

Use:

```text
Project: EduGuide PH
Project ref: ucbvsvpzvdsyhorriefc
URL: https://ucbvsvpzvdsyhorriefc.supabase.co
```

An older Supabase project exists as a backup/reference.

Do not casually switch environment variables back to an older project.

## Why this matters

A project mismatch can produce very confusing symptoms:

- authentication succeeds but the profile is missing;
- a user appears to have the wrong role;
- verification requests disappear;
- sections look empty;
- chat history appears to vanish;
- admin dashboard data differs between local and production.

Before changing code, always confirm that the environment points to the intended Supabase project.

---

# 5. Environment Variables

Current `.env.example` documents:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ucbvsvpzvdsyhorriefc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_your_key_here

GEMINI_API_KEY=AQ.your_gemini_key_here
GEMINI_MODEL=gemini-3.8-flash

RESEND_API_KEY=re_your_resend_api_key_here
EDUGUIDE_EMAIL_FROM=EduGuide PH <onboarding@resend.dev>
```

Rules:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-safe Supabase values.
- `GEMINI_API_KEY` must remain server-side.
- `RESEND_API_KEY` must remain server-side.
- `.env.local` must not be committed.
- changing Vercel environment variables normally requires a redeploy before the running build receives them.

---

# 6. Account Model: account_type vs role

This distinction is foundational.

## account_type

Represents what type of account the user registered as.

Examples:

```text
student
teacher
admin
guidance
```

## role

Controls authorization.

A teacher applicant is deliberately created as:

```text
account_type = teacher
role = student
```

The person is a teacher applicant, but does not have teacher permissions yet.

After administrator approval:

```text
account_type = teacher
role = teacher
```

This prevents public registration metadata from granting staff access.

---

# 7. Public Registration

Public registration supports:

```text
Student
Teacher
```

Admin is not supposed to appear as a public signup option.

## Student signup data

Student registration collects:

- school;
- first name;
- last name;
- email;
- password;
- age;
- gender;
- contact number;
- grade/year;
- student ID.

Important profile fields:

```text
student_id
phone_number
school_id
grade_year
```

Student IDs are intended to be unique within a school.

## Teacher signup data

Teacher registration collects:

- school;
- first name;
- last name;
- email;
- password;
- age;
- gender;
- contact number;
- employee/teacher ID.

Important profile fields:

```text
employee_id
phone_number
school_id
account_type = teacher
role = student until approved
```

New teachers should not need to enter the same employee ID again during verification.

Legacy teacher accounts created before the employee-ID-at-signup change can still enter it once during verification.

---

# 8. Login Routing

Current routing logic in `app/login/page.js`:

```text
role = admin
role = guidance
role = teacher
    -> /dashboard

account_type = teacher AND role != teacher
    -> /teacher-verification

account_type = student AND section onboarding incomplete
    -> /student-setup

otherwise
    -> /prompt
```

This replaced the older behavior where every successful login simply went to `/prompt`.

---

# 9. Teacher Verification

Route:

```text
/teacher-verification
```

Storage bucket:

```text
teacher-verifications
```

Supported proof types:

```text
JPG / JPEG
PNG
WEBP
PDF
```

Maximum upload size:

```text
5 MB
```

Workflow:

```text
Teacher signs up
    -> confirms email
    -> signs in
    -> teacher verification page
    -> uploads proof
    -> verification request status = pending
    -> administrator reviews
    -> approved OR rejected
```

Approval promotes:

```text
role = teacher
```

Rejection keeps the account non-staff and allows later resubmission.

## Privacy rule

The proof file is private.

It should not be attached to notification emails.

The administrator should authenticate into EduGuide and open a signed private URL from the dashboard.

---

# 10. Teacher Verification Notification Email

Server route:

```text
app/api/teacher-verification/notify/route.js
```

The notification payload can include:

- teacher name;
- teacher email;
- teacher contact number;
- employee ID;
- school;
- submission metadata.

It deliberately does not include the private proof file itself.

Current provider integration:

```text
Resend REST API
```

Expected variables:

```text
RESEND_API_KEY
EDUGUIDE_EMAIL_FROM
```

## Current status

The notification implementation exists.

Actual outbound email delivery is **not considered configured or tested**.

During the teacher workflow test, the verification request saved correctly even though the notification attempt recorded:

```text
RESEND_API_KEY is not configured.
```

This is an important design behavior: **email failure must not destroy the verification request.**

---

# 11. Supabase Auth Email Confirmation

Teacher-verification notification email and Supabase Auth email are separate systems.

The Resend notification route does not automatically fix Supabase signup confirmation.

For production signup confirmation, Supabase should use properly configured custom SMTP.

Until then, built-in provider restrictions/rate limits may make confirmation unreliable.

Do not make manual confirmation the normal production process.

---

# 12. Administrator Architecture

The current implementation has a real `admin` account type/role.

Admin is not a public signup option.

Current dashboard responsibilities include:

- teacher verification queue;
- private proof review;
- approve/reject;
- verification administrator email;
- section creation;
- teacher-section assignments;
- school course/subject catalog;
- aggregate dashboard activity.

Long-term desired onboarding may use an invitation/bootstrap process for a school administrator.

That invitation system is **not implemented yet**.

Do not claim otherwise.

---

# 13. School Administrator Email

`public.schools` includes:

```text
admin_email
```

The administrator dashboard can update the teacher-verification notification email for a school.

The field should not be exposed casually to anonymous/public clients.

---

# 14. Sections

Table:

```text
public.sections
```

Important fields:

```text
id
school_id
name
grade_year
active
created_at
updated_at
```

Student profiles also contain:

```text
section_id
section_onboarding_complete
```

Students may:

- choose a section;
- switch section;
- remove the section;
- complete onboarding without selecting one.

The selection must belong to the student's school.

---

# 15. Teacher-Section Assignments

Table:

```text
public.teacher_section_assignments
```

This is intentionally many-to-many.

```text
one teacher -> many sections
one section -> many teachers
```

The admin UI removes already-assigned teachers from the available dropdown for a specific section.

After one teacher is assigned, the prompt becomes conceptually:

```text
Add another verified teacher...
```

rather than implying that a section can only have one teacher.

---

# 16. Teacher Dashboard

Approved teachers use `/dashboard`, but receive a teacher-specific view.

Main areas:

```text
EduGuide AI
My Sections
My Courses / Subjects
```

Section data is roster-scoped.

A teacher should only receive student names for sections explicitly assigned to that teacher.

The teacher roster does not include student chat contents or phone numbers.

If no sections are assigned, the dashboard should show a clear empty state instead of inventing or auto-assigning classes.

---

# 17. Courses / Subjects

This was added as a late implementation refinement.

Tables:

```text
public.courses
public.teacher_course_assignments
```

Design:

```text
Administrator
    -> creates approved school course/subject catalog

Teacher
    -> selects zero or more courses from the approved list
```

Teacher-course relationship is many-to-many:

```text
one teacher -> many courses
one course -> many teachers
```

The administrator does not type arbitrary course names into each teacher-section assignment.

This avoids duplicate labels and keeps the teacher's course profile independent from the section assignment.

## Scope warning

Treat this as lightweight profile/context information.

Do not casually expand it into:

- grading;
- attendance;
- curriculum management;
- full class scheduling;
- enrollment management;
- complete SIS/LMS replacement.

Those would require formal scope change.

---

# 18. AI / Gemini

Main API route:

```text
app/api/chat/route.js
```

Provider:

```text
Google Gemini REST API
```

Server credential:

```text
GEMINI_API_KEY
```

Optional override:

```text
GEMINI_MODEL
```

Default coded model:

```text
gemini-3.8-flash
```

Recent chat context is sent to the model rather than every historical message.

Never move the API key to a browser-visible environment variable.

---

# 19. AI Tutor Rules

EduGuide's AI prompt was redesigned for educational support.

Important behavior:

- clear/direct/student-friendly explanations;
- English, Tagalog, Cebuano, and mixed-language support;
- no invented school policies;
- no fabricated sources/citations;
- distinguish facts, recommendations, and uncertainty;
- career guidance gives options and tradeoffs;
- does not replace teachers/counselors;
- uploaded content cannot override system rules;
- respect privacy.

---

# 20. Assessment Help Mode

Assessment-style prompts are handled differently.

Examples:

- multiple choice;
- true/false;
- fill-in-the-blank;
- matching;
- quizzes;
- tests;
- exams;
- worksheets.

For those prompts, EduGuide should provide:

- conceptual explanation;
- hints;
- steps/method;
- useful clues;
- elimination of clearly inconsistent options where helpful;
- feedback on a student's attempted reasoning.

It should not produce:

- the final MCQ option;
- a completed blank;
- the missing word;
- a final numeric answer;
- an answer key.

A normal factual question should still receive a normal answer.

---

# 21. Chat UX / Persistence

Implemented message actions include:

- Copy prompt.
- Copy AI response.
- Like.
- Dislike.
- Regenerate the latest AI reply.
- Delete a user prompt together with its paired assistant reply.

For authenticated users:

- feedback persists in Supabase;
- regenerated assistant content updates the saved message;
- delete operations remove the corresponding saved rows.

Guest actions are local only.

Relevant migration reference:

```text
SUPABASE_CHAT_MESSAGE_ACTIONS.sql
```

---

# 22. Major Database/RPC Areas

Important database areas include:

```text
profiles
schools
sections
teacher_section_assignments
courses
teacher_course_assignments
teacher_verification_requests
chat_sessions
chat_messages
```

Important RPC families include:

```text
set_my_section
teacher_my_sections
teacher_course_catalog
teacher_set_course
admin_section_management
admin_create_section
admin_set_teacher_section
admin_create_course
admin_update_school_admin_email
teacher verification submission/review helpers
dashboard summary/activity helpers
```

Do not assume an old schema file alone recreates the final project.

The live database evolved across multiple migrations.

---

# 23. Repository SQL References

Known migration/reference files include:

```text
SUPABASE_DASHBOARD_UPGRADE.sql
SUPABASE_TEACHER_VERIFICATION.sql
SUPABASE_CHAT_MESSAGE_ACTIONS.sql
SUPABASE_SECTIONS_AND_ROSTERS.sql
SUPABASE_SCHOOL_ADMIN_AND_ACCOUNT_IDS.sql
SUPABASE_COURSES_AND_TEACHER_SUBJECTS.sql
SUPABASE_SETUP.md
```

The active database already received the live changes.

For a fresh project, review migration ordering and compatibility rather than blindly executing every historical file.

---

# 24. What Was Actually Tested

The following had direct evidence during the coding session:

```text
PASS / OBSERVED

- dedicated EduGuide Supabase project in use;
- administrator account confirmed;
- teacher test account confirmed;
- role-aware teacher login reached verification flow;
- teacher verification submission created a database request;
- request status became pending;
- proof path/request data were persisted;
- missing Resend configuration did not prevent request creation;
- administrator could review the teacher request;
- administrator approval succeeded;
- verification status became approved;
- profile role changed from student to teacher;
- role-routing changes were merged to main;
- Vercel production build for the merge succeeded.
```

These are legitimate evidence.

---

# 25. What Was NOT Fully Tested / Configured

Do not silently upgrade these to “done”:

```text
NOT YET VERIFIED AS COMPLETE

- Resend notification delivery;
- custom SMTP for ordinary Supabase Auth confirmation;
- final end-to-end student section -> teacher roster behavior;
- final multiple-teachers-per-section UI test after the latest refinement;
- final teacher multi-course selection UI test after the latest refinement;
- formal stakeholder UAT;
- formal AI >=90% validation result;
- final security-advisor cleanup.
```

---

# 26. Security / Privacy Boundaries

Maintain these rules:

- public users cannot self-grant staff roles;
- teacher approval is required for teacher authorization;
- verification proof remains private;
- proof email attachment is prohibited by design;
- teacher rosters are assigned-section scoped;
- student phone numbers are not part of the teacher roster output;
- unrestricted student chat contents are not exposed in the staff dashboard;
- cross-school teacher/section/course actions are rejected;
- admin-only changes must be enforced server-side/database-side, not only hidden in UI.

Known hardening items remain:

- review Security Definer RPC exposure;
- review Supabase advisor warnings;
- enable/use appropriate leaked-password protection if available;
- eventually perform a dedicated RLS/security test pass.

---

# 27. Scope / Papers Compatibility

The original project papers focus on:

- AI academic support;
- career guidance;
- student activity/query information;
- teacher/admin dashboard;
- role-based access;
- privacy controls.

Later implementation added more detailed operational structure:

- teacher verification workflow;
- school sections;
- many-to-many teacher-section assignment;
- teacher course/subject labels.

These should be described as **implementation-stage refinements or change-controlled additions**, not falsely backdated as original SAD requirements.

A safe explanation is:

> During implementation and dashboard testing, the team identified a need for clearer teacher organization. The dashboard was refined to support multiple teacher-section assignments and teacher subject identification without changing EduGuide's primary AI study/career-guidance purpose.

---

# 28. Troubleshooting / Failure Cases

The following cases should be checked before rewriting code.

## Case 1 - Successful login immediately goes to /prompt

This can mean the browser is using an old/stale build.

Check:

1. Is the current deployment built from `main`?
2. Does `app/login/page.js` contain role-aware routing?
3. Is the browser session stale?
4. Does the profile have the expected `account_type` and `role`?
5. Is the app connected to the correct Supabase project?

Expected teacher applicant:

```text
account_type = teacher
role = student
-> /teacher-verification
```

Expected approved teacher:

```text
account_type = teacher
role = teacher
-> /dashboard
```

---

## Case 2 - Teacher is repeatedly sent back to verification after approval

Check the actual profile row.

Approval should result in:

```text
role = teacher
```

Possible causes:

- approval transaction did not update profile;
- wrong Supabase project;
- cached/stale auth state;
- request was approved in one database but deployment points to another.

Sign out and sign back in after confirming the database state.

---

## Case 3 - Teacher verification request saved but no email arrived

This does not automatically mean the submission failed.

Check:

```text
teacher_verification_requests.status
notification_sent_at
notification_error
```

If the request is `pending`, the core verification workflow exists.

A development-time error such as:

```text
RESEND_API_KEY is not configured.
```

means email notification is missing, not the verification request.

---

## Case 4 - Signup user never receives confirmation email

Do not debug the teacher-verification notification route first.

Supabase Auth confirmation mail is separate.

Check:

- Supabase Authentication email provider;
- custom SMTP;
- rate limits;
- sender/provider verification;
- site/redirect URL.

Manual confirmation is useful for controlled testing but should not be the normal production workflow.

---

## Case 5 - Teacher proof uploads, but admin sees “File unavailable”

Check:

1. `document_path` exists on the request.
2. Object exists in `teacher-verifications`.
3. Storage bucket remains private.
4. Storage RLS permits the expected signed URL workflow.
5. Dashboard API successfully generates the signed URL.

Do not fix this by making the bucket public.

---

## Case 6 - Admin dashboard returns 403

Check the profile:

```text
role = admin
account_type = admin
```

Also verify the user authenticated against the same Supabase project that contains the promoted profile.

---

## Case 7 - Teacher does not appear in “Assign a verified teacher…”

The dropdown intentionally includes only eligible teachers.

Check:

- `role = teacher`;
- teacher and section have the same `school_id`;
- section is active;
- teacher is not already assigned to that section.

If already assigned, they should appear under Assigned Teachers instead.

---

## Case 8 - Cannot add a second teacher to the same section

The database model supports this.

Do not change the primary key to one row per section.

`teacher_section_assignments` uses the teacher-section pair, so the same section can have several teachers.

If the UI does not offer another teacher, check Case 7 conditions.

---

## Case 9 - Teacher sees zero assigned sections

This may be correct.

Approval gives teacher authorization; it does not automatically assign a section.

An administrator must explicitly create/select a section and assign the teacher.

---

## Case 10 - Teacher sees section but roster is empty

Possible valid causes:

- no student selected that section;
- students skipped section setup;
- student belongs to another section;
- student has another school;
- dashboard data needs refresh.

Teacher-section assignment and student-section membership are separate relationships.

---

## Case 11 - Student cannot select a section

Check:

- profile `account_type = student`;
- section is active;
- section belongs to same school;
- `set_my_section` exists in the active database;
- API is authenticated.

A cross-school section should be rejected.

---

## Case 12 - Student changed section but teacher still sees old roster

Check:

- student's `profiles.section_id`;
- dashboard refresh;
- teacher's section assignment;
- whether the test is using cached page state;
- whether local and production point to the same database.

The roster is derived from current section membership rather than a permanently copied class list.

---

## Case 13 - Course list is empty on teacher dashboard

This can be expected.

The teacher only sees active courses for their school.

Administrator must add school courses first.

Also verify:

- teacher `school_id`;
- course `school_id`;
- `teacher_course_catalog` exists.

---

## Case 14 - Teacher can select only one course

That is a bug if reproduced.

The intended design is many-to-many.

Check:

```text
teacher_course_assignments
primary key = (teacher_id, course_id)
```

Do not replace this with a single `course_id` column on profiles.

---

## Case 15 - Teacher's subjects do not appear beside their name in admin section cards

Check whether the teacher actually selected courses.

Admin section assignment does not automatically assign teacher course profile data.

The teacher chooses from the school-approved catalog.

If selected in DB but not displayed, inspect `admin_section_management()` and dashboard rendering.

---

## Case 16 - Duplicate course creation fails

This can be intentional.

Course names are school-scoped with case-insensitive uniqueness.

Avoid duplicates such as:

```text
Mathematics
mathematics
```

Use the existing course instead.

---

## Case 17 - Duplicate student/employee ID fails

IDs are intended to be unique within a school.

Before weakening constraints, check whether another profile already owns the identifier.

---

## Case 18 - Gemini route returns server/config error

Check:

1. `GEMINI_API_KEY` exists.
2. It is present in the correct Vercel environment.
3. A redeploy happened after env changes.
4. Optional `GEMINI_MODEL` is valid.
5. The deployment is current.
6. The request reached `/api/chat`.

Never expose the key in frontend JavaScript.

---

## Case 19 - AI “refuses” to answer a quiz

This can be correct assessment-help behavior.

Test with a normal informational question.

If normal questions work but quiz questions receive hints instead of final answers, assessment mode is functioning as designed.

---

## Case 20 - AI gives a direct quiz answer anyway

Possible causes:

- heuristic failed to detect the assessment;
- prompt wording does not look like an assessment;
- system prompt changed;
- route bypassed the assessment mode injection.

Reproduce with a controlled MCQ/true-false/fill-blank example before changing policy.

---

## Case 21 - Chat feedback/regenerate/delete disappears after refresh

Check whether the user is signed in.

Guest actions are local.

Persistence requires:

- authenticated session;
- chat message rows in Supabase;
- chat-message-actions migration/API;
- correct Supabase project.

---

## Case 22 - App works locally but production looks old

Check:

- latest commit on `main`;
- latest Vercel deployment source;
- deployment status;
- Production environment variables;
- whether a redeploy occurred.

Do not assume a GitHub commit automatically means the browser is already serving it.

---

## Case 23 - Production has auth but “all data is missing”

Check `NEXT_PUBLIC_SUPABASE_URL` before writing migrations or recreating rows.

This symptom strongly suggests a project/environment mismatch.

---

## Case 24 - RPC/function not found

The target database may not have received newer migrations.

Check the active project for:

- tables;
- function signatures;
- migration history.

Do not blindly run one old setup script and assume the schema is current.

---

## Case 25 - Admin email save works but no notifications send

These are different features.

Saving `schools.admin_email` only configures the destination.

Notification sending still requires a server email provider key and valid sender configuration.

---

## Case 26 - Email notification should contain teacher proof

It should not.

The intended privacy flow is:

```text
email notification
    -> tells admin a request exists
    -> admin signs into protected dashboard
    -> admin opens private signed proof URL
```

---

## Case 27 - Need admin public registration

Do not simply add “Admin” to the signup dropdown.

The intended model is controlled admin provisioning/invitation.

That onboarding flow is a future feature.

---

## Case 28 - Need to show student chat content to teachers

Do not expose it automatically.

The project papers mention aggregated student query/common-challenge information, but current privacy design deliberately avoids unrestricted raw chat content.

Any future query analytics should be designed as a scoped aggregate/approved workflow, not a direct chat-history dump.

---

## Case 29 - Course/section features are challenged as outside the papers

Do not say they were in the original SAD if they were not.

Describe them as implementation-stage refinements and record them in change control if formal documentation is required.

---

## Case 30 - Someone wants to keep adding features because the system is working

Prefer validation over feature expansion.

Highest-value remaining work:

1. email configuration;
2. student/teacher section end-to-end tests;
3. teacher multi-course test;
4. multi-teacher section test;
5. AI validation;
6. security/RLS review;
7. UAT evidence;
8. documentation and handover.

---

# 29. Recommended Resume Checklist

When development resumes:

```text
1. Pull latest main.
2. Confirm Vercel production is healthy.
3. Confirm local/Vercel Supabase URL is ucbvsvpzvdsyhorriefc.
4. Confirm required environment variables without exposing secrets.
5. Run npm install.
6. Run npm run build before significant deployment.
7. Test the exact role/workflow being modified.
8. Inspect live DB state before calling a test passed.
9. Record actual evidence.
10. Avoid adding new scope unless it solves a real requirement.
```

---

# 30. Suggested Next Tests

## Test A - multiple teachers in one section

1. Have two approved teacher profiles in the same school.
2. Assign teacher A to one section.
3. Add teacher B to the same section.
4. Confirm two assignment rows exist.
5. Confirm both teachers see the section.
6. Confirm removing A leaves B intact.

## Test B - one teacher in multiple sections

1. Create or use two real test sections.
2. Assign the same approved teacher to both.
3. Confirm two assignment rows exist.
4. Confirm teacher dashboard lists both.

## Test C - teacher multiple courses

1. Admin adds at least two courses.
2. Teacher selects both.
3. Confirm two teacher-course assignment rows.
4. Confirm admin UI displays both labels.
5. Remove one.
6. Confirm only that mapping disappears.

## Test D - student roster movement

1. Student selects section A.
2. Confirm teacher A roster contains student.
3. Student switches to section B.
4. Confirm section A roster loses student.
5. Confirm section B assigned teacher gains student.
6. Student removes section.
7. Confirm student disappears from both rosters.

Do not mark these tests passed until the observed database/UI evidence exists.

---

# 31. Known Documentation Files

Main developer entry point:

```text
README.md
```

Supabase notes:

```text
SUPABASE_SETUP.md
```

This coding history:

```text
CODING_HANDOFF.md
```

Keep documentation synchronized with actual code. If a later implementation changes routing, schema, security boundaries, or email behavior, update these files in the same change whenever practical.

---

# 32. Final State at Handoff

At the end of the implementation session:

```text
CODE
- major branch merged into main
- role-aware login in main
- Gemini integration in main
- staff dashboard in main
- teacher verification in main
- student section onboarding in main
- section/teacher assignment in main
- course/subject profile support in main
- chat message actions in main

DATABASE
- dedicated EduGuide PH project active
- live migrations applied for implemented workflows

DEPLOYMENT
- merged production build succeeded on Vercel

NOT FINISHED
- Resend delivery configuration
- Supabase Auth custom SMTP
- latest section/course refinements need final end-to-end UI testing
- formal AI validation
- formal UAT
- final security hardening
```

This is the point future development should continue from.
