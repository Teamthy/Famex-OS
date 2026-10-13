export type QuestionType = "mcq" | "true_false" | "fill_blank" | "essay" | "multi_select";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  subject: string;
  topic: string;
  classLevel: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  questionText: string;
  options?: QuestionOption[];
  correctAnswer?: string; // For fill_blank
  correctAnswers?: string[]; // For multi_select
  explanation?: string;
  imageUrl?: string;
  waecYear?: number;
  bloomsLevel?: string;
}

export interface ExamConfig {
  id: string;
  title: string;
  subject: string;
  classLevel: string;
  examType: "ca" | "midterm" | "final" | "mock" | "practice";
  instructions: string;
  durationMinutes: number;
  totalMarks: number;
  passMark: number;
  questionIds: string[];
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  fullscreenLock: boolean;
  tabSwitchDetection: boolean;
  disableCopyPaste: boolean;
  autoSubmitOnExpiry: boolean;
  allowCalculator: boolean;
  negativeMarking: boolean;
  negativeMarkValue: number;
  maxAttempts: number;
  showResultAfterSubmit: boolean;
  createdBy: string;
}

export interface ExamAttempt {
  examId: string;
  studentId: string;
  answers: Record<string, string | string[]>;
  flaggedQuestions: string[];
  startedAt: number;
  timeSpentSeconds: number;
  tabSwitches: number;
  fullscreenExits: number;
  antiCheatEvents: { type: string; timestamp: number }[];
  isSubmitted: boolean;
  score?: number;
  percentage?: number;
  grade?: string;
}

