# Ykay College EduPortal — End-to-End User Flow Documentation

## 1. Product Scope

This project now functions as a full digital education platform for Ykay College rather than a simple school website. The current experience covers:

- public site browsing,
- admissions submission and tracking,
- portal sign-in and role-based access,
- school operations for admin, teacher, student, and parent users,
- IT education learning and certification scaffolding,
- and exam/CBT-related workflows.

The implementation is advanced enough to support a real school operating experience, but some flows still need stronger completion and hardening before they can be considered fully production-ready.

---

## 2. How to Read This Document

The flows below are grouped by audience and journey. Each flow reflects what is currently visible in the repository and what is implemented at a practical level.

Status legend:
- Implemented: visible in the app and wired to live UI/API layers.
- Partially implemented: the flow exists, but some business logic, data wiring, or operational behavior is still incomplete.
- Planned / missing: the flow is part of the product vision but is not yet completed in the current implementation.

---

## 3. Public and Unauthenticated Flows

### Flow 3.1 — Visitor discovers the school website
Status: Implemented

Who: prospective family, alumni, visitor, or partner

Entry point: homepage or direct page URL

Journey:
1. The visitor lands on the homepage and sees the branded school experience.
2. They can navigate to about, academics, admissions, campus life, news, alumni, contact, and portal entry pages.
3. They can browse public information about the school and move to admissions or portal access.
4. They can also reach the portal selection page to choose staff, student, parent, or IT learning access.

What is currently supported:
- strong public page structure,
- portal entry surface,
- admissions entry point,
- IT education hub entry point.

---

### Flow 3.2 — Parent begins an admissions application
Status: Implemented

Who: parent or guardian

Entry point: /admissions

Journey:
1. The parent opens the admissions landing page.
2. They begin the application form and move through the steps for student details, parent details, academic history, document upload, review, and submission.
3. The application can be submitted after the required documents and fee payment flow are completed.
4. The parent receives a confirmation and can track the application later.

What is currently supported:
- multi-step form UI,
- document upload interface,
- payment flow integration,
- submission and status logic through backend APIs.

What is still maturing:
- the full review/approval handoff into student records,
- some operational follow-up automation.

---

### Flow 3.3 — Parent checks application status
Status: Implemented

Who: parent or guardian

Entry point: /admissions/status

Journey:
1. The parent enters an application identifier.
2. The app checks the application state.
3. The current status is shown to the parent.

Current state:
- the route and status lookup experience are present,
- the business logic is connected to the backend,
- but operational decisions such as full approval/decline workflows still need deeper completion.

---

## 4. Authentication and Portal Access Flows

### Flow 4.1 — User chooses a portal and signs in
Status: Implemented

Who: staff, student, parent, IT learner

Entry point: /portal or /login

Journey:
1. The user visits the portal selection page.
2. They choose the relevant portal or go directly to login.
3. They enter credentials on the login page.
4. The app authenticates the user and routes them based on role.

Current behavior:
- login is functional and role-based,
- middleware protects portal routes,
- successful auth redirects users to the appropriate dashboard.

---

### Flow 4.2 — Staff member accesses the admin or teacher experience
Status: Implemented

Who: admin, teacher, coordinator, bursar, HOD

Entry point: /login?portal=staff

Journey:
1. The staff user signs in.
2. The backend verifies the account and issues a session cookie.
3. Middleware checks the role and sends the user to the correct dashboard.
4. The user reaches the appropriate admin or teacher portal.

What is implemented:
- role-aware redirection,
- portal-specific dashboard shell,
- protected campus operations pages.

---

### Flow 4.3 — Student accesses the student portal
Status: Implemented

Who: enrolled student

Entry point: /login?portal=student or /student/dashboard

Journey:
1. The student signs in.
2. The backend resolves the student profile and dashboard data.
3. The student reaches their portal dashboard with attendance, report cards, exams, and profile information.

Current behavior:
- the student dashboard is live and data-driven,
- core academic and communication areas are present.

---

### Flow 4.4 — Parent accesses the parent portal
Status: Implemented

Who: parent or guardian

Entry point: /login?portal=parent or /parent/dashboard

Journey:
1. The parent signs in.
2. The system loads their linked student and school data.
3. The parent accesses child-related attendance, fees, report cards, events, and messages.

Current behavior:
- parent dashboards and sub-pages are present,
- the experience is role-focused and linked to student records,
- but more complete child-to-parent workflow automation is still planned.

---

## 5. Admin Operations Flow

### Flow 5.1 — Admin reviews the school dashboard
Status: Implemented

Who: admin or director

Entry point: /admin

Journey:
1. The admin logs in and reaches the admin dashboard.
2. The dashboard loads live school metrics such as students, teachers, parent count, class count, pending applications, fees, and attendance.
3. The admin sees activity and follow-up items.

What is currently supported:
- metrics cards,
- needs-attention sections,
- recent activity feed,
- live API-backed dashboard data.

---

### Flow 5.2 — Admin manages students and staff
Status: Implemented

Who: administrator

Entry point: /admin/students, /admin/staff, /admin/staff-attendance

Journey:
1. The admin opens the student or staff management area.
2. The interface presents school-wide operational areas for learners and staff.
3. The admin can navigate to attendance, class management, report cards, fees, and other school operations surfaces.

Current status:
- the management surface exists,
- but the full onboarding and lifecycle workflow still needs further product completion.

---

### Flow 5.3 — Admin manages finance and reports
Status: Implemented

Who: admin or bursar

Entry point: /admin/fees, /admin/finances, /admin/report-cards

Journey:
1. The administrator accesses fee and finance management pages.
2. They can navigate invoice, payment, expense, budget, report-card, and school finance areas.
3. The system surfaces fee and reporting data through the API layer.

Current status:
- data models and pages exist,
- finance operations are present but still need stronger reconciliation and lifecycle hardening.

---

## 6. Teacher Workflow

### Flow 6.1 — Teacher uses the teaching dashboard
Status: Implemented

Who: teacher or HOD

Entry point: /teacher/dashboard

Journey:
1. The teacher logs in.
2. The dashboard loads class assignments, student counts, attendance status, gradebook state, and live exam information.
3. The teacher can navigate to attendance, gradebook, exams, class roster, reports, and communication pages.

Current state:
- teacher dashboard is live and role-based,
- teaching workflows are structurally integrated.

### Flow 6.2 — Teacher marks attendance and manages records
Status: Implemented

Who: teacher

Entry point: /teacher/attendance, /teacher/class/attendance, /teacher/class/attendance-history

Journey:
1. The teacher opens the attendance workflow.
2. They record attendance for a session or class.
3. The attendance data is stored and can be reviewed later.

Current state:
- attendance entry and review flows are present,
- correction request workflows exist in the schema and API layer.

### Flow 6.3 — Teacher manages gradebook and exams
Status: Implemented

Who: teacher

Entry point: /teacher/gradebook, /teacher/cbt-center, /teacher/question-bank

Journey:
1. The teacher opens the gradebook for a class/subject.
2. They can review or update assessment data.
3. They can navigate to CBT-related pages and question management routes.

Current state:
- the interfaces and supporting data model are present,
- the experience is still being matured into a full exam and moderation workflow.

---

## 7. Student and Parent Learning Flow

### Flow 7.1 — Student views academic progress
Status: Implemented

Who: student

Entry point: /student/dashboard

Journey:
1. The student signs in.
2. They see their attendance rate, grade snapshot, fee balance, and latest report card.
3. They can navigate to exams, attendance, timetable, announcements, and profile pages.

Current state:
- the student dashboard is live and data-backed,
- the experience is already useful for everyday school monitoring.

### Flow 7.2 — Student takes exams and practices CBT
Status: Partially implemented

Who: student

Entry point: /student/exams and /student/waec-practice

Journey:
1. The student selects a test or practice area.
2. They enter the exam flow.
3. They can see results or attempt history.

Current state:
- the architecture and routes exist,
- the experience is still evolving into a polished end-to-end CBT journey.

### Flow 7.3 — Parent monitors child progress
Status: Implemented

Who: parent

Entry point: /parent/dashboard

Journey:
1. The parent signs in and sees child-related information.
2. They can access attendance, fees, report cards, events, and messages.
3. The experience is designed around ongoing school communication.

Current state:
- the core parent monitoring experience is present,
- deeper workflow automation is still planned.

---

## 8. IT Education and IT Portal Flow

### Flow 8.1 — Learner discovers IT education offerings
Status: Implemented

Who: prospective learner or enrolled student

Entry point: /it-education and /it-portal/auth

Journey:
1. The learner opens the IT education hub.
2. They browse course tracks such as Python, AI, cybersecurity, and Microsoft Office.
3. They can choose to sign up or sign in to the IT portal.

Current state:
- the public IT education hub is a strong product pillar,
- course catalog and portal sign-in flows are implemented.

### Flow 8.2 — IT learner uses the portal
Status: Implemented

Who: IT student or external learner

Entry point: /it-portal/dashboard

Journey:
1. The learner signs in or creates an account.
2. They access the portal dashboard and can continue into course and learning workflows.
3. The portal is designed to support certificate-oriented learning.

Current status:
- the portal experience is present and structured,
- some learning journey detail and reporting still need further completion.

---

## 9. Current Gaps and Next Priorities

### Major gaps
- first-time school setup wizard,
- full admissions review and enrollment handoff,
- production-grade notification and archive workflows,
- more complete CBT moderation and result delivery,
- stronger end-to-end onboarding for students, parents, and staff.

### Highest-value next steps
1. finish the onboarding and school-setup experience,
2. complete admissions review and handoff to student records,
3. harden finance and reporting workflows,
4. mature IT learning and CBT experiences,
5. improve operational monitoring and backup/restore readiness.

---

## 10. Executive Summary

The project has already evolved into a meaningful school platform with public pages, a real admissions journey, role-aware authentication, dashboard-driven portals, and IT education support. The next phase should focus less on adding new surface area and more on completing the workflows that make the system truly useful, reliable, and ready for real school operations.





 PART 2: AUTHENTICATION FLOWS



 FLOW 2.1 — FirstTime Admin Setup (School Configuration) [Status: Planned / missing]

