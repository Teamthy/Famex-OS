# CBT Expansion Strategy for Ykay College

## 1. Purpose

Position CBT as one of the core engines of the Ykay digital education project. This is not a small future add-on; it is a strategic product pillar that can drive student engagement, public adoption, brand positioning, and long-term growth.

The goal is to build a full Computer-Based Test (CBT) platform for exam preparation that supports both current Ykay students and external learners preparing for JAMB and WAEC examinations.

## 2. Product Vision

Create a trusted, exam-focused learning experience where users can:

- practice in a realistic CBT environment,
- study using a structured syllabus-based system,
- track performance over time, and
- build confidence before sitting for major exams.

The long-term goal is for Ykay to become a recognized hub for digital exam preparation in Nigeria and a flagship product that defines the school’s technology-driven identity.

## 3. Strategic Objectives

- Deliver realistic simulation of JAMB and WAEC-style practice exams.
- Support both students and non-students with a public-friendly learning experience.
- Provide a complete study system built around the official syllabus structure.
- Build a scalable exam engine that can later support more subjects, assessments, and learning products.
- Create a strong product link between IT education, student learning, admissions value, and school brand growth.
- Treat CBT as a major growth engine that can attract users beyond the school community.

## 4. Target Users

### Primary users
- Current Ykay students
- Prospective students and parents
- External candidates preparing for JAMB or WAEC

### Secondary users
- Teachers and school administrators
- Exam content reviewers and curriculum managers

## 5. Core Product Offerings

### 5.1 CBT Practice Exams

Users should be able to take:

- timed mock exams,
- topic-based practice tests,
- full-length simulation tests,
- subject-wise revision quizzes.

The experience should feel like a real exam hall, including:

- countdown timer,
- question navigation,
- answer review,
- instant feedback,
- score summary.

### 5.2 Full JAMB and WAEC Study System

The platform should not only test users; it should teach them.

Core study features should include:

- subject-based syllabus breakdown,
- topic-by-topic learning paths,
- notes and study guides,
- flashcards and revision tools,
- recommended practice sets,
- daily study plans and progress tracking.

### 5.3 Performance Analytics

Users should see:

- total score and percentage,
- accuracy by subject,
- time spent per question,
- weak topic areas,
- improvement over repeated attempts.

This makes the experience useful for both self-study and guided school support.

## 6. Content Strategy

### 6.1 Syllabus-first approach

The platform should be built around the actual structure of the JAMB and WAEC curriculum rather than random question dumps.

Each subject should be organized as:

- syllabus topic,
- subtopic,
- learning content,
- practice questions,
- explanation and answer review.

### 6.2 Initial subject priority

Start with the most commonly used subjects:

- English Language
- Mathematics
- Biology
- Chemistry
- Physics
- Government
- Economics
- Literature-in-English

### 6.3 Content quality standard

All content should be reviewed for:

- accuracy,
- age-appropriateness,
- clarity of explanations,
- alignment with school and national exam standards.

## 7. Platform Experience Design

### 7.1 User journey

A user should be able to:

1. create an account or use guest access,
2. choose JAMB or WAEC practice mode,
3. select a subject or full exam package,
4. take a timed test,
5. review performance and weak areas,
6. continue with study recommendations.

### 7.2 Recommended user flows

- Student flow: school-linked practice + progress dashboard
- Public user flow: free trial and premium practice packs
- Parent flow: child performance summary and reports
- Admin flow: content creation, test scheduling, and analytics review

## 8. Technical Implementation Strategy

### 8.1 Recommended stack

The current Next.js + Prisma-based architecture is suitable for this expansion.

Suggested pieces:

- Frontend: Next.js app routes and reusable UI components
- Backend: API routes or server actions for exam logic and data persistence
- Database: PostgreSQL via Prisma
- Authentication: existing auth system or a dedicated user account layer
- Admin panel: CMS-style interface for managing subjects, topics, questions, and exams