// ========================================
// MATHEMATICS QUESTIONS
// ========================================
export const MATH_QUESTIONS: Question[] = [
  {
    id: "math-001",
    type: "mcq",
    subject: "Mathematics",
    topic: "Algebra",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 2,
    questionText: "Solve for x: 2x + 5 = 15",
    options: [
      { id: "a", text: "x = 3", isCorrect: false },
      { id: "b", text: "x = 5", isCorrect: true },
      { id: "c", text: "x = 7", isCorrect: false },
      { id: "d", text: "x = 10", isCorrect: false },
    ],
    explanation: "2x + 5 = 15 → 2x = 10 → x = 5",
    bloomsLevel: "Application",
  },
  {
    id: "math-002",
    type: "mcq",
    subject: "Mathematics",
    topic: "Algebra",
    classLevel: "SS2",
    difficulty: "medium",
    marks: 2,
    questionText: "If 3(x - 4) = 2(x + 1), find the value of x.",
    options: [
      { id: "a", text: "x = 10", isCorrect: false },
      { id: "b", text: "x = 14", isCorrect: true },
      { id: "c", text: "x = 8", isCorrect: false },
      { id: "d", text: "x = 12", isCorrect: false },
    ],
    explanation: "3x - 12 = 2x + 2 → x = 14",
    bloomsLevel: "Application",
  },
  {
    id: "math-003",
    type: "mcq",
    subject: "Mathematics",
    topic: "Quadratic Equations",
    classLevel: "SS2",
    difficulty: "medium",
    marks: 3,
    questionText: "What are the roots of x² - 5x + 6 = 0?",
    options: [
      { id: "a", text: "x = 1 and x = 6", isCorrect: false },
      { id: "b", text: "x = 2 and x = 3", isCorrect: true },
      { id: "c", text: "x = -2 and x = -3", isCorrect: false },
      { id: "d", text: "x = 3 and x = -2", isCorrect: false },
    ],
    explanation: "x² - 5x + 6 = (x-2)(x-3) = 0, so x = 2 or x = 3",
    waecYear: 2020,
  },
  {
    id: "math-004",
    type: "mcq",
    subject: "Mathematics",
    topic: "Trigonometry",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 2,
    questionText: "If sin θ = 0.5, what is θ in degrees?",
    options: [
      { id: "a", text: "30°", isCorrect: true },
      { id: "b", text: "45°", isCorrect: false },
      { id: "c", text: "60°", isCorrect: false },
      { id: "d", text: "90°", isCorrect: false },
    ],
    explanation: "sin 30° = 0.5",
    waecYear: 2019,
  },
  {
    id: "math-005",
    type: "mcq",
    subject: "Mathematics",
    topic: "Geometry",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 2,
    questionText: "The area of a circle with radius 7cm is (π = 22/7):",
    options: [
      { id: "a", text: "154 cm²", isCorrect: true },
      { id: "b", text: "44 cm²", isCorrect: false },
      { id: "c", text: "22 cm²", isCorrect: false },
      { id: "d", text: "77 cm²", isCorrect: false },
    ],
    explanation: "A = πr² = 22/7 × 7² = 22/7 × 49 = 154 cm²",
    waecYear: 2021,
  },
  {
    id: "math-006",
    type: "true_false",
    subject: "Mathematics",
    topic: "Number Theory",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 1,
    questionText: "17 is a prime number.",
    options: [
      { id: "true", text: "True", isCorrect: true },
      { id: "false", text: "False", isCorrect: false },
    ],
    explanation: "17 is only divisible by 1 and itself, so it is prime.",
  },
  {
    id: "math-007",
    type: "fill_blank",
    subject: "Mathematics",
    topic: "Arithmetic",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 2,
    questionText: "The square root of 144 is ___",
    correctAnswer: "12",
    explanation: "√144 = 12 because 12 × 12 = 144",
  },
  {
    id: "math-008",
    type: "mcq",
    subject: "Mathematics",
    topic: "Statistics",
    classLevel: "SS2",
    difficulty: "medium",
    marks: 2,
    questionText: "Find the mean of: 4, 7, 8, 11, 15",
    options: [
      { id: "a", text: "8", isCorrect: false },
      { id: "b", text: "9", isCorrect: true },
      { id: "c", text: "10", isCorrect: false },
      { id: "d", text: "11", isCorrect: false },
    ],
    explanation: "Mean = (4+7+8+11+15)/5 = 45/5 = 9",
  },
  {
    id: "math-009",
    type: "mcq",
    subject: "Mathematics",
    topic: "Logarithms",
    classLevel: "SS2",
    difficulty: "hard",
    marks: 3,
    questionText: "Evaluate log₁₀ 1000",
    options: [
      { id: "a", text: "2", isCorrect: false },
      { id: "b", text: "3", isCorrect: true },
      { id: "c", text: "4", isCorrect: false },
      { id: "d", text: "10", isCorrect: false },
    ],
    explanation: "log₁₀ 1000 = log₁₀ 10³ = 3",
    waecYear: 2022,
  },
  {
    id: "math-010",
    type: "essay",
    subject: "Mathematics",
    topic: "Word Problems",
    classLevel: "SS2",
    difficulty: "hard",
    marks: 5,
    questionText:
      "A trader bought 100 oranges for ₦2,000 and sold them at ₦30 each. Calculate: (a) The total selling price (b) The profit made (c) The percentage profit. Show all working.",
    explanation:
      "(a) TSP = 100 × 30 = ₦3,000 (b) Profit = 3000 - 2000 = ₦1,000 (c) %Profit = (1000/2000) × 100 = 50%",
  },
];

// ========================================
// PHYSICS QUESTIONS
// ========================================
export const PHYSICS_QUESTIONS: Question[] = [
  {
    id: "phy-001",
    type: "mcq",
    subject: "Physics",
    topic: "Mechanics",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 2,
    questionText: "What is the SI unit of force?",
    options: [
      { id: "a", text: "Joule", isCorrect: false },
      { id: "b", text: "Newton", isCorrect: true },
      { id: "c", text: "Watt", isCorrect: false },
      { id: "d", text: "Pascal", isCorrect: false },
    ],
    explanation: "Force is measured in Newtons (N) in the SI system.",
  },
  {
    id: "phy-002",
    type: "mcq",
    subject: "Physics",
    topic: "Mechanics",
    classLevel: "SS2",
    difficulty: "medium",
    marks: 2,
    questionText: "A body of mass 5kg is accelerated from rest at 4m/s². What is the force?",
    options: [
      { id: "a", text: "10 N", isCorrect: false },
      { id: "b", text: "20 N", isCorrect: true },
      { id: "c", text: "25 N", isCorrect: false },
      { id: "d", text: "40 N", isCorrect: false },
    ],
    explanation: "F = ma = 5 × 4 = 20N",
    waecYear: 2021,
  },
  {
    id: "phy-003",
    type: "true_false",
    subject: "Physics",
    topic: "Waves",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 1,
    questionText: "Sound travels faster in air than in water.",
    options: [
      { id: "true", text: "True", isCorrect: false },
      { id: "false", text: "False", isCorrect: true },
    ],
    explanation: "Sound travels faster in denser media. Water is denser than air.",
  },
  {
    id: "phy-004",
    type: "fill_blank",
    subject: "Physics",
    topic: "Electricity",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 2,
    questionText: "The unit of electrical resistance is the ___",
    correctAnswer: "ohm",
    explanation: "Resistance is measured in ohms (Ω).",
  },
  {
    id: "phy-005",
    type: "mcq",
    subject: "Physics",
    topic: "Optics",
    classLevel: "SS2",
    difficulty: "medium",
    marks: 2,
    questionText: "Which type of lens is used to correct short-sightedness (myopia)?",
    options: [
      { id: "a", text: "Convex lens", isCorrect: false },
      { id: "b", text: "Concave lens", isCorrect: true },
      { id: "c", text: "Bifocal lens", isCorrect: false },
      { id: "d", text: "Plano-convex lens", isCorrect: false },
    ],
    explanation:
      "Concave (diverging) lenses correct myopia by diverging light rays before they enter the eye.",
    waecYear: 2020,
  },
];

