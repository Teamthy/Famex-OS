/**
 * Ykay College — practice question bank (full SSCE subject coverage).
 * Self-contained (offline). MCQ + true/false, with explanations.
 */
export type Difficulty = "easy" | "medium" | "hard";

export interface PracticeQuestion {
  id: string;
  subject: string;
  difficulty: Difficulty;
  question: string;
  options: { key: string; text: string }[];
  correct: string;
  explanation: string;
}

export interface PracticeSubject {
  id: string;
  name: string;
  icon: string;
  color: string;
  questions: PracticeQuestion[];
}

const opt = (a: string, b: string, c: string, d: string) => [
  { key: "a", text: a }, { key: "b", text: b }, { key: "c", text: c }, { key: "d", text: d },
];

export const PRACTICE_SUBJECTS: PracticeSubject[] = [
  { id: "mathematics", name: "Mathematics", icon: "📐", color: "#4EC54D", questions: [
    { id: "m1", subject: "Mathematics", difficulty: "easy", question: "Solve for x:  2x + 5 = 15", options: opt("x = 3", "x = 5", "x = 7", "x = 10"), correct: "b", explanation: "2x = 10 → x = 5." },
    { id: "m2", subject: "Mathematics", difficulty: "medium", question: "Roots of  x² − 5x + 6 = 0?", options: opt("1 and 6", "2 and 3", "−2 and −3", "3 and −2"), correct: "b", explanation: "(x−2)(x−3) = 0." },
    { id: "m3", subject: "Mathematics", difficulty: "easy", question: "Area of a circle, radius 7 cm (π = 22/7)?", options: opt("154 cm²", "44 cm²", "22 cm²", "77 cm²"), correct: "a", explanation: "πr² = 22/7 × 49 = 154 cm²." },
    { id: "m4", subject: "Mathematics", difficulty: "hard", question: "Evaluate  log₁₀ 1000.", options: opt("2", "3", "4", "10"), correct: "b", explanation: "log₁₀ 10³ = 3." },
  ]},
  { id: "english", name: "English Language", icon: "📖", color: "#FF9133", questions: [
    { id: "e1", subject: "English Language", difficulty: "easy", question: "“The teacher ___ the students to be quiet.”", options: opt("asked", "asking", "ask", "asks"), correct: "a", explanation: "Past tense “asked”." },
    { id: "e2", subject: "English Language", difficulty: "medium", question: "Which is a complex sentence?", options: opt("I went to the market.", "I went and bought fruits.", "When I went, I bought fruits.", "I went. I bought fruits."), correct: "c", explanation: "Has a dependent clause (“When…”)." },
    { id: "e3", subject: "English Language", difficulty: "easy", question: "Correctly spelled word?", options: opt("Accomodation", "Acommodation", "Accommodation", "Acomodation"), correct: "c", explanation: "Double c, double m." },
  ]},
  { id: "physics", name: "Physics", icon: "⚛️", color: "#3B82F6", questions: [
    { id: "p1", subject: "Physics", difficulty: "easy", question: "SI unit of force?", options: opt("Joule", "Newton", "Watt", "Pascal"), correct: "b", explanation: "Force is in Newtons (N)." },
    { id: "p2", subject: "Physics", difficulty: "medium", question: "Force on a 5 kg mass at 4 m/s²?", options: opt("10 N", "20 N", "25 N", "40 N"), correct: "b", explanation: "F = ma = 5 × 4 = 20 N." },
    { id: "p3", subject: "Physics", difficulty: "medium", question: "Lens that corrects short-sightedness?", options: opt("Convex", "Concave", "Bifocal", "Plano-convex"), correct: "b", explanation: "Concave lenses correct myopia." },
  ]},
  { id: "chemistry", name: "Chemistry", icon: "🧪", color: "#22C55E", questions: [
    { id: "ch1", subject: "Chemistry", difficulty: "easy", question: "Chemical symbol for gold?", options: opt("Go", "Au", "Ag", "Gd"), correct: "b", explanation: "Gold = Au (from Latin aurum)." },
    { id: "ch2", subject: "Chemistry", difficulty: "easy", question: "Atomic number of hydrogen?", options: opt("1", "2", "7", "8"), correct: "a", explanation: "Hydrogen has 1 proton." },
    { id: "ch3", subject: "Chemistry", difficulty: "medium", question: "pH of a neutral solution at 25°C?", options: opt("0", "7", "14", "1"), correct: "b", explanation: "Neutral pH is 7." },
    { id: "ch4", subject: "Chemistry", difficulty: "medium", question: "Which is a noble gas?", options: opt("Oxygen", "Nitrogen", "Helium", "Chlorine"), correct: "c", explanation: "Helium is a noble (inert) gas." },
  ]},
  { id: "biology", name: "Biology", icon: "🧬", color: "#62D35E", questions: [
    { id: "b1", subject: "Biology", difficulty: "easy", question: "The “powerhouse” of the cell?", options: opt("Nucleus", "Ribosome", "Mitochondria", "Vacuole"), correct: "c", explanation: "Mitochondria make ATP." },
    { id: "b2", subject: "Biology", difficulty: "easy", question: "Process by which plants make food?", options: opt("Respiration", "Photosynthesis", "Transpiration", "Digestion"), correct: "b", explanation: "Photosynthesis." },
    { id: "b3", subject: "Biology", difficulty: "medium", question: "Which cells fight infection?", options: opt("Red cells", "Platelets", "White cells", "Plasma"), correct: "c", explanation: "White blood cells." },
  ]},
  { id: "economics", name: "Economics", icon: "💰", color: "#F59E0B", questions: [
    { id: "ec1", subject: "Economics", difficulty: "easy", question: "Scarcity in economics means…", options: opt("Unlimited resources", "Limited resources vs unlimited wants", "No goods", "Abundance"), correct: "b", explanation: "Scarcity = limited resources vs unlimited wants." },
    { id: "ec2", subject: "Economics", difficulty: "medium", question: "Demand curve normally slopes…", options: opt("Upward", "Downward", "Horizontal", "Vertical"), correct: "b", explanation: "Lower price → higher quantity demanded." },
    { id: "ec3", subject: "Economics", difficulty: "easy", question: "Opportunity cost is…", options: opt("Money spent", "Next best alternative forgone", "Total cost", "Fixed cost"), correct: "b", explanation: "Opportunity cost = next best alternative given up." },
  ]},
  { id: "civic", name: "Civic Education", icon: "🇳🇬", color: "#FF6E00", questions: [
    { id: "ci1", subject: "Civic Education", difficulty: "easy", question: "Number of states in Nigeria?", options: opt("30", "36", "37", "40"), correct: "b", explanation: "36 states + FCT." },
    { id: "ci2", subject: "Civic Education", difficulty: "medium", question: "Which is a fundamental human right?", options: opt("Right to drive", "Right to life", "Right to a phone", "Right to vote early"), correct: "b", explanation: "Right to life is fundamental." },
  ]},
  { id: "geography", name: "Geography", icon: "🌍", color: "#0EA5E9", questions: [
    { id: "g1", subject: "Geography", difficulty: "easy", question: "Largest river in Africa?", options: opt("Niger", "Nile", "Congo", "Zambezi"), correct: "b", explanation: "The Nile is the longest river in Africa." },
    { id: "g2", subject: "Geography", difficulty: "easy", question: "Capital of Nigeria?", options: opt("Lagos", "Abuja", "Kano", "Port Harcourt"), correct: "b", explanation: "Abuja is the federal capital." },
    { id: "g3", subject: "Geography", difficulty: "medium", question: "Which is a renewable resource?", options: opt("Coal", "Petroleum", "Solar energy", "Natural gas"), correct: "c", explanation: "Solar energy is renewable." },
  ]},
  { id: "computer", name: "Computer Studies", icon: "💻", color: "#8B5CF6", questions: [
    { id: "co1", subject: "Computer Studies", difficulty: "easy", question: "Brain of the computer?", options: opt("RAM", "CPU", "Monitor", "Keyboard"), correct: "b", explanation: "The CPU is the processor (brain)." },
    { id: "co2", subject: "Computer Studies", difficulty: "easy", question: "1 KB = ? bytes", options: opt("100", "1000", "1024", "512"), correct: "c", explanation: "1 KB = 1024 bytes." },
    { id: "co3", subject: "Computer Studies", difficulty: "medium", question: "HTML is used for…", options: opt("Styling", "Database", "Web page structure", "Networking"), correct: "c", explanation: "HTML structures web pages." },
  ]},
  { id: "agric", name: "Agricultural Science", icon: "🌾", color: "#16A34A", questions: [
    { id: "ag1", subject: "Agricultural Science", difficulty: "easy", question: "Rearing of animals is called…", options: opt("Crop farming", "Animal husbandry", "Fishery", "Forestry"), correct: "b", explanation: "Animal husbandry." },
    { id: "ag2", subject: "Agricultural Science", difficulty: "medium", question: "Which is a cash crop?", options: opt("Maize", "Cocoa", "Cassava", "Yam"), correct: "b", explanation: "Cocoa is grown mainly for sale/export." },
    { id: "ag3", subject: "Agricultural Science", difficulty: "easy", question: "Loosening of soil is called…", options: opt("Harvesting", "Tillage", "Pruning", "Threshing"), correct: "b", explanation: "Tillage (tillage loosens soil)." },
  ]},
  { id: "literature", name: "Literature", icon: "🎭", color: "#EC4899", questions: [
    { id: "li1", subject: "Literature", difficulty: "easy", question: "A play is also called a…", options: opt("Novel", "Drama", "Poem", "Essay"), correct: "b", explanation: "A play = drama." },
    { id: "li2", subject: "Literature", difficulty: "medium", question: "“He is a lion in battle” is a…", options: opt("Simile", "Metaphor", "Hyperbole", "Irony"), correct: "b", explanation: "A metaphor compares directly (no “like/as”)." },
    { id: "li3", subject: "Literature", difficulty: "easy", question: "The main character of a story is the…", options: opt("Antagonist", "Protagonist", "Narrator", "Villain"), correct: "b", explanation: "The protagonist is the central character." },
  ]},
  { id: "fmaths", name: "Further Maths", icon: "➗", color: "#06B6D4", questions: [
    { id: "fm1", subject: "Further Maths", difficulty: "medium", question: "Derivative of  x²  w.r.t x?", options: opt("x", "2x", "2", "x²/2"), correct: "b", explanation: "d/dx(x²) = 2x." },
    { id: "fm2", subject: "Further Maths", difficulty: "hard", question: "∫ 2x dx = ?", options: opt("x²", "x² + C", "2", "2x²"), correct: "b", explanation: "∫2x dx = x² + C." },
    { id: "fm3", subject: "Further Maths", difficulty: "medium", question: "If f(x) = 3x − 1, f(2) = ?", options: opt("4", "5", "6", "7"), correct: "b", explanation: "3(2) − 1 = 5." },
  ]},
  { id: "crs", name: "Religious Studies", icon: "✝️", color: "#F43F5E", questions: [
    { id: "r1", subject: "Religious Studies", difficulty: "easy", question: "How many days did creation take (Genesis)?", options: opt("5", "6", "7", "8"), correct: "b", explanation: "Six days of creation, rest on the 7th." },
    { id: "r2", subject: "Religious Studies", difficulty: "easy", question: "Who led the Israelites out of Egypt?", options: opt("Aaron", "Moses", "David", "Abraham"), correct: "b", explanation: "Moses led the Exodus." },
  ]},
  { id: "government", name: "Government", icon: "🏛️", color: "#64748B", questions: [
    { id: "gv1", subject: "Government", difficulty: "easy", question: "Government by the people is…", options: opt("Monarchy", "Democracy", "Oligarchy", "Dictatorship"), correct: "b", explanation: "Democracy = rule by the people." },
    { id: "gv2", subject: "Government", difficulty: "medium", question: "Separation of powers was propounded by…", options: opt("Hobbes", "Montesquieu", "Locke", "Rousseau"), correct: "b", explanation: "Montesquieu advocated separation of powers." },
  ]},
];

export const ALL_PRACTICE_QUESTIONS = PRACTICE_SUBJECTS.flatMap((s) => s.questions);