Who: School Director or designated IT Admin

Entry Point: First access after the platform is provisioned for Ykay College



Step 1 — Accessing the Setup Wizard

The Director navigates to the admin URL (e.g., `app.ykaycollege.com/setup`). They see a welcome screen: "Welcome to Ykay College EduPortal. Let's configure your school."



Step 2 — School Profile Setup

The Director fills in:

 School name: Ykay College & Leadership Academy
 School address: the postal address the school has confirmed (leave blank if not yet confirmed; it is set later under Admin > School profile)
 School phone number
 School email
 School logo (upload)
 School motto
 School type: Day Secondary School
 Classes offered: JSS1–SS3



Step 3 — Session and Term Configuration

The Director sets up the current academic session:

 Session: 2024/2025
 Term 1: Start date, End date
 Term 2: Start date, End date
 Term 3: Start date, End date
 Public holidays and midterm break dates



Step 4 — Grading Scale Configuration

The Director reviews the preloaded Nigerian A1–F9 grading scale and confirms or adjusts:

| Score Range | Grade | Remark |
||||
| 75–100 | A1 | Excellent |
| 70–74 | B2 | Very Good |
| 65–69 | B3 | Good |
| 60–64 | C4 | Credit |
| 55–59 | C5 | Credit |
| 50–54 | C6 | Credit |
| 45–49 | D7 | Pass |
| 40–44 | E8 | Pass |
| 0–39 | F9 | Fail |



Step 5 — CA Component Configuration

The Director configures how Continuous Assessment is broken down:

 CA1 Test: 10 marks
 CA2 Test: 10 marks
 Midterm Test: 10 marks
 Assignment: 10 marks
 Terminal Exam: 60 marks
 Total: 100 marks



Step 6 — Completion

The Director clicks "Complete Setup". The system creates the school's full configuration and redirects to the Admin Dashboard.



 FLOW 2.2 — Staff Login [Status: Demo / not production-ready]

Who: Admin, Bursar, Teacher, Academic Coordinator, HOD

Entry Point: `app.ykaycollege.com/login`



Step 1 — Login Page

The user arrives at the login page. They see two fields: Email Address and Password, and a "Login" button. Below the button is a "Forgot Password?" link. There is also a small "I'm a Student" and "I'm a Parent" link for roleappropriate routing.



Step 2 — Entering Credentials

The user types their email and password and clicks "Login". The system validates:

 If the email does not exist: "Invalid email or password." (generic message — does not reveal whether email exists)
 If the password is wrong: same generic message
 If the account is suspended: "Your account has been suspended. Please contact the school administration."
 If credentials are correct: proceed to Step 3



Step 3 — 2FA Verification (if enabled)

If the user has 2FA enabled, the system sends an OTP to their registered phone number via SMS (Termii). A screen appears:

> "A 6digit code has been sent to +234 XXX XXXX XXX. Enter it below."

The user enters the OTP and clicks "Verify". If correct, they are logged in. If wrong: "Incorrect code. Please try again." After 3 failed attempts, the account is temporarily locked.



Step 4 — Successful Login and Role Redirect

The system reads the user's role and redirects:

 Admin → Admin Dashboard
 Bursar → Finance Dashboard
 Teacher → Teacher Dashboard
 Academic Coordinator → Coordinator Dashboard
 HOD → HOD Dashboard
 Director → Director Executive Dashboard



 FLOW 2.3 — Student Login [Status: Demo / not production-ready]

Who: JSS1–SS3 student

Entry Point: Student portal login page



Step 1 — Login

The student navigates to `app.ykaycollege.com/student/login` or clicks "Student Login" on the main site. They enter their Student ID (e.g., YKC/2025/001) and their Password (set during enrollment or via the welcome email).



Step 2 — FirstTime Login

If this is the student's first login, the system prompts them to:

 Change their temporary password to a new password (min 8 characters)
 Confirm the new password

They click "Set Password" and are redirected to the Student Dashboard.



Step 3 — Subsequent Logins

The student is taken directly to their Student Dashboard.



 FLOW 2.4 — Parent Login [Status: Demo / not production-ready]

Who: Parent or guardian

Entry Point: Parent portal login



Step 1 — Login

The parent navigates to `app.ykaycollege.com/parent/login`. They enter the email address registered during their child's enrollment and their password.



Step 2 — FirstTime Login

If the parent's account was created by the admin (during enrollment), they receive a welcome SMS/WhatsApp message with a temporary password. On first login, they are prompted to set a new password.



Step 3 — MultiChild Parent

If the parent has more than one child enrolled, after login they see a child selector screen showing all their children's names and classes. They click on a child to view that child's dashboard. A switcher button is always visible at the top of the portal to switch between children.



 FLOW 2.5 — Password Reset [Status: Planned / missing]

Who: Any user (staff, student, parent)

Entry Point: Login page → "Forgot Password?"



Step 1 — Request Reset

The user clicks "Forgot Password?". A form appears with one field: Email Address (or Student ID for students). They enter their identifier and click "Send Reset Link".

The system sends an email with a password reset link that expires in 30 minutes. The page shows: "If this email is registered, you will receive a reset link shortly." (Does not confirm whether email exists.)



Step 2 — Clicking the Reset Link

The user opens their email and clicks the link. They land on the password reset page, which shows:

 New Password field
 Confirm Password field
 "Reset Password" button



Step 3 — Setting New Password

The user enters and confirms their new password and clicks "Reset Password". The system:

1. Invalidates the reset token
2. Updates the password hash
3. Invalidates all existing refresh tokens (logs the user out of all devices)
4. Shows a success message: "Your password has been reset. Please log in with your new password."
5. Redirects to the login page





 PART 3: ADMIN PORTAL FLOWS



 FLOW 3.1 — Admin Dashboard Overview

Who: School Admin or Director

Entry Point: Login → Admin Dashboard



Step 1 — Viewing the Dashboard

After login, the Admin sees a dashboard with:

Key Metrics Row (top):
 Total students enrolled
 Students present today (with percentage)
 Fees collected this term vs. target
 Pending admission applications

Quick Action Buttons:
 Enroll New Student
 Mark Attendance (shortcut)
 Generate Invoices
 Send Broadcast Message

Charts and Visuals:
 Weekly attendance trend (line chart)
 Fee collection progress bar (per class)
 Recent activity feed (last 10 actions taken on the platform)
 Upcoming events (next 5 from the school calendar)

Notifications Panel:
 Unread inapp notifications (attendance alerts, payment confirmations, new applications)



 FLOW 3.2 — Enrolling a New Student

Who: Admin

Entry Point: Admin Dashboard → Students → Add New Student



Step 1 — Starting Enrollment

The Admin clicks "Students" in the left sidebar, then clicks "Add New Student". A multisection form opens.



Step 2 — Personal Information

The Admin fills in:

 First name, middle name, surname
 Date of birth
 Gender
 State of origin
 Local Government Area
 Religion
 Upload passport photo (draganddrop or file picker)



Step 3 — Health Information

 Blood group (dropdown: A+, A, B+, B, O+, O, AB+, AB)
 Genotype (dropdown: AA, AS, SS, AC)
 Known allergies (text field)
 Chronic conditions (checkboxes: Asthma, Sickle Cell, Epilepsy, Diabetes, Other)
 Other health notes



Step 4 — Academic Placement

 Class (dropdown: JSS1, JSS2, JSS3, SS1, SS2, SS3)
 Arm (dropdown populated based on class: A, B, C)
 Subject combination (for SS1–SS3: Science / Arts / Commercial track)
 Entry type (New Admission / Transfer In)
 Previous school (if transfer)



Step 5 — Parent/Guardian Information

 Father's name, phone, email, occupation (optional if not available)
 Mother's name, phone, email, occupation
 Guardian name, phone, relationship (if different)
 Which parent is the primary contact (radio button)
 WhatsApp number for primary contact (prefilled, editable)



Step 6 — Review and Save

The Admin reviews a summary of all entered information. They click "Enroll Student".

The system:

1. Autogenerates Student ID (e.g., YKC/2025/042)
2. Creates the student profile with status Active
3. Creates a parent account (if email provided) with a temporary password
4. Sends a welcome SMS/WhatsApp to the parent: "Your child [Name] has been enrolled at Ykay College. Student ID: YKC/2025/042. Parent portal login: app.ykaycollege.com/parent. Temporary password: XXXX"
5. Autogenerates a fee invoice for the current term
6. Shows a success toast: "Student enrolled successfully. Student ID: YKC/2025/042"

The Admin is redirected to the student's profile page.



 FLOW 3.3 — Processing an Admission Application

Who: Admin

Entry Point: Admin Dashboard → Admissions → Applications Queue



Step 1 — Viewing the Applications Queue

The Admin clicks "Admissions" in the sidebar, then "Applications". They see a table of all submitted applications with columns:

 Application ID
 Applicant Name
 Class Applied For
 Date Submitted
 Status (Pending / Under Review / Approved / Declined / Waitlisted)
 Actions



Step 2 — Reviewing an Application

The Admin clicks "Review" on a pending application. They see:

 Full applicant details (all information submitted in the online form)
 Uploaded documents with preview buttons
 Payment confirmation (application fee)
 Action buttons: Approve, Decline, Request More Documents, Add to Waitlist



Step 3A — Approving the Application

The Admin clicks "Approve". A confirmation dialog asks:

> "Approve this application? This will create a student account for [Name] and send login credentials to the parent."
> Class Placement: [dropdown to assign class and arm]

The Admin selects the class/arm and clicks "Confirm Approval".

The system:

1. Creates a student profile from the application data
2. Assigns the student to the selected class and arm
3. Autogenerates Student ID
4. Sends SMS/email to parent with login credentials
5. Autogenerates term invoice
6. Updates the application status to Approved



Step 3B — Requesting More Documents

The Admin clicks "Request More Documents". A text field appears for the Admin to specify which documents are needed. The Admin types the requirements and clicks "Send Request".

The system sends an SMS and email to the parent specifying what is needed. The application status changes to "Documents Requested".



Step 3C — Declining the Application