// ========================================
// ENGLISH QUESTIONS
// ========================================
export const ENGLISH_QUESTIONS: Question[] = [
  {
    id: "eng-001",
    type: "mcq",
    subject: "English Language",
    topic: "Comprehension",
    classLevel: "SS2",
    difficulty: "easy",
    marks: 2,
    questionText:
      "Choose the word that best completes the sentence: 'The teacher ___ the students to be quiet.'",
    options: [
      { id: "a", text: "asked", isCorrect: true },
      { id: "b", text: "asking", isCorrect: false },
      { id: "c", text: "ask", isCorrect: false },
      { id: "d", text: "asks", isCorrect: false },
    ],
    explanation: "Past tense is needed here: 'asked'.",
  },
  {
    id: "eng-002",
    type: "mcq",
    subject: "English Language",
    topic: "Grammar",
    classLevel: "SS2",
    difficulty: "medium",
    marks: 2,
    questionText: "Which of the following is a complex sentence?",
    options: [
      { id: "a", text: "I went to the market.", isCorrect: false },
      { id: "b", text: "I went to the market and bought some fruits.", isCorrect: false },
      { id: "c", text: "When I went to the market, I bought some fruits.", isCorrect: true },
      { id: "d", text: "I went to the market. I bought some fruits.", isCorrect: false },
    ],
    explanation:
      "A complex sentence contains an independent clause and a dependent clause joined by a subordinating conjunction ('When').",
  },
  {
    id: "eng-003",
    type: "essay",
    subject: "English Language",
    topic: "Essay Writing",
    classLevel: "SS2",
    difficulty: "hard",
    marks: 10,
    questionText:
      "Write an essay of about 250 words on the topic: 'The Role of Technology in Modern Education'. Your essay should cover: (a) Introduction (b) Benefits of technology in education (c) Challenges (d) Conclusion.",
  },
];

// ========================================
// ALL QUESTIONS COMBINED
// ========================================
export const ALL_QUESTIONS = [...MATH_QUESTIONS, ...PHYSICS_QUESTIONS, ...ENGLISH_QUESTIONS];