### 8.2 Suggested module structure

A practical implementation can be organized as:

- app/cbt/page.tsx for the main CBT landing page
- app/cbt/practice/page.tsx for subject selection
- app/cbt/mock/page.tsx for timed mock exams
- app/cbt/results/page.tsx for score reports
- app/cbt/study/page.tsx for syllabus and topic-based learning
- components/CBTExamEngine.tsx for the core test experience
- lib/cbt/ for question bank, syllabus, and scoring logic

### 8.3 Data model ideas

Core entities should include:

- User
- Subject
- Topic
- Question
- ExamSet
- ExamAttempt
- ExamResult
- StudyPlan
- CertificateAward

## 9. Strategic Priority and Rollout Approach

CBT should be treated as a high-priority strategic platform from the start of the project roadmap. It should be planned early, even if the first version is modest.

### Core principle

The platform should grow in layers:

1. first deliver a usable and realistic exam practice experience,
2. then expand into a full study and learning system,
3. then evolve into a major digital education product.

This phased approach ensures the project does not delay the vision while still keeping the product practical and buildable.

## 10. Implementation Phases

### Phase 1 — MVP Launch

Focus on a usable first version.

Deliverables:

- student and public access entry page,
- subject selection,
- timed practice tests,
- basic scoring and results,
- simple admin question management.

Target scope:

- 3 to 5 core subjects,
- 100 to 300 questions,
- basic mock exam mode.

### Phase 2 — Study System Expansion

Add learning tools beyond testing.

Deliverables:

- full syllabus mapping,
- topic notes and study guides,
- revision plans,
- flashcards or short study drills,
- performance-based recommendations.

### Phase 3 — Full Simulation Experience

Create a more realistic and premium exam experience.

Deliverables:

- full-length JAMB-style mocks,
- WAEC-style timed sessions,
- answer explanations,
- detailed analytics,
- progress history and ranking.

### Phase 4 — Growth and Personalization

Scale the platform into a stronger digital product.

Deliverables:

- personalized study recommendations,
- adaptive question difficulty,
- certification badges,
- parent dashboards,
- paid premium packs or subscriptions.

## 11. Access and Monetization Model

A flexible model should be used:

- free access for basic practice tests,
- limited daily attempts for guest users,
- premium access for full mock exams and detailed reports,
- school-linked access for Ykay students.

This helps grow adoption while keeping the product sustainable.

## 12. Security and Exam Integrity

Because this is a simulation platform, the experience should be secure and credible.

Recommended safeguards:

- timeout-based session control,
- answer submission tracking,
- anti-tab-switch or anti-copy behavior where appropriate,
- admin moderation of questions and exam content,
- audit logs for suspicious activity.

## 13. Risks and Mitigation

### Risk: weak or inaccurate content
Mitigation: use a review process with subject experts and school staff.

### Risk: poor user engagement
Mitigation: make the experience game-like and progress-driven with streaks, badges, and clear feedback.

### Risk: slow implementation
Mitigation: start with a narrow MVP and expand step by step.

### Risk: scalability problems
Mitigation: build the exam engine and question system in a modular way from the start.

## 14. Success Metrics

The expansion should be considered successful if it achieves:

- strong adoption by students and public users,
- consistent test completion rates,
- measurable improvement in user performance over time,
- growing retention for repeat practice sessions,
- increased awareness of Ykay as a digital learning brand.

## 15. Recommendation

The CBT expansion should be treated as a strategic product extension of the Ykay IT education initiative. The best path is to start with a focused MVP that delivers realistic exam practice, syllabus-based study support, and clear performance feedback before expanding into full simulation and premium features.

## 16. Suggested Next Steps

1. Finalize the first set of subjects and exam formats.
2. Create the question and syllabus content structure.
3. Build the MVP exam engine and account flow.
4. Launch a pilot version for Ykay students and a small public test group.
5. Review results and expand with study tools and richer analytics.
