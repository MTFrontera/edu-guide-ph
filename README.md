# EduGuide PH

**EduGuide PH: An AI-Powered Study and Career Guidance System** is a web-based educational support platform for Amigo School of Calinan, Inc. (ASCI). It combines AI-assisted study/career guidance with role-based student, teacher, guidance, and administrator workflows.

The current application is built with Next.js/React, Supabase, Google Gemini, and Vercel.

> **Project status:** the role-based dashboard, teacher verification flow, student section onboarding, teacher-section assignments, course/subject profile support, Gemini migration, and chat actions are now merged into `main`. The production Vercel build for the merge completed successfully.

---

## Core Features

### Student
- Register and sign in with a school-linked account.
- Use EduGuide AI for academic explanations, brainstorming, study support, and career guidance.
- Use English, Tagalog, Cebuano, or mixed-language prompts.
- Keep signed-in chat sessions/history.
- Copy messages, like/dislike AI replies, regenerate the latest reply, and delete paired prompt/response messages.
- Select, switch, remove, or skip a school section through the student setup flow.

### Teacher
- Register publicly as a teacher applicant.
- Provide a teacher/employee ID during signup.
- Submit private verification proof after sign-in.
- Remain non-staff until an administrator approves the request.
- After approval, access the teacher dashboard.
- View only explicitly assigned sections and their student rosters.
- Select multiple courses/subjects from the school-approved catalog.
- Use the EduGuide AI workspace without receiving unrestricted student chat contents.

### Administrator
- Review teacher verification requests and private proof files.
- Approve or reject teacher accounts.
- Configure the school's teacher-verification administrator email.
- Create school sections.
- Assign multiple verified teachers to the same section.
- Create the school's approved course/subject list.
- See teacher course/subject labels where available.
- View aggregate dashboard activity without exposing student chat message contents.

### AI behavior
EduGuide uses a tutoring-first system prompt. It should:
- explain clearly and directly;
- support English, Tagalog, Cebuano, and mixed language;
- avoid inventing school policies or citations;
- distinguish facts, recommendations, and uncertainty;
- treat career guidance as options/tradeoffs rather than deterministic advice;
- respect privacy and treat uploaded content as untrusted;
- help with assessment-style questions using hints/reasoning instead of giving answer keys or final answers.

---

## Technology Stack

### Application
- Next.js 16
- React 19
- JavaScript
- Tailwind CSS 4 / PostCSS

### Backend / Data
- Next.js API routes
- Supabase PostgreSQL
- Supabase Authentication
- Supabase Storage
- Supabase Row Level Security (RLS)
- Supabase RPC functions

### AI
- Google Gemini REST API
- Default coded model: `gemini-3.8-flash`
- Optional override through `GEMINI_MODEL`

### Hosting
- Vercel

---

## Active Supabase Project

EduGuide PH uses the dedicated Supabase project:

```text
Project: EduGuide PH
Ref: ucbvsvpzvdsyhorriefc
URL: https://ucbvsvpzvdsyhorriefc.supabase.co
```

Do not accidentally point the app back to an older/backup Supabase project. A project mismatch can make authentication appear to work while profiles, verification requests, sections, or chat history appear missing.

---

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

```env
NEXT_PUBLIC_SUPABASE_URL=https://ucbvsvpzvdsyhorriefc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_key

GEMINI_API_KEY=your_server_side_gemini_key
GEMINI_MODEL=gemini-3.8-flash

RESEND_API_KEY=your_resend_key
EDUGUIDE_EMAIL_FROM=EduGuide PH <onboarding@resend.dev>
```

Important:
- Never prefix `GEMINI_API_KEY` or `RESEND_API_KEY` with `NEXT_PUBLIC_`.
- Never commit `.env.local`.
- The current code supports Resend teacher-verification notifications, but notification delivery is not considered configured until a real `RESEND_API_KEY` is present in the deployment environment.
- Supabase Auth confirmation emails are separate from the Resend notification route. Production signup email delivery should use configured Supabase custom SMTP.

---

## Local Development

```bash
git clone https://github.com/MTFrontera/edu-guide-ph.git
cd edu-guide-ph
npm install
cp .env.example .env.local
npm run dev
```

Then open:

```text
http://localhost:3000
```

Useful commands:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

---

## Main Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/register` | Public student/teacher registration |
| `/login` | Authentication + role-aware routing |
| `/prompt` | EduGuide AI workspace |
| `/student-setup` | Student section selection |
| `/teacher-verification` | Teacher proof submission/status |
| `/dashboard` | Role-aware staff dashboard |

Important API routes include:
- `/api/chat`
- `/api/chat/messages`
- `/api/dashboard`
- `/api/sections`
- `/api/teacher-verification/notify`

---

## Account Model

EduGuide intentionally separates **account type** from **authorization role**.