The Admin clicks "Decline". A text field appears for the reason. The Admin enters the reason (optional) and clicks "Confirm Decline".

The system sends an SMS and email to the parent informing them of the decision. Application status changes to "Declined".



 FLOW 3.4 — Setting Up Fee Structure

Who: Admin or Bursar

Entry Point: Admin Dashboard → Finance → Fee Structure



Step 1 — Accessing Fee Structure

The Admin/Bursar clicks "Finance" in the sidebar, then "Fee Structure". They see a table of existing fee items (empty on first setup).



Step 2 — Creating a Fee Structure

The Admin clicks "Add Fee Item". A form appears:

 Fee name (e.g., Tuition Fee)
 Fee category (dropdown: Tuition / Development Levy / Exam Fee / ICT Levy / PTA Levy / Other)
 Applies to (dropdown: All Classes / JSS Only / SS Only / Specific Class)
 Amount (₦)
 Term (1st Term / 2nd Term / 3rd Term / All Terms)
 Is this fee mandatory? (toggle)
 Discount eligibility (toggle — allows discounts/scholarships to apply)

The Admin fills in all fields and clicks "Save". The fee item appears in the table.



Step 3 — Repeating for All Fee Items

The Admin repeats Step 2 for each fee category:

 Tuition Fee (JSS: ₦25,000 / SS: ₦30,000 per term)
 Development Levy (₦5,000 per term)
 Exam Fee (₦3,000 per term)
 ICT Levy (₦2,000 per term)
 PTA Levy (₦1,000 per term)



Step 4 — Generating Term Invoices

The Admin clicks "Generate Term Invoices". A confirmation dialog appears:

> "This will generate fee invoices for all [420] active students for Term 1, 2024/2025 session. Continue?"

The Admin clicks "Generate". The system creates one invoice per student with the total fees for their class. A success toast shows: "420 invoices generated successfully."



 FLOW 3.5 — Managing Payments and Viewing Financial Reports

Who: Bursar / Admin

Entry Point: Finance → Payments



Step 1 — Viewing the Payment Dashboard

The Bursar sees:

 Total fees billed this term: ₦XX,XXX,XXX
 Total collected: ₦XX,XXX,XXX
 Outstanding balance: ₦XX,XXX,XXX
 Collection rate: XX%
 Number of students who have paid in full: XX
 Number with partial payment: XX
 Number with no payment: XX



Step 2 — Viewing Individual Student Fee Status

The Bursar clicks "View All Invoices". They see a table with:

 Student name and class
 Total invoice amount
 Amount paid
 Outstanding balance
 Payment status (Paid / Partial / Unpaid)
 Last payment date

They can filter by class, arm, payment status, and search by student name.



Step 3 — Recording a Cash/Bank Transfer Payment

If a parent pays cash at the school office or via bank transfer, the Bursar records it manually:

1. Clicks "Record Payment" next to the student's invoice
2. Fills in: Amount, Date, Payment method (Cash / Bank Transfer), Transaction reference (if transfer)
3. Clicks "Save"
4. The system updates the invoice, sends a receipt to the parent via email/SMS, and updates the payment dashboard



Step 4 — Sending Fee Reminders

The Bursar clicks "Send Reminders". A dialog shows:

> "Send fee reminders to parents of [XXX] students with outstanding balances?"
> Options: Send now / Schedule for [date]

The Bursar clicks "Send Now". The system queues SMS and WhatsApp messages to all parents with outstanding balances. A confirmation shows the number of messages sent.



Step 5 — Viewing Financial Reports

The Bursar clicks "Reports" in the Finance section. They see tabs:

 Income Statement: Total revenue, expenses, net income per term
 Revenue vs. Target: Bar chart comparing billed vs. collected per class
 ClassbyClass Collection Rate: Table showing fee collection percentage per class
 TermoverTerm Comparison: Revenue trends across terms

Each report has an "Export PDF" and "Export Excel" button.



 FLOW 3.6 — Managing Classes and Arms

Who: Admin

Entry Point: Admin Dashboard → Classes



Step 1 — Viewing Classes

The Admin clicks "Classes" in the sidebar. They see a list of all classes (JSS1A, JSS1B, JSS2A, etc.) with:

 Class name
 Number of students
 Class teacher assigned
 Actions: View, Edit, Delete



Step 2 — Creating a New Class/Arm

The Admin clicks "Add Class":

 Class level (dropdown: JSS1/JSS2/JSS3/SS1/SS2/SS3)
 Arm (text: A / B / C)
 Maximum student capacity
 Class teacher (dropdown of all teaching staff)

Clicks "Save". The class appears in the list.



Step 3 — Assigning a Class Teacher

The Admin clicks "Edit" on a class. They see a "Class Teacher" dropdown. They select the teacher's name and click "Save". That teacher now has classteacherlevel access for that class.



 FLOW 3.7 — Generating the School Timetable

Who: Admin / Academic Coordinator

Entry Point: Admin Dashboard → Timetable → Generate Timetable



Step 1 — Prerequisites Check

Before generation, the system checks:

 All classes have been created ✅
 All subjects have been created ✅
 All subjectteacher assignments are complete ✅
 Number of periods per day is configured ✅

If any prerequisite is missing, the system shows a list of what needs to be completed first.



Step 2 — Configuring Generation Parameters

The Admin sets:

 School days: Monday to Friday
 Periods per day: 8
 Period duration: 40 minutes
 Break periods: Period 4 (Short Break), Period 7 (Long Break)
 Doubleperiod subjects (e.g., English Language, Mathematics)



Step 3 — Running the Generator

The Admin clicks "Generate Timetable". The system runs a conflictfree timetable generation algorithm. A loading indicator appears: "Generating timetable... This may take a moment."



Step 4 — Reviewing the Generated Timetable

The system displays a visual timetable grid (classes as rows, days/periods as columns). The Admin can see:

 Each period filled with a subject and teacher name
 Colorcoded by subject department

If there are any conflicts (teacher assigned to two classes at the same time), they are highlighted in red.



Step 5 — Making Manual Adjustments

The Admin clicks on any period cell to edit it. A dropdown appears to change the subject or teacher for that period. After changes, the system rechecks for conflicts.



Step 6 — Publishing the Timetable

The Admin clicks "Publish Timetable". The system makes the timetable visible to all teachers and students in their respective portals. Teachers see their personal schedule; students see their class timetable.



 FLOW 3.8 — Managing Staff

Who: Admin

Entry Point: Admin Dashboard → Staff



Step 1 — Inviting a New Staff Member

The Admin clicks "Staff" → "Invite Staff Member". A form appears:

 Full name
 Email address
 Phone number
 Role (dropdown: Admin / Bursar / Academic Coordinator / HOD / Class Teacher / Subject Teacher / Support Staff)
 Department (for HOD)
 Subjects they teach (multiselect, for teachers)
 Employment date
 Salary grade

The Admin clicks "Send Invitation". The system sends an email to the staff member with a link to activate their account and set their password. The staff member appears in the staff list with status "Invited".



Step 2 — Staff Member Activates Account

The staff member receives the invitation email, clicks the link, is taken to an account activation page, sets their password, and their status changes to "Active".



Step 3 — Managing Staff Profiles

The Admin can view any staff member's profile showing:

 Personal details
 Subjects assigned
 Class teacher assignment
 Leave history
 Performance review scores
 Payroll records



 FLOW 3.9 — Running the Student Promotion Engine

Who: Admin

Entry Point: Admin Dashboard → Students → Promotion Engine



Step 1 — Accessing the Promotion Engine

At the end of the academic session, the Admin clicks "Students" → "Promotion Engine". A summary shows:

 Current session: 2024/2025
 Total students eligible for promotion: [number]
 Students flagged for retention (based on performance): [number]



Step 2 — Reviewing Promotion Recommendations

The system shows each student with:

 Current class
 Overall average score
 Attendance percentage
 Recommended action: Promote or Retain (based on configured thresholds)

The Admin can override the recommendation for individual students by toggling their status.



Step 3 — Confirming Promotion

The Admin clicks "Run Promotion". A confirmation dialog:

> "This will promote [380] students and retain [12] students. Class assignments will be updated for the 2025/2026 session. This cannot be undone. Continue?"

The Admin clicks "Confirm". The system updates all student class assignments. Parents receive an SMS notification of their child's class for next session.



 FLOW 3.10 — Sending a Broadcast Notification

Who: Admin / Director

Entry Point: Admin Dashboard → Communications → Broadcast Message



Step 1 — Composing the Message

The Admin clicks "Communications" → "Broadcast Message". A compose interface appears:

 To: (dropdown) All Parents / All Students / All Staff / Specific Class / Specific Group
 Channels: (checkboxes) InApp / SMS / WhatsApp / Email / Push Notification
 Message title
 Message body (rich text editor)
 Attach file? (optional)
 Schedule: Send Now / Schedule for [date and time]



Step 2 — Previewing and Sending

The Admin clicks "Preview" to see how the message will appear on each channel. They click "Send" (or "Schedule").

The system queues the messages and processes them in the background. A progress indicator shows: "Sending to 420 recipients... 156/420 sent."

When complete, a delivery report shows: total sent, delivered, failed, and bounce reasons for failures.



 FLOW 3.11 — Generating EMIS/NEMIS Compliance Reports

Who: Admin

Entry Point: Reports → Government Reports → EMIS/NEMIS



Step 1

The Admin clicks "Reports" → "EMIS/NEMIS Export". They select the session and term. The system compiles:

 Total enrollment by class, gender, and state of origin
 Attendance summary
 Teacher qualification data
 Infrastructure data

Step 2

The Admin clicks "Generate Report". The system creates an Excel file formatted to Ogun State Ministry of Education's EMIS submission template. The Admin downloads and submits it.





 PART 4: TEACHER PORTAL FLOWS



 FLOW 4.1 — Teacher Dashboard Overview

Who: Subject Teacher or Class Teacher

Entry Point: Login → Teacher Dashboard



Step 1 — Viewing the Dashboard

The teacher sees:

Today's Schedule:
 A visual timeline of their periods for today (from the published timetable)
 Each period shows: class, subject, room, time
 A "Take Attendance" button on each period