// ========================================
// SAMPLE EXAM CONFIGS
// ========================================
export const SAMPLE_EXAMS: ExamConfig[] = [
  {
    id: "exam-math-ca1",
    title: "Mathematics — CA Test 1",
    subject: "Mathematics",
    classLevel: "SS2",
    examType: "ca",
    instructions:
      "Answer ALL questions. Each correct MCQ is worth 2 marks. Fill-in-the-blank questions require exact answers. Essay questions should show all working. No calculator is allowed for this test.",
    durationMinutes: 30,
    totalMarks: 24,
    passMark: 10,
    questionIds: [
      "math-001",
      "math-002",
      "math-003",
      "math-004",
      "math-005",
      "math-006",
      "math-007",
      "math-008",
      "math-009",
      "math-010",
    ],
    randomizeQuestions: true,
    randomizeOptions: true,
    fullscreenLock: true,
    tabSwitchDetection: true,
    disableCopyPaste: true,
    autoSubmitOnExpiry: true,
    allowCalculator: false,
    negativeMarking: false,
    negativeMarkValue: 0,
    maxAttempts: 1,
    showResultAfterSubmit: true,
    createdBy: "Dr. Grace Okonkwo",
  },
  {
    id: "exam-phy-mid",
    title: "Physics — Mid-Term Test",
    subject: "Physics",
    classLevel: "SS2",
    examType: "midterm",
    instructions:
      "Answer ALL questions. This test covers Mechanics, Waves, Electricity, and Optics. Show working where necessary.",
    durationMinutes: 45,
    totalMarks: 9,
    passMark: 4,
    questionIds: ["phy-001", "phy-002", "phy-003", "phy-004", "phy-005"],
    randomizeQuestions: false,
    randomizeOptions: true,
    fullscreenLock: true,
    tabSwitchDetection: true,
    disableCopyPaste: true,
    autoSubmitOnExpiry: true,
    allowCalculator: true,
    negativeMarking: false,
    negativeMarkValue: 0,
    maxAttempts: 1,
    showResultAfterSubmit: true,
    createdBy: "Dr. Grace Okonkwo",
  },
  {
    id: "exam-eng-ca1",
    title: "English Language — CA Test 1",
    subject: "English Language",
    classLevel: "SS2",
    examType: "ca",
    instructions: "Answer all questions. The essay should be approximately 250 words.",
    durationMinutes: 60,
    totalMarks: 14,
    passMark: 6,
    questionIds: ["eng-001", "eng-002", "eng-003"],
    randomizeQuestions: false,
    randomizeOptions: true,
    fullscreenLock: true,
    tabSwitchDetection: true,
    disableCopyPaste: true,
    autoSubmitOnExpiry: true,
    allowCalculator: false,
    negativeMarking: false,
    negativeMarkValue: 0,
    maxAttempts: 1,
    showResultAfterSubmit: true,
    createdBy: "Mr. Tunde Bakare",
  },
];

// ========================================
// GRADING HELPERS
// ========================================
export function gradeExam(
  questions: Question[],
  answers: Record<string, string | string[]>,
): {
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  results: {
    questionId: string;
    correct: boolean | null; // null = needs manual grading
    marksEarned: number;
    marksAvailable: number;
  }[];
} {
  let score = 0;
  let totalMarks = 0;
  const results: any[] = [];

  for (const q of questions) {
    totalMarks += q.marks;
    const answer = answers[q.id];

    if (q.type === "essay") {
      results.push({ questionId: q.id, correct: null, marksEarned: 0, marksAvailable: q.marks });
      continue;
    }

    let isCorrect = false;

    if (q.type === "mcq" || q.type === "true_false") {
      const correctOption = q.options?.find((o) => o.isCorrect);
      isCorrect = answer === correctOption?.id;
    } else if (q.type === "fill_blank") {
      isCorrect =
        typeof answer === "string" &&
        answer.toLowerCase().trim() === q.correctAnswer?.toLowerCase().trim();
    } else if (q.type === "multi_select") {
      const selected = Array.isArray(answer) ? answer.sort() : [];
      const correct = (q.correctAnswers || []).sort();
      isCorrect = JSON.stringify(selected) === JSON.stringify(correct);
    }

    const marksEarned = isCorrect ? q.marks : 0;
    score += marksEarned;
    results.push({ questionId: q.id, correct: isCorrect, marksEarned, marksAvailable: q.marks });
  }

  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const grade =
    percentage >= 75
      ? "A1"
      : percentage >= 70
        ? "B2"
        : percentage >= 65
          ? "B3"
          : percentage >= 60
            ? "C4"
            : percentage >= 55
              ? "C5"
              : percentage >= 50
                ? "C6"
                : percentage >= 45
                  ? "D7"
                  : percentage >= 40
                    ? "E8"
                    : "F9";

  return { score, totalMarks, percentage, grade, results };
}

export function shuffleArray<T>(array: T[], seed?: string): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  const seedNum = seed
    ? seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    : Math.random() * 1000;
  let rng = seedNum;

  const nextRandom = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  while (currentIndex > 0) {
    const randomIndex = Math.floor(nextRandom() * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[currentIndex],
    ];
  }

  return shuffled;
}