A new teacher applicant normally starts as:

```text
account_type = teacher
role = student
```

That means the person registered as a teacher, but they do not yet have staff access.

After administrator approval:

```text
account_type = teacher
role = teacher
```

This prevents users from granting themselves teacher privileges through signup metadata.

Public registration currently offers only **Student** and **Teacher**. Admin accounts are not meant to be self-created through public signup.

---

## Login Routing

The current routing behavior is:

```text
role = admin/guidance/teacher
    -> /dashboard

account_type = teacher, role != teacher
    -> /teacher-verification

account_type = student and section onboarding incomplete
    -> /student-setup

otherwise
    -> /prompt
```

---

## Teacher Verification Flow

```text
Teacher registration
    -> email confirmation
    -> sign in
    -> /teacher-verification
    -> upload proof
    -> pending request
    -> administrator review
    -> approved or rejected
```

Supported proof formats:
- JPG/JPEG
- PNG
- WEBP
- PDF

Maximum upload size: **5 MB**

Proof is stored in the private `teacher-verifications` Supabase Storage bucket. The proof should not be sent as an email attachment.

Approval changes the profile authorization role to `teacher`.

---

## Sections and Rosters

Students belong to at most one currently selected section.

Teachers and sections use a many-to-many assignment model:

```text
one teacher -> many sections
one section -> many teachers
```

An administrator can therefore assign multiple verified teachers to the same section.

A teacher dashboard returns only sections explicitly assigned to that teacher. Student rosters update according to student section membership.

---

## Courses / Subjects

EduGuide includes a school-scoped course/subject catalog for teacher profile context.

The current design is:

```text
Administrator
    -> creates approved school course/subject list

Teacher
    -> selects zero or more courses from that list
```

This is also many-to-many:

```text
one teacher -> many courses
one course -> many teachers
```

The current implementation treats these selections as lightweight teacher profile/context information. It does not implement grading, attendance, full scheduling, curriculum management, or a full SIS/LMS.

---

## Database / Migration References

Repository references include:

- `SUPABASE_DASHBOARD_UPGRADE.sql`
- `SUPABASE_TEACHER_VERIFICATION.sql`
- `SUPABASE_CHAT_MESSAGE_ACTIONS.sql`
- `SUPABASE_SECTIONS_AND_ROSTERS.sql`
- `SUPABASE_SCHOOL_ADMIN_AND_ACCOUNT_IDS.sql`
- `SUPABASE_COURSES_AND_TEACHER_SUBJECTS.sql`
- `SUPABASE_SETUP.md`

The active EduGuide PH database has already received the relevant live migrations.

**Important:** these files were created across different implementation stages. Do not assume one old SQL file by itself represents the final schema. For a brand-new database, review migration dependencies or create a consolidated migration before running setup blindly.

---

## Privacy and Authorization Boundaries

The application is intended to enforce these rules:

- students cannot self-promote to teacher/admin;
- teacher staff access requires administrator approval;
- verification proof remains private;
- teacher proof is reviewed through protected dashboard access;
- teachers receive only assigned-section rosters;
- teachers should not receive student phone numbers through roster APIs;
- the staff dashboard does not expose unrestricted student chat contents;
- cross-school teacher/section/course operations are rejected;
- privileged mutations are enforced through protected API/RPC logic, not only frontend controls.

Security hardening is still an ongoing concern. Supabase advisor warnings related to security-definer functions and leaked-password protection should not be treated as automatically resolved.

---

## Current Validation Status

The following were actually exercised during development:
- role-aware login routing;
- teacher verification submission;
- pending verification state;
- administrator review/approval;
- teacher role promotion after approval;
- merged `main` production build on Vercel.

The following should still be tested/configured before being described as complete:
- Resend notification delivery;
- Supabase custom SMTP for normal signup confirmation;
- full student section -> teacher roster end-to-end behavior;
- multiple-teacher assignment after the latest UI refinement;
- teacher multi-course selection after the latest refinement;
- formal stakeholder UAT;
- formal AI quality target results.

Do not report planned targets as achieved results.

---

# Troubleshooting

## 1. Login always sends the user to the AI page

**Expected teacher applicant behavior:** `/teacher-verification`.

Check:
1. Confirm the deployment contains the current `main` code.
2. Confirm `profiles.account_type = teacher`.
3. Confirm the profile has not already been promoted to `role = teacher`.
4. Confirm the frontend and Supabase environment variables point to the same active project.
5. Hard refresh/re-authenticate if the browser still has an old session.

An older build used a simple successful-login -> `/prompt` redirect, so a stale deployment can reproduce this symptom.

## 2. Teacher verification submits, but no email arrives

The request can still be valid.

Check the verification request first. If it exists with `status = pending`, the core submission worked.