Quick Stats:
 Classes taught today
 Assignments pending grading
 CBT exams scheduled this week

Notifications:
 Recent parent messages
 Assignment submissions received
 HOD approval requests

Shortcuts:
 Mark Attendance
 Create Exam
 Upload Notes
 Enter CA Scores



 FLOW 4.2 — Marking Daily Attendance

Who: Class Teacher or Subject Teacher

Entry Point: Teacher Dashboard → "Take Attendance" on today's period



Step 1 — Opening the Attendance Register

The teacher clicks "Take Attendance" for a specific class period. The system opens the digital class register showing all students in that class with their photos, names, and three buttons per student: P (Present) / A (Absent) / L (Late).

By default, all students are marked Present (bulkmark logic — mark all present, then unmark absentees).



Step 2 — Marking Absentees

The teacher scans the room, identifies absent students, and clicks their "A" button. The student's row turns red. If a student arrives late, the teacher clicks "L" — the row turns yellow and the system autorecords the timestamp.



Step 3 — Adding Notes

For any absent student, the teacher can click a "Add Note" icon to add a reason (e.g., "Parents called — ill at home"). This is optional.



Step 4 — Submitting Attendance

The teacher clicks "Submit Attendance". A confirmation dialog shows:

> "Present: 38 | Absent: 2 | Late: 1 | Total: 41. Submit?"

The teacher clicks "Confirm".

The system:

1. Saves the attendance record with the teacher's ID and timestamp
2. For each absent student, automatically sends an SMS and push notification to the parent within 5 minutes:
   > "Attendance Alert: [Student Name] was marked absent in [Class] today ([Date]). Please contact the school if this is unexpected. Ykay College — 0800XXXXXXX"
3. Updates the attendance dashboard visible to Admin



Step 5 — Attendance Confirmation

The teacher sees a success screen showing the attendance has been recorded. The register is now locked for that period (corrections go through a separate correction workflow).



 FLOW 4.3 — Entering CA Scores

Who: Subject Teacher

Entry Point: Teacher Dashboard → Gradebook → Select Class → Select Subject



Step 1 — Opening the Gradebook

The teacher clicks "Gradebook" in the sidebar. They select the class (e.g., SS2A) and subject (e.g., Mathematics). The gradebook opens showing all students in a table with columns for each CA component: CA1, CA2, Midterm, Assignment, Exam, Total, Grade.



Step 2 — Entering Scores

The teacher clicks on a cell (e.g., CA1 score for Student A). A number input appears. They type the score (e.g., 8) and press Tab to move to the next student. The system validates that the score does not exceed the maximum for that component (e.g., CA1 max = 10). If it does, an inline error appears.

The teacher works through all students, entering scores for CA1.



Step 3 — AutoComputation

As scores are entered, the Total column and Grade column update automatically in real time, showing the running total and the corresponding A1–F9 grade.



Step 4 — Saving Progress

The teacher can save at any time by clicking "Save Progress". The system saves without locking — the teacher can continue editing until the Admin locks the gradebook.



Step 5 — Marking BelowPass Students

Any student with a total below the configured pass mark (e.g., below 40) is automatically highlighted in red in the gradebook, flagging them for the teacher's attention.



Step 6 — Gradebook Locked by Admin

When the Admin closes the score entry window at term end, the teacher sees all cells as readonly. A banner shows: "Gradebook locked by Admin on [date]. Contact Admin to request corrections."



 FLOW 4.4 — Creating a CBT Exam

Who: Subject Teacher

Entry Point: Teacher Dashboard → Exams → Create New Exam



Step 1 — Basic Information (Step 1 of 6)

The teacher clicks "Exams" → "Create New Exam". A 6step wizard opens.