Then check notification status. A common expected error during development is:

```text
RESEND_API_KEY is not configured.
```

That means the dashboard request exists, but outbound notification email is not configured.

## 3. New users do not receive Supabase confirmation emails

The teacher-notification Resend route does **not** configure Supabase Auth mail automatically.

Check Supabase:
- Authentication email settings
- custom SMTP configuration
- provider limits/rate limits
- redirect URLs

Do not solve this by manually confirming production users as the normal workflow.

## 4. Teacher cannot open the dashboard

Check:
- email is confirmed;
- verification request is approved;
- `profiles.account_type = teacher`;
- `profiles.role = teacher`.

A teacher applicant with `role = student` should remain on the verification flow.

## 5. Administrator sees 403 / “Staff access is required”

Check the matching profile row.

Expected:

```text
account_type = admin
role = admin
```

Also confirm the app is using the same Supabase project where that profile was promoted.

## 6. Approved teacher does not appear in “Assign a verified teacher…”

Check:
- teacher `role = teacher`;
- teacher and section belong to the same `school_id`;
- section is active;
- the teacher is not already assigned to that section.

Already-assigned teachers are intentionally removed from the available-teacher dropdown for that section.

## 7. Need more than one teacher in a section

This is supported.

After the first teacher is assigned, use **Add another verified teacher...**. The underlying `teacher_section_assignments` table is many-to-many.

If the second teacher is missing from the list, check the conditions in troubleshooting case 6.

## 8. Teacher sees a section but no students

Possible causes:
- no students have selected that section;
- students skipped section selection;
- student `section_id` points somewhere else;
- student and section belong to different schools;
- data is stale and dashboard needs refresh.

A section assignment gives the teacher permission to see the roster; it does not automatically place students in that section.

## 9. Student cannot select a section

Check:
- student `account_type = student`;
- section is active;
- section belongs to the same school as the student's `school_id`;
- the relevant RPC/migrations exist in the active Supabase project.

Cross-school section selection should be rejected.

## 10. Course list is empty for a teacher

This can be valid.

The teacher can only choose from the active course/subject catalog created for the teacher's school. Ask an admin to add courses first.

Also verify the teacher and course use the same `school_id`.

## 11. Admin section card says teacher has no courses selected

The admin does not assign the teacher's own teaching profile courses in the current design.

The teacher must open **My Courses / Subjects** and choose from the school-approved catalog. A teacher may select multiple courses.

## 12. Duplicate student/employee ID error

Student IDs and teacher employee IDs are designed to be unique within the same school.

Check whether the ID is already used by another profile before changing constraints or deleting data.

## 13. Duplicate section/course error

Section and course names are normalized through school-scoped uniqueness rules.

Avoid creating visually equivalent duplicates such as:
- `Math` / `math`
- repeated section names within the same school

Use the existing record instead of creating a duplicate.

## 14. Verification proof says “File unavailable”

Check:
- the stored `document_path`;
- private bucket name `teacher-verifications`;
- Storage RLS;
- signed URL generation;
- whether the object was actually uploaded.

Do not make the bucket public as a quick fix.

## 15. Gemini returns configuration/server errors

Check:
- `GEMINI_API_KEY` exists in the deployment scope being tested;
- key is server-only;
- optional `GEMINI_MODEL` is valid;
- Vercel was redeployed after environment changes;
- the request is reaching `/api/chat`.

Never expose the key to the browser.

## 16. The AI refuses to give a quiz answer

That can be intended behavior.

EduGuide includes assessment-help mode. For quiz/test/worksheet-style prompts it should provide hints, reasoning, and guidance rather than an answer key/final answer.

Test ordinary informational prompts separately before treating this as an AI failure.

## 17. Chat actions work as guest but are not saved after refresh

Guest actions are local.

Persistent feedback/regeneration/deletion requires a signed-in user and working Supabase message persistence.

## 18. Changes work locally but not on Vercel

Check:
1. the change is actually committed to `main` or the branch being deployed;
2. Vercel deployment status;
3. environment-variable scope (Production vs Preview);
4. whether a redeploy occurred after env changes;
5. Supabase project URL/key match the expected environment.

## 19. App suddenly looks like data disappeared

Before changing the database, compare:

```text
NEXT_PUBLIC_SUPABASE_URL
```

against the active EduGuide PH project.

Pointing at the old project is one of the easiest ways to get valid authentication with apparently missing profiles/sections/verification data.

## 20. RPC/function not found after moving to another database

The frontend depends on live Supabase functions and tables added by later migrations.

Do not assume the baseline schema is enough. Review the migration references and create/apply a coherent current schema for the target database.

---

## Repository Handoff Notes

For a detailed implementation history, current database state, known test evidence, failure scenarios, and unfinished work, see:

```text
CODING_HANDOFF.md
```

---