Step 1 fields:

 Exam title (e.g., "2nd Term CA1 — Mathematics SS2")
 Subject (autofilled from teacher's subjects)
 Class level (e.g., SS2)
 Arms (multiselect: SS2A, SS2B, SS2C — all classes that take this exam)
 Exam type (dropdown: CA / Midterm / Final Exam / Mock / Practice)
 Instructions to students (rich text — e.g., "Answer all questions. No calculators allowed.")

The teacher clicks "Next".



Step 2 — Question Selection (Step 2 of 6)

The teacher sees two options:

Option A — Pick from Question Bank:
A search interface allows filtering by topic, difficulty, question type, and WAEC year. The teacher checks boxes next to questions they want to include. A counter shows: "Selected: 25 / Recommended: 40 questions."

Option B — Create New Questions:
The teacher can create questions inline:

 Select question type (MCQ, True/False, Fill in the Blank, Short Answer, Essay, etc.)
 Enter question text (supports math equations via LaTeX editor, image upload)
 For MCQ: enter options A, B, C, D and mark the correct answer
 Enter explanation (shown to student after result release)
 Assign marks, difficulty, and Bloom's level

They can mix both options. When done, they click "Next".



Step 3 — Scoring Configuration (Step 3 of 6)

 Total marks (autocalculated from question marks, or override)
 Pass mark (e.g., 40)
 Negative marking? (toggle — for JAMBstyle exams)
 Marks per correct MCQ answer
 Marks deducted per wrong answer (if negative marking enabled)

The teacher clicks "Next".



Step 4 — Timing and Scheduling (Step 4 of 6)

 Exam duration: [minutes] (e.g., 60)
 Start date and time (e.g., 20250310 09:00 AM)
 End date and time (e.g., 20250310 10:00 AM — the window during which students can start)
 Allow late submission? (toggle)
 Autosubmit when timer expires? (toggle — recommended ON)

The teacher clicks "Next".



Step 5 — Access Control (Step 5 of 6)

 Maximum attempts (1 for exams, configurable for practice)
 Allow calculator? (toggle)
 Passwordprotect exam? (optional — teacher shares password separately)

The teacher clicks "Next".



Step 6 — AntiCheat Settings (Step 6 of 6)

 Fullscreen lockdown: ON (recommended)
 Tabswitch detection: ON (warning on first switch, autosubmit on 3rd switch)
 Disable copy/paste: ON
 Randomize question order: ON (each student gets a unique order)
 Randomize answer options: ON (A/B/C/D shuffled per student)
 Webcam proctoring: OFF (premium feature)

The teacher reviews the complete exam summary and clicks:

 "Save as Draft" — saves without publishing
 "Schedule Exam" — saves and sets to autoactivate at the start time

A success message shows: "Exam scheduled for March 10, 2025 at 9:00 AM."

Students in SS2A, SS2B, and SS2C receive an inapp notification: "An exam has been scheduled: 2nd Term CA1 — Mathematics. Date: March 10, 2025, 9:00 AM. Duration: 60 minutes."



 FLOW 4.5 — Managing the Question Bank

Who: Subject Teacher

Entry Point: Teacher Dashboard → Question Bank



Step 1 — Viewing the Question Bank

The teacher clicks "Question Bank" in the sidebar. They see all questions they have created, filterable by:

 Subject
 Class level
 Topic
 Difficulty (Easy / Medium / Hard)
 Question type
 Approval status (Pending / Approved / Rejected)



Step 2 — Adding a Question

The teacher clicks "Add Question". They fill in:

 Subject (prefilled)
 Class level
 Topic (type or select from NERDC curriculum topics)
 Question type
 Question text
 Options (for MCQ)
 Correct answer
 Explanation
 Difficulty level
 Bloom's taxonomy level
 Marks
 WAEC year (if this is a past WAEC question)
 Media attachment (optional image/audio)

Clicks "Save". The question is saved with status "Pending Approval".



Step 3 — HOD Approval

The HOD/Academic Coordinator receives an inapp notification: "[Teacher Name] submitted 5 new questions for approval." They review each question and either Approve or Reject with a comment. Approved questions become available for exam selection.



Step 4 — Bulk Import

The teacher can click "Bulk Import" to upload an Excel file with many questions at once. The system provides a downloadable template. After upload, the system validates each row and shows a preview. The teacher confirms and all valid questions are imported with "Pending Approval" status.



 FLOW 4.6 — Creating and Distributing an Assignment

Who: Subject Teacher

Entry Point: Teacher Dashboard → Assignments → Create Assignment



Step 1 — Creating the Assignment

The teacher clicks "Assignments" → "Create Assignment". They fill in:

 Title (e.g., "Essay on Nigerian Independence")
 Class and arm
 Subject
 Assignment type (dropdown: File Upload / Online Text / QuizBased / Video Submission / Group / RubricBased)
 Instructions (rich text editor)
 Reference files (attach PDF, Word, images, or video as supporting material)
 Deadline: date and time
 Allow resubmission? (toggle)
 Maximum score

Setting Up a Grading Rubric:

The teacher clicks "Add Rubric Criteria":

 Criterion 1: Clarity (0–25 marks)
 Criterion 2: Accuracy (0–25 marks)
 Criterion 3: Presentation (0–25 marks)
 Criterion 4: Completeness (0–25 marks)

Clicks "Publish Assignment". All students in the specified class receive an inapp notification:

> "New Assignment: Essay on Nigerian Independence — due [Date]. Click to view."

Automated reminders are scheduled: 24 hours before deadline and 1 hour before deadline.



Step 2 — Viewing Submissions

The teacher clicks on the assignment and sees a Submissions tab showing:

 A list of all students
 Submission status: Submitted (green) / Not Submitted (red) / Late Submission (orange)
 Submitted on: date and time
 A "Grade" button for each submission



Step 3 — Grading a Submission

The teacher clicks "Grade" for a student. They see the student's submission alongside the rubric. For a text submission, the teacher can highlight specific paragraphs and add inline comments. They score each rubric criterion and type overall feedback. They click "Save Grade".

The student receives an inapp notification: "Your assignment 'Essay on Nigerian Independence' has been graded. Score: 78/100. View feedback."

The grade is automatically fed into the CA gradebook as the Assignment component for that student.



 FLOW 4.7 — Creating and Teaching a Virtual Class

Who: Teacher

Entry Point: Teacher Dashboard → Virtual Classroom → Schedule Class



Step 1 — Scheduling a Virtual Class

The teacher clicks "Virtual Classroom" → "Schedule New Class". They fill in:

 Class title (e.g., "SS2 Mathematics — Quadratic Equations Review")
 Class/arm
 Subject
 Date and time
 Estimated duration

Clicks "Schedule". A Jitsi Meet room link is autogenerated. Students in the class receive an inapp notification 15 minutes before the session starts:

> "REMINDER: Your Mathematics virtual class starts in 15 minutes. Click to join."



Step 2 — Starting the Class

At the scheduled time, the teacher clicks "Start Class". The Jitsi Meet session opens in the browser/app. The teacher sees:

 Camera and microphone controls
 Screen sharing button
 Digital whiteboard button
 Participant list
 Chat panel
 Recording button



Step 3 — During the Class

Students join by clicking the link in their notification. As each student joins, their name appears in the participant list and their virtual attendance is autorecorded.

The teacher can:

 Share their screen to show slides or websites
 Open the digital whiteboard to write or draw
 Mute/unmute individual students
 See raised hands (students click a "raise hand" button to ask questions)
 Chat via text in the chat panel



Step 4 — Recording the Class

The teacher clicks "Start Recording". A recording starts. When the class ends, the teacher clicks "End Session". The recording is automatically saved and made available in the Learning Hub for students who missed the class or want to review.



 FLOW 4.8 — Creating a Lesson Plan

Who: Subject Teacher

Entry Point: Teacher Dashboard → Lesson Plans → Create New Plan



Step 1 — Creating the Plan

The teacher clicks "Lesson Plans" → "Create New Plan". They fill in:

 Subject and class
 Term and week number
 Topic (aligned to NERDC curriculum — autosuggested based on subject/class/term)
 Duration (number of periods)
 Learning objectives
 Prior knowledge required
 Teaching aids/materials needed
 Stepbystep lesson procedure (Introduction, Development, Conclusion)
 Assessment strategy
 Assignment set as followup

Alternatively, they click "Generate with AI". The AI autofills a complete lesson plan based on the subject, class, and topic. The teacher reviews and edits as needed.



Step 2 — Submitting for HOD Approval

The teacher clicks "Submit for HOD Review". The HOD receives an inapp notification. The plan status changes to "Pending Review".



Step 3 — HOD Reviews the Plan

The HOD opens the lesson plan, reviews it, and either:

 Clicks "Approve" — the plan is marked approved; the teacher is notified
 Clicks "Return for Revision" — the HOD types comments; the teacher is notified and can edit and resubmit



 FLOW 4.9 — Uploading Learning Materials to the Learning Hub

Who: Teacher

Entry Point: Teacher Dashboard → Learning Hub → Upload Material



Step 1 — Uploading

The teacher clicks "Learning Hub" → "Upload Material". They fill in:

 Title
 Class and arm
 Subject
 Topic (from NERDC curriculum list)
 Material type (dropdown: Class Notes / Slides / Worksheet / Past Exam / Reference Material / Video)
 File upload (draganddrop, max 50MB)
 Description (optional)

Clicks "Upload". The material appears in the Learning Hub for all students in that class. Students receive a notification: "New class notes uploaded for Mathematics — Quadratic Equations."



 FLOW 4.10 — Releasing CBT Exam Results

Who: Teacher or Admin

Entry Point: Teacher Dashboard → Exams → Completed Exams



Step 1 — Reviewing Results Before Release

After an exam ends, the teacher clicks on it and sees the "Results" tab. They can see:

 Score distribution chart
 List of all students: name, score, percentage, grade, time taken, tab switches (anticheat data)
 Students who did not attempt: highlighted

The teacher reviews to check for any anomalies (e.g., a student who scored 100% but had 10 tab switches — the teacher can flag them for review).



Step 2 — Releasing Results

When satisfied, the teacher clicks "Release Results". A confirmation dialog:

> "This will make exam results visible to all [41] students and their parents. Continue?"

The teacher clicks "Confirm". The exam status changes to "Results Released". All students and their linked parents receive an inapp notification and SMS:

> "Your [CA1 Mathematics] results have been released. Log in to view your score."



 FLOW 4.11 — Communicating with Parents

Who: Class Teacher

Entry Point: Teacher Dashboard → Messages



Step 1 — Starting a Message Thread

The teacher clicks "Messages" in the sidebar. They see:

 Existing message threads with parents
 A "New Message" button

The teacher clicks "New Message", selects the parent from a searchable list, and types their message.



Step 2 — Ongoing Conversation

The conversation appears as a chat thread. Both the teacher and parent can send messages. Each message is timestamped. The teacher sees an unread badge in the Messages tab when a parent replies.





 PART 5: STUDENT PORTAL FLOWS



 FLOW 5.1 — Student Dashboard Overview

Who: JSS1–SS3 student

Entry Point: Login → Student Dashboard



Step 1 — Viewing the Dashboard

The student sees:

Top Row:
 Today's date and their class (e.g., SS2A)
 Attendance percentage this term
 Overall average score this term
 Outstanding fees (if any)

Today's Timetable:
 A visual timeline of their classes for today
 Current period highlighted

Upcoming Deadlines:
 Assignments due
 Exams scheduled
 Next virtual class

Recent Activity:
 New notes uploaded
 Assignment graded
 Result released

Quick Access:
 Take an Exam
 Submit Assignment
 Access Learning Hub
 View Report Card



 FLOW 5.2 — Taking a CBT Exam

Who: Student

Entry Point: Student Dashboard → Exams → Available Exams



Step 1 — Viewing Available Exams

The student clicks "Exams" in the sidebar. They see a list of exams with:

 Exam name
 Subject
 Duration
 Start and end window
 Status: Upcoming / Active / Completed



Step 2 — Starting the Exam

The student clicks "Start Exam" on an active exam. A preexam briefing screen appears showing:

 Exam title
 Duration
 Number of questions
 Total marks
 Pass mark
 Instructions from the teacher
 Anticheat warning: "This exam must be taken in fullscreen mode. Exiting fullscreen or switching tabs may result in your exam being automatically submitted."

The student clicks "I Understand — Begin Exam".



Step 3 — Fullscreen Lock

The browser enters fullscreen mode. A banner at the top shows: "Fullscreen mode active. Do not exit fullscreen or switch tabs."



Step 4 — Exam Interface

The student sees:

Left panel:
 Question number and text
 Answer options (for MCQ: radio buttons; for True/False: toggle; for Fill in Blank: text input; for Essay: text editor)
 Previous / Next buttons
 Flag Question button (to mark for review)

Right panel:
 Question navigator grid (clickable squares: white = not answered, blue = answered, yellow = flagged)
 Countdown timer (MM:SS, turns red in last 5 minutes)
 Scratch pad (text area for working notes)
 Calculator (if enabled)



Step 5 — Navigating and Answering

The student selects an answer. The system autosaves the answer immediately (every 30 seconds and on every answer change). If internet connection drops, the autosave retries automatically.

The student can jump to any question via the navigator grid. They can flag uncertain questions (turns yellow) to revisit later.



Step 6 — AntiCheat Triggers

Tab switch detected:
First time: A warning dialog appears: "Warning: You have switched tabs. This has been recorded. On the 3rd occurrence, your exam will be autosubmitted."

Third time: "You have exited the exam window 3 times. Your exam has been automatically submitted."

Fullscreen exit detected:
Dialog: "You have exited fullscreen. Please return to fullscreen immediately to continue. Click 'Return to Fullscreen' or your exam will be submitted."



Step 7 — Submitting the Exam

When the student has answered all questions (or when the timer expires), they click "Submit Exam". A confirmation dialog:

> "Submit exam? You have answered 38/40 questions. 2 questions are unanswered. Submit anyway?"

The student clicks "Submit". The system:

1. Records the submission timestamp
2. Locks the attempt (no further editing)
3. Autogrades all objective questions
4. Shows a submission confirmation: "Your exam has been submitted. Results will be available when your teacher releases them."
5. Logs all anticheat events (tab switches, fullscreen exits, timestamps)



Step 8 — Waiting for Results

The exam appears in the student's exam list with status "Submitted — Awaiting Results". When the teacher releases results, the student receives a notification.



Step 9 — Viewing Results

The student clicks on the exam and sees:

 Their score and percentage
 Their grade (A1–F9)
 Class position (if released by teacher)
 Questionbyquestion breakdown:
   Question text
   Their answer
   Correct answer
   Whether correct or wrong
   Explanation (if provided by teacher)



 FLOW 5.3 — Submitting an Assignment

Who: Student

Entry Point: Student Dashboard → Assignments



Step 1 — Viewing Assignments

The student clicks "Assignments" in the sidebar. They see:

 Active assignments (not yet due)
 Deadline countdowns for each
 Overdue assignments (highlighted in red)
 Submitted assignments



Step 2 — Opening an Assignment

The student clicks on an assignment. They see:

 Title and subject
 Instructions
 Attached reference materials (downloadable)
 Grading rubric (criteria and max marks)
 Deadline
 Submission box



Step 3 — Submitting

Depending on the assignment type:

 File Upload: Student clicks "Choose File", selects their document (PDF, Word, image), and clicks "Submit".
 Online Text: Student types their answer directly in a rich text editor and clicks "Submit".
 Video Submission: Student uploads a video file.

After submission, the system shows: "Assignment submitted on [date, time]. You will be notified when it has been graded."

If resubmission is allowed, the student sees a "Resubmit" button until the deadline.



 FLOW 5.4 — Accessing the Learning Hub

Who: Student

Entry Point: Student Dashboard → Learning Hub



Step 1 — Browsing Resources

The student clicks "Learning Hub" in the sidebar. They see tabs:

 Class Notes — organized by subject and topic
 Recorded Lessons — video recordings of past virtual classes
 ELibrary — digital textbooks and reference books
 WAEC/JAMB Practice — mock CBT exams
 BECE Practice (JSS students)
 AI Study Assistant



Step 2 — Accessing Class Notes

The student clicks "Class Notes". They filter by subject (Mathematics) and topic (Quadratic Equations). They see the PDF notes uploaded by the teacher. They click "View" to read it in the browser or "Download" to save it.



Step 3 — Using the AI Study Assistant

The student clicks "AI Study Assistant". A chat interface opens. The student types: "Explain the quadratic formula and give me an example." The AI responds with a clear explanation and a worked example. The student asks followup questions. A disclaimer is shown: "AI responses should be verified with your textbooks and teacher."



Step 4 — Taking a WAEC Practice Exam

The student clicks "WAEC Practice". They select:

 Subject (Mathematics)
 Year (2019)
 Paper (Paper 1 — Objective)

A timed CBT session starts with past WAEC questions. At the end, the student sees their score and a topiclevel breakdown showing which areas they are strongest and weakest in.



Step 5 — Using the Flashcard Generator

The student uploads a PDF of class notes. The AI analyzes the document and generates a set of digital flashcards (front: question/term; back: definition/answer). The student clicks through the flashcards to study.



 FLOW 5.5 — Viewing Report Card

Who: Student

Entry Point: Student Dashboard → Report Cards



Step 1 — Accessing Report Cards

The student clicks "Report Cards" in the sidebar. They see a list of terms (1st Term 2024/2025, 2nd Term 2024/2025, etc.).



Step 2 — Viewing the Current Term Report Card

The student clicks on the current term. If the Admin has released report cards, they see:

Report Card Content:
 School header (Ykay College logo, name, address, motto)
 Student details (name, class, student ID, session, term)
 Persubject table:

| Subject | CA1 | CA2 | Midterm | Assignment | Exam | Total | Grade | Remark |
||||||||||
| Mathematics | 8 | 7 | 9 | 8 | 52 | 84 | A1 | Excellent |

 Attendance summary (days present, absent, late, percentage)
 Psychomotor domain ratings (Sports, Arts, Music, etc.)
 Affective domain ratings (Punctuality, Neatness, Participation)
 Overall total and average
 Class position (e.g., 8th of 42 students)
 Class teacher's remark
 Director's remark
 Next term resumption date
 Outstanding fee balance
 QR code for authenticity verification



Step 3 — Downloading the Report Card

The student clicks "Download PDF". A branded Ykay College PDF downloads to their device.

If report cards have not yet been released, the student sees: "Report cards for this term are not yet available. You will be notified when they are released."



 FLOW 5.6 — Checking Attendance Records

Who: Student

Entry Point: Student Dashboard → My Attendance



Step 1 — Viewing Attendance

The student clicks "My Attendance". They see:

 A calendar view showing green dots (present), red dots (absent), yellow dots (late) for each school day
 A summary: Present: 68 days | Absent: 3 days | Late: 2 days | Attendance Rate: 93%
 An alert if their attendance falls below 75%: "⚠️ Your attendance is below the required 75% threshold. Please speak to your class teacher."



 FLOW 5.7 — Student Wellbeing CheckIn

Who: Student

Entry Point: Student Dashboard → Wellbeing



Step 1 — Daily Mood CheckIn

Each day, a subtle prompt appears at the bottom of the student dashboard:

> "How are you feeling today?"
> 😊 Great | 😐 Okay | 😢 Sad | 😰 Anxious

The student clicks one emoji. The response is anonymous at the individual level (admin sees classwide trends, not which student selected what — unless the student chooses to add a note).



Step 2 — Reporting a Concern

If the student is experiencing bullying or needs to speak to the counselor, they click "Report a Concern". They see options:

 Talk to a Counselor (private, direct message)
 Report Bullying/Harassment (anonymous)
 Report an Emergency

They select one and fill in the details. The school counselor and Admin receive an alert. The student's identity is protected in anonymous reports.





 PART 6: PARENT PORTAL FLOWS



 FLOW 6.1 — Parent Dashboard Overview

Who: Parent or guardian

Entry Point: Login → Parent Dashboard



Step 1 — Viewing the Dashboard

The parent sees:

Child Overview Card:
 Child's photo, name, class
 Attendance this term: [percentage]
 Last exam result: [subject, score, grade]
 Fee balance: ₦[amount outstanding]
 Last seen online: [date] (not shown for privacy)

Quick Actions:
 Pay School Fees
 View Report Card
 Message Teacher
 View Timetable

Notifications Feed:
 Recent attendance alerts
 New results released
 Upcoming events
 Fee reminders

If the parent has multiple children, a childswitcher button is visible at the top right.



 FLOW 6.2 — Parent Views Child's Academic Performance

Who: Parent

Entry Point: Parent Dashboard → My Child → Academics



Step 1 — Viewing Grades

The parent clicks "Academics". They see:

 A subjectbysubject breakdown of scores for the current term
 Each subject shows: CA1, CA2, Midterm, Assignment, Exam, Total, Grade
 Whether the child is above or below class average (comparison indicator)



Step 2 — Viewing Exam Results

The parent clicks on a specific exam (e.g., CA1 Mathematics). They see:

 Date taken
 Score and grade
 Class position (if teacher released it)



Step 3 — Viewing Report Card

The parent clicks "Report Cards". When released by Admin, they can view and download the branded Ykay College PDF report card. They can also receive it directly via WhatsApp (autosent on release).



 FLOW 6.3 — Parent Pays School Fees Online

Who: Parent

Entry Point: Parent Dashboard → Fees → Pay Now



Step 1 — Viewing the Invoice

The parent clicks "Fees" in the sidebar. They see:

 Current term invoice breakdown:

| Fee Item | Amount |
|||
| Tuition Fee | ₦30,000 |
| Development Levy | ₦5,000 |
| Exam Fee | ₦3,000 |
| ICT Levy | ₦2,000 |
| PTA Levy | ₦1,000 |
| Total | ₦41,000 |

 Amount already paid: ₦20,000
 Outstanding balance: ₦21,000



Step 2 — Initiating Payment

The parent clicks "Pay Now". They see:

 Amount to pay: ₦21,000 (full balance, or a text field to enter a partial amount)
 Payment method: Card / Bank Transfer / USSD

The parent selects their method and clicks "Proceed to Payment".



Step 3 — Paystack Payment Modal

The Paystack payment modal opens within the portal. For card payment, the parent enters their card details. Paystack processes the payment securely.



Step 4 — Payment Confirmation

On successful payment:

1. The system receives Paystack's webhook confirmation
2. The invoice is updated (balance reduced)
3. A receipt is generated and sent to the parent's email, SMS, and WhatsApp:
   > "Payment Received: ₦21,000 for [Child Name] — SS2 Fees, 2nd Term 2024/2025. Balance: ₦0. Receipt No: YKCRCP202503100042. Thank you! Ykay College."
4. The Bursar's payment dashboard updates in real time
5. The parent sees a success screen: "Payment successful! Your receipt has been sent to your email and WhatsApp."



Step 5 — Handling Payment Failure

If the payment fails, the Paystack modal shows the error reason (e.g., "Insufficient funds" / "Card declined"). The parent can try again with a different card or payment method. No invoice changes are made for failed transactions.



 FLOW 6.4 — Parent Views Child's Attendance

Who: Parent

Entry Point: Parent Dashboard → My Child → Attendance



Step 1 — Viewing Attendance Records

The parent clicks "Attendance". They see:

 A calendar view for the current term
 Each day is colorcoded: Green (Present), Red (Absent), Yellow (Late)
 Summary statistics: Attendance rate, Total days present/absent/late
 If a teacher added a note for an absence, it is shown (e.g., "Parent called — illness")



Step 2 — Receiving RealTime Absence Alerts

When the teacher marks the parent's child as absent during attendance registration, the parent receives:

 Push notification (if app installed): "Attendance Alert: [Child Name] was marked absent in SS2A today (Monday, March 10, 2025). Contact the school: 0800XXXXXXX if this is unexpected."
 SMS via Termii: Same message delivered to their registered phone number
 WhatsApp: Same message via WhatsApp Business API



 FLOW 6.5 — Parent Messages a Teacher

Who: Parent

Entry Point: Parent Dashboard → Messages



Step 1 — Starting a Message Thread

The parent clicks "Messages" in the sidebar. They see:

 Existing conversations with teachers and Admin
 A "New Message" button

The parent clicks "New Message", selects the teacher (e.g., Class Teacher or Mathematics Teacher), types their message, and clicks "Send".



Step 2 — Ongoing Conversation

The teacher receives an inapp notification of the new message. The conversation continues as a realtime chat thread. The parent and teacher can both send text messages. The admin can also be included in a conversation thread if needed.



 FLOW 6.6 — Parent Tops Up Canteen Wallet

Who: Parent

Entry Point: Parent Dashboard → Canteen Wallet



Step 1 — Viewing Wallet Balance

The parent clicks "Canteen" in the sidebar. They see:

 Current wallet balance: ₦[amount]
 Daily spending limit set by parent: ₦[amount]
 Recent transactions (date, item, amount spent)
 Total spent this week/month



Step 2 — Topping Up the Wallet

The parent clicks "Top Up Wallet". They enter the amount (e.g., ₦3,000) and click "Proceed to Payment". The Paystack modal opens. After successful payment, the wallet balance updates immediately. The parent sees a confirmation.



Step 3 — Setting a Daily Spending Limit

The parent clicks "Set Daily Limit". They enter a maximum daily amount (e.g., ₦500) and click "Save". The canteen system enforces this limit — when the student tries to purchase above the daily limit, the transaction is declined.



Step 4 — Receiving Spending Alerts

After every canteen purchase, the parent receives an SMS/WhatsApp notification:

> "Canteen Alert: [Child Name] purchased [Item Name] for ₦350 at 12:03 PM. Wallet Balance: ₦1,650. Ykay College Canteen."



 FLOW 6.7 — Parent Views School Events

Who: Parent

Entry Point: Parent Dashboard → Events



Step 1 — Viewing the Event Calendar

The parent clicks "Events" in the sidebar. They see a calendar view with upcoming school events (PTA meetings, Sports Day, Prize Giving, Exam dates, Resumption dates).



Step 2 — RSVPing to an Event

The parent clicks on an event. They see the event details and an "RSVP" button. They click "I Will Attend" and a confirmation is sent to the school admin.





 PART 7: ACADEMIC COORDINATOR / HOD FLOWS



 FLOW 7.1 — HOD Reviews Question Bank Submissions

Who: Head of Department

Entry Point: HOD Dashboard → Question Bank → Pending Approval



Step 1 — Viewing Pending Questions

The HOD clicks "Question Bank" → "Pending Approval". They see a list of questions submitted by teachers in their department, sorted by submission date.



Step 2 — Reviewing a Question

The HOD clicks "Review" on a question. They see the full question details. They check:

 Is the question appropriate for the class level?
 Is the correct answer actually correct?
 Is the question aligned with the NERDC curriculum topic?
 Is the explanation clear and accurate?



Step 3 — Approving or Rejecting

 Click "Approve" → question becomes available in the question bank for exam use
 Click "Reject" → a comment field appears; the HOD writes the reason; the question is returned to the teacher with feedback



 FLOW 7.2 — HOD Monitors Subject Performance

Who: Academic Coordinator / HOD

Entry Point: HOD Dashboard → Academic Reports → Subject Performance



Step 1 — Viewing Performance Reports

The HOD sees a subjectlevel performance breakdown:

 Class average scores per subject across all classes
 Comparison to schoolwide average
 Subjects with belowaverage performance highlighted in red



Step 2 — Drilling Down

The HOD clicks on a specific subject (e.g., Chemistry — SS1). They see:

 Average score: 48% (below school average of 62%)
 Score distribution chart
 Studentlevel breakdown (anonymized for general view, specific for HOD level)
 Teacher responsible for this class



Step 3 — Taking Action

The HOD sends a message to the Chemistry teacher via the messaging system, requesting a meeting to discuss intervention strategies.



 FLOW 7.3 — HOD Reviews and Approves Lesson Plans

Who: HOD

Entry Point: HOD Dashboard → Lesson Plans → Pending Review



Step 1 — Viewing Submitted Plans

The HOD clicks "Lesson Plans" → "Pending Review". They see a list of lesson plans submitted by teachers in their department.



Step 2 — Reviewing a Plan

The HOD clicks on a plan. They see the full lesson plan including objectives, teaching procedure, materials, and assessment strategy.



Step 3 — Approving or Returning

 Approve: The plan is marked approved. The teacher is notified.
 Return for Revision: The HOD types specific feedback. The plan is returned to the teacher.





 PART 8: DIRECTOR / SCHOOL OWNER FLOWS



 FLOW 8.1 — Director Reviews the Executive Dashboard

Who: School Director / Proprietor

Entry Point: Login → Director Dashboard



Step 1 — Viewing the Dashboard

The Director sees a highlevel executive dashboard:

Enrollment Section:
 Total students this session vs. last session
 Enrollment growth percentage
 New admissions this term
 Dropout/withdrawal count

Financial Section:
 Revenue collected this term: ₦XX,XXX,XXX
 Revenue target this term: ₦XX,XXX,XXX
 Collection rate: XX%
 Outstanding fees: ₦XX,XXX,XXX

Academic Section:
 Schoolwide average score this term
 WAEC/NECO pass rate (last WAEC cycle)
 Subjects with belowaverage performance
 Classes with lowest attendance rates

Staff Section:
 Total active staff
 Leave requests pending approval
 Teacher performance scores (this term)

Charts:
 Enrollment growth over 3 years (line chart)
 Revenue vs. target per term (bar chart)
 Attendance trend (last 8 weeks)
 Top 5 performing classes vs. bottom 5



Step 2 — Drilling Down

The Director clicks on any metric to see the underlying detail. For example, clicking on "Revenue: ₦XX,XXX,XXX" opens the full financial report. Clicking on "WAEC Pass Rate: 78%" opens the subjectbysubject WAEC performance analysis.



Step 3 — Exporting Reports

The Director can click "Export PDF" or "Export Excel" on any report section to generate a document for board presentations or regulatory submissions.



 FLOW 8.2 — Director Reviews Teacher Performance

Who: Director / Academic Coordinator

Entry Point: Director Dashboard → Staff → Performance Reviews



Step 1 — Viewing Performance Scores

The Director sees a table of all teachers with:

 Teacher name
 Department
 Classes taught
 Average student performance in their classes
 Attendance marking consistency (% of classes where attendance was marked)
 Lesson plans submitted and approved
 Assignments created and graded
 Overall performance score (calculated from KPIs)



Step 2 — Reviewing Individual Teachers

The Director clicks on a teacher's name to see a detailed performance profile across all KPIs. They can add qualitative remarks for the teacher's record.





 PART 9: REPORT CARD GENERATION FLOW (ADMINCONTROLLED)



 FLOW 9.1 — Generating and Releasing Report Cards

Who: Admin (controlled process involving Teacher scores)

Entry Point: Admin Dashboard → Report Cards → Generate



Step 1 — Preconditions Check

Before generating report cards, the system verifies:

 All CA scores entered by all teachers ✅
 All exam scores entered/autograded ✅
 Attendance records complete for the term ✅
 Psychomotor and affective domain ratings entered ✅

If any prerequisite is missing, the system shows: "The following teachers have not completed score entry: [list]. Report cards cannot be generated until all scores are submitted."



Step 2 — Locking the Gradebook

The Admin clicks "Lock Gradebook" to close score entry. All CA score cells become readonly for teachers. A banner appears in the teacher portal: "Gradebook locked by Admin on [date]. Contact Admin for corrections."



Step 3 — Generating Report Cards

The Admin clicks "Generate Report Cards" → selects the session and term → clicks "Generate All".

The system processes each student:

1. Retrieves all CA component scores + terminal exam score per subject
2. Computes total score
3. Applies A1–F9 grading scale
4. Calculates class ranking (position 1st, 2nd, 3rd...)
5. Retrieves attendance summary
6. Retrieves psychomotor and affective domain ratings
7. Generates AIassisted class teacher remark based on performance data
8. Compiles the report card
9. Generates a branded Ykay College PDF
10. Adds a QR code linking to the report card's online verification page

A progress bar shows: "Generating report cards... 85/420 complete."



Step 4 — Admin Reviews Report Cards

Before releasing, the Admin can preview any student's report card and make corrections to remarks (class teacher remarks, Director's remark).



Step 5 — Releasing Report Cards

The Admin clicks "Release Report Cards". A confirmation dialog:

> "This will make report cards visible to all students and parents and deliver them via WhatsApp and email. Continue?"

The Admin confirms. The system:

1. Makes report cards visible in student and parent portals
2. Sends branded PDF to each parent via WhatsApp and email
3. Sends an SMS notification to parents without smartphones: "[Child Name]'s report card for [Term] is ready. Ask the school to print a copy or log in at [URL]."
4. Sends push notifications to parents and students



Step 6 — Parent/Student Views Report Card

The parent opens WhatsApp, downloads the PDF, and views their child's full report card. Alternatively, they log into the parent portal and click "Report Cards" to view it online.



Step 7 — QR Code Verification

Any third party (another school, employer, government agency) can scan the QR code on the report card. They are taken to a public verification page:

> "This report card for [Student Name], Class SS2, 2nd Term 2024/2025, is authentic and was issued by Ykay College & Leadership Academy on [date]."





 PART 10: NOTIFICATION FLOWS



 FLOW 10.1 — Automated Notification Journey: Fee Overdue

Who: System (automated) → Parent

Trigger: Invoice unpaid after 7 days, 14 days, and 30 days



Day 7 (First Reminder):

System sends:
 SMS (Termii): "Reminder: [Child Name]'s school fees of ₦41,000 for 2nd Term are outstanding. Please pay before [deadline] to avoid disruption. Pay online: [URL]. Ykay College — 0800XXXXXXX."
 WhatsApp: Same message with a "Pay Now" button that links to the parent portal fee payment page
 Inapp notification: Badge on fee section in parent portal

Day 14 (Second Reminder):

Same message, slightly more urgent tone. Bursar also sees the student flagged in the outstanding fees report.

Day 30 (Final Notice):

SMS and WhatsApp message with urgent notice. Admin is alerted. Student may be flagged for followup by the class teacher.



 FLOW 10.2 — Automated Notification Journey: Absence Alert

Who: System (automated) → Parent

Trigger: Teacher marks student as Absent



Within 5 minutes of attendance submission:

 SMS: "Attendance Alert: [Child Name] (SS2A) was marked absent on Monday, March 10, 2025. If this is unexpected, please contact Ykay College: 0800XXXXXXX."
 Push notification (if parent has the app): Same message
 WhatsApp: Same message

If the teacher added a note (e.g., "Called in sick"), the note is included: "...Teacher's note: Parent called — child is unwell."



 FLOW 10.3 — Automated Notification Journey: Exam Scheduled

Who: System (automated) → Student + Parent

Trigger: Teacher publishes a new exam



Immediately on publication:

 Student inapp: "📝 New Exam Scheduled: CA1 Mathematics — Monday, March 10, 2025 at 9:00 AM. Duration: 60 minutes."
 Parent SMS: "Exam Notice: [Child Name] has a Mathematics CA1 exam on Monday, March 10, 2025 at 9:00 AM. Please ensure they are prepared. Ykay College."



24 hours before exam:

 Student push notification: "⏰ Reminder: Your Mathematics CA1 exam is tomorrow at 9:00 AM. Be ready!"
 Parent WhatsApp: "Reminder: [Child Name]'s Mathematics exam is tomorrow at 9:00 AM. Ykay College."





 PART 11: SYSTEM ADMINISTRATION FLOWS



 FLOW 11.1 — Admin Configures Notification Preferences

Who: Admin (for schoolwide defaults) / Any user (for personal preferences)

Entry Point: Settings → Notifications



Step 1 — Viewing Preferences

The user clicks on their profile icon → "Notification Preferences". They see a table with rows for each notification type and columns for each channel:

| Notification Type | InApp | SMS | WhatsApp | Email | Push |
|||||||
| Attendance absence | ✅ | ✅ | ✅ | ❌ | ✅ |
| Fee reminder | ✅ | ✅ | ✅ | ✅ | ❌ |
| Result released | ✅ | ❌ | ✅ | ✅ | ✅ |
| Assignment deadline | ✅ | ❌ | ❌ | ❌ | ✅ |



Step 2 — Updating Preferences

The user toggles checkboxes to enable or disable specific channels for each notification type. They click "Save Preferences". Changes take effect immediately.



 FLOW 11.2 — Admin Manages User Accounts

Who: Admin

Entry Point: Admin Dashboard → Users & Roles



Step 1 — Viewing All Users

The Admin clicks "Users & Roles". They see a table of all platform users with:

 Name, role, email, status (Active / Invited / Suspended)
 Last login date



Step 2 — Suspending a User

The Admin clicks on a user → "Suspend Account". A confirmation dialog appears. On confirmation, the user is immediately logged out of all sessions and cannot log in until reactivated. Their data is not deleted.



Step 3 — Reactivating a User

The Admin clicks on a suspended user → "Reactivate Account". The user can now log in again.



Step 4 — Changing a User's Role

The Admin clicks "Change Role" on a user. A dropdown shows all available roles. The Admin selects the new role and saves. The user's permissions update immediately on their next page load.



 FLOW 11.3 — Health Records Management

Who: School Nurse / Admin

Entry Point: Admin Dashboard → Health Records



Step 1 — Viewing a Student's Health Profile

The school nurse searches for a student by name or ID. They see:

 Blood group and genotype
 Known allergies
 Chronic conditions
 Emergency contact
 Immunization records
 Sick bay visit history



Step 2 — Logging a Sick Bay Visit

The nurse clicks "Log Sick Bay Visit":

 Student name (search)
 Date and time
 Symptoms reported
 Medications administered
 Action taken (rest and observed / referred to hospital / parent contacted)
 Notes

Clicks "Save". The system immediately sends a notification to the parent:

> "Health Alert: [Child Name] visited the sick bay at 10:43 AM today. Reason: Headache. Action: Given paracetamol and allowed to rest. If you have concerns, please contact the school: 0800XXXXXXX."



Step 3 — Medical Alert to Teacher

If a student has a critical condition (e.g., severe asthma), when their class teacher opens the attendance register, a medical alert banner appears at the top:

> "⚕️ Medical Alert: [Student Name] has Asthma. Ensure inhaler access. Avoid strenuous activity. Contact nurse in any emergency."





 PART 12: INVENTORY MANAGEMENT FLOWS



 FLOW 12.1 — Library Book Issue and Return

Who: Library Staff / Admin

Entry Point: Admin Dashboard → Inventory → Library



Step 1 — Issuing a Book

Library staff clicks "Issue Book":

 Search for book (by title or catalog number)
 Search for student (by name or student ID)
 Due date (autocalculated based on school policy, e.g., 2 weeks)

Clicks "Issue". The book is marked as Issued with the student's name and due date.



Step 2 — Returning a Book

Library staff clicks "Return Book":

 Search for the student's active issues
 Selects the book being returned
 Checks for damage or loss
 If returned after due date, system calculates fine

Clicks "Process Return". The book status changes to Available.



Step 3 — Overdue Alerts

The system automatically sends a reminder SMS/WhatsApp to the student (and their parent) when a book is overdue:

> "Library Reminder: The book '[Book Title]' borrowed from Ykay College Library was due on [Date]. Please return it to avoid a fine. Daily fine: ₦50."





 PART 13: ALUMNI PORTAL FLOWS



 FLOW 13.1 — Alumni SelfRegistration

Who: Graduate of Ykay College

Entry Point: Public website → Alumni → Register as Alumni



Step 1 — Filling the Registration Form

The alumni visits the school website and clicks "Alumni Registration". They fill in:

 Full name
 Graduation year
 Class (e.g., SS3A 2018)
 Current location (city, state, country)
 Current occupation/career field
 University attended (if applicable)
 Contact email and phone
 Profile photo (optional)
 Would you like to be a mentor? (toggle)
 Consent to appear in the success stories section (toggle)

Clicks "Submit Registration".



Step 2 — Admin Verification

Admin receives a notification of the new alumni registration. They verify the record against school records and either approve or reject.

On approval, the alumni receives an email: "Welcome to the Ykay College Alumni Network! Your profile is now live."



Step 3 — Mentorship Matching

If the alumni opted in as a mentor, the system matches them with SS3 students based on career interests. The student and mentor are connected via the messaging system.





 PART 14: COMPLETE ACADEMIC YEAR LIFECYCLE FLOW



 FLOW 14.1 — EndtoEnd Academic Year Journey

This section summarizes the full lifecycle of a school year on the platform, showing how all flows interconnect.



PHASE 1 — School Setup (Before Term Begins)

1. Admin configures school settings, session, and term dates
2. Admin creates classes and arms for new session
3. Admin sets up fee structure for the session
4. Admin publishes the school timetable
5. Teachers are invited and set up their accounts
6. Students are enrolled (new admissions + returning students)
7. Parent accounts are created and linked
8. Admin generates term invoices for all students



PHASE 2 — Term Begins

1. Parents receive fee invoices via SMS/WhatsApp
2. Parents pay fees online via Paystack from parent portal
3. Teachers log in daily and mark attendance for each class
4. Parents receive absence alerts in real time
5. Teachers upload lesson materials to Learning Hub
6. Teachers create and distribute assignments
7. Students access Learning Hub, submit assignments
8. Teachers grade assignments — grades feed into gradebook



PHASE 3 — MidTerm

1. Teachers create CA1 CBT exams
2. Students take exams in the CBT engine
3. Teachers release results after reviewing anticheat data
4. Teachers enter CA1 and CA2 scores into the gradebook
5. HOD reviews subject performance and intervenes where needed
6. Bursar sends fee reminders to parents with outstanding balances
7. Admin reviews EMIS data for compliance



PHASE 4 — End of Term

1. Teachers complete all score entry (CA1, CA2, midterm, assignment, exam)
2. Admin locks the gradebook
3. Admin generates all report cards
4. Admin reviews and approves report cards
5. Admin releases report cards
6. Report card PDFs delivered to parents via WhatsApp and email
7. Students view report cards in student portal
8. Admin generates EMIS/NEMIS compliance report and exports it
9. Admin runs fee reconciliation — identifies outstanding balances



PHASE 5 — Session End

1. Admin runs the student promotion engine
2. Students are promoted to next class or retained
3. Parents receive next session class notification
4. Graduated SS3 students are moved to Alumni status
5. Admin configures next session settings
6. New admission applications processed for next session intake





 APPENDIX: FLOW SUMMARY INDEX

| Flow Number | Flow Name | Primary User |
||||
| 1.1 | Browse Public Website | Public Visitor |
| 1.2 | Submit Online Admission Application | Prospective Parent |
| 1.3 | Check Application Status | Prospective Parent |
| 2.1 | FirstTime Admin Setup | Director/Admin |
| 2.2 | Staff Login | All Staff |
| 2.3 | Student Login | Student |
| 2.4 | Parent Login | Parent |
| 2.5 | Password Reset | All Users |
| 3.1 | Admin Dashboard Overview | Admin |
| 3.2 | Enroll New Student | Admin |
| 3.3 | Process Admission Application | Admin |
| 3.4 | Set Up Fee Structure | Admin/Bursar |
| 3.5 | Manage Payments and Financial Reports | Bursar |
| 3.6 | Manage Classes and Arms | Admin |
| 3.7 | Generate School Timetable | Admin |
| 3.8 | Manage Staff | Admin |
| 3.9 | Run Student Promotion Engine | Admin |
| 3.10 | Send Broadcast Notification | Admin |
| 3.11 | Generate EMIS/NEMIS Reports | Admin |
| 4.1 | Teacher Dashboard Overview | Teacher |
| 4.2 | Mark Daily Attendance | Teacher |
| 4.3 | Enter CA Scores | Subject Teacher |
| 4.4 | Create CBT Exam | Teacher |
| 4.5 | Manage Question Bank | Teacher |
| 4.6 | Create and Distribute Assignment | Teacher |
| 4.7 | Create and Teach Virtual Class | Teacher |
| 4.8 | Create Lesson Plan | Teacher |
| 4.9 | Upload Learning Materials | Teacher |
| 4.10 | Release CBT Exam Results | Teacher |
| 4.11 | Communicate with Parents | Teacher |
| 5.1 | Student Dashboard Overview | Student |
| 5.2 | Take CBT Exam | Student |
| 5.3 | Submit Assignment | Student |
| 5.4 | Access Learning Hub | Student |
| 5.5 | View Report Card | Student |
| 5.6 | Check Attendance Records | Student |
| 5.7 | Wellbeing CheckIn | Student |
| 6.1 | Parent Dashboard Overview | Parent |
| 6.2 | View Child's Academic Performance | Parent |
| 6.3 | Pay School Fees Online | Parent |
| 6.4 | View Child's Attendance | Parent |
| 6.5 | Message a Teacher | Parent |
| 6.6 | Top Up Canteen Wallet | Parent |
| 6.7 | View School Events | Parent |
| 7.1 | Review Question Bank Submissions | HOD |
| 7.2 | Monitor Subject Performance | HOD |
| 7.3 | Review and Approve Lesson Plans | HOD |
| 8.1 | Review Executive Dashboard | Director |
| 8.2 | Review Teacher Performance | Director |
| 9.1 | Generate and Release Report Cards | Admin |
| 10.1 | Fee Overdue Notification Journey | System → Parent |
| 10.2 | Absence Alert Notification Journey | System → Parent |
| 10.3 | Exam Scheduled Notification Journey | System → Student/Parent |
| 11.1 | Configure Notification Preferences | All Users |
| 11.2 | Manage User Accounts | Admin |
| 11.3 | Health Records Management | School Nurse |
| 12.1 | Library Book Issue and Return | Library Staff |
| 13.1 | Alumni SelfRegistration | Alumni |
| 14.1 | Complete Academic Year Lifecycle | All Roles |



This document represents the complete user flow specification for the Ykay College EduPortal, covering all five portals (Admin, Teacher, Student, Parent, and Director), the public website, and all automated system flows. Every flow in this document maps directly to a feature area defined in the PRD and should serve as the primary reference for UI/UX design, frontend development, and QA test case creation.

