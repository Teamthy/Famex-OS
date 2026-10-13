import type { ITCourseContent } from "@/components/it/ITCourseTrackPage";

export const IT_COURSES: Record<string, ITCourseContent> = {
  python: {
    slug: "python",
    title: "Python Programming Certification",
    shortTitle: "Python",
    certification: "IT Specialist \u2013 Python",
    category: "Programming & AI",
    duration: "8 Weeks",
    difficulty: "Beginner to Intermediate",
    heroTagline: "Master the world's most popular programming language",
    heroDescription:
      "From basics to real projects \u2014 prepare for the IT Specialist Python credential.",
    heroImages: ["/python-hero.jpg", "/home/hero-campus.jpg"],
    overview:
      "This comprehensive Python programming course takes you from beginner to confident developer. You will learn syntax, data structures, OOP, files, and practical projects that prepare you for the IT Specialist \u2013 Python exam.",
    learningObjectives: [
      "Master Python syntax and fundamentals",
      "Work with lists, tuples, dictionaries and sets",
      "Implement object-oriented programming",
      "Handle files and exceptions",
      "Build simple apps and automations",
      "Prepare for certification practice tests",
    ],
    curriculum: [
      {
        week: "Week 1\u20132: Fundamentals",
        topics: [
          "Environment setup",
          "Variables and operators",
          "Control flow",
          "Functions",
          "I/O basics",
        ],
      },
      {
        week: "Week 3\u20134: Data structures",
        topics: [
          "Lists and tuples",
          "Dictionaries and sets",
          "Comprehensions",
          "Strings",
          "Error handling",
        ],
      },
      {
        week: "Week 5\u20136: OOP",
        topics: ["Classes and objects", "Inheritance", "Encapsulation", "Magic methods", "Files"],
      },
      {
        week: "Week 7\u20138: Projects",
        topics: ["SQLite basics", "Flask intro", "APIs", "Capstone project", "Exam prep"],
      },
    ],
    certificationDetails: {
      name: "IT Specialist \u2013 Python",
      provider: "Certiport",
      examCode: "ITSP-PY100",
      validity: "Lifetime",
      recognition: "Globally recognized by employers and schools",
      examFormat: "Multiple-choice, timed",
      passingScore: "70%",
      logoText: "IT Specialist\nPython",
    },
    targetAudience: ["Beginners", "Secondary students", "Career switchers"],
    prerequisites: ["Basic computer literacy", "No prior coding required"],
    careerOutcomes: ["Python Developer", "Data Analyst", "Automation Engineer"],
    relatedCourses: [
      {
        title: "Artificial Intelligence",
        href: "/it-education/ai",
      },
      {
        title: "Cybersecurity",
        href: "/it-education/cybersecurity",
      },
      {
        title: "Digital Literacy",
        href: "/it-education/digital-literacy",
      },
    ],
  },
  ai: {
    duration: "8 Weeks",
    difficulty: "Beginner to Intermediate",
    learningObjectives: [
      "Master Python syntax and fundamentals",
      "Work with lists, tuples, dictionaries and sets",
      "Implement object-oriented programming",
      "Handle files and exceptions",
      "Build simple apps and automations",
      "Prepare for certification practice tests",
    ],
    curriculum: [
      {
        week: "Week 1\u20132: Fundamentals",
        topics: [
          "Environment setup",
          "Variables and operators",
          "Control flow",
          "Functions",
          "I/O basics",
        ],
      },
      {
        week: "Week 3\u20134: Data structures",
        topics: [
          "Lists and tuples",
          "Dictionaries and sets",
          "Comprehensions",
          "Strings",
          "Error handling",
        ],
      },
      {
        week: "Week 5\u20136: OOP",
        topics: ["Classes and objects", "Inheritance", "Encapsulation", "Magic methods", "Files"],
      },
      {
        week: "Week 7\u20138: Projects",
        topics: ["SQLite basics", "Flask intro", "APIs", "Capstone project", "Exam prep"],
      },
    ],
    targetAudience: ["Beginners", "Secondary students", "Career switchers"],
    prerequisites: ["Basic computer literacy", "No prior coding required"],
    careerOutcomes: ["Python Developer", "Data Analyst", "Automation Engineer"],
    slug: "ai",
    title: "Artificial Intelligence Certification",
    shortTitle: "AI",
    certification: "IT Specialist \u2013 AI",
    category: "Programming & AI",
    heroTagline: "Build real skill in Artificial Intelligence",
    heroDescription: "A practical, project-driven pathway toward IT Specialist \u2013 AI.",
    heroImages: ["/ai-hero.jpg", "/home/hero-campus.jpg"],
    overview:
      "This Artificial Intelligence track is designed for secondary students and external learners who want practical, certification-aligned skills. Lessons combine theory, labs, and portfolio tasks.",
    certificationDetails: {
      name: "IT Specialist \u2013 AI",
      provider: "Certiport / Ykay IT Hub",
      examCode: "TRACK",
      validity: "Programme dependent",
      recognition: "Industry-aligned credential pathway",
      examFormat: "Practical + objective assessment",
      passingScore: "70%",
      logoText: "AI",
    },
    relatedCourses: [
      {
        title: "Python Programming",
        href: "/it-education/python",
      },
      {
        title: "Digital Literacy",
        href: "/it-education/digital-literacy",
      },
      {
        title: "Microsoft Excel",
        href: "/it-education/microsoft-excel",
      },
    ],
  },
  cybersecurity: {
    duration: "8 Weeks",
    difficulty: "Beginner to Intermediate",
    learningObjectives: [
      "Master Python syntax and fundamentals",
      "Work with lists, tuples, dictionaries and sets",
      "Implement object-oriented programming",
      "Handle files and exceptions",
      "Build simple apps and automations",
      "Prepare for certification practice tests",
    ],
    curriculum: [
      {
        week: "Week 1\u20132: Fundamentals",
        topics: [
          "Environment setup",
          "Variables and operators",
          "Control flow",
          "Functions",
          "I/O basics",
        ],
      },
      {
        week: "Week 3\u20134: Data structures",
        topics: [
          "Lists and tuples",
          "Dictionaries and sets",
          "Comprehensions",
          "Strings",
          "Error handling",
        ],
      },
      {
        week: "Week 5\u20136: OOP",
        topics: ["Classes and objects", "Inheritance", "Encapsulation", "Magic methods", "Files"],
      },
      {
        week: "Week 7\u20138: Projects",
        topics: ["SQLite basics", "Flask intro", "APIs", "Capstone project", "Exam prep"],
      },
    ],
    targetAudience: ["Beginners", "Secondary students", "Career switchers"],
    prerequisites: ["Basic computer literacy", "No prior coding required"],
    careerOutcomes: ["Python Developer", "Data Analyst", "Automation Engineer"],
    slug: "cybersecurity",
    title: "Cybersecurity Certification",
    shortTitle: "Cyber",
    certification: "IT Specialist \u2013 Cybersecurity",
    category: "Security",
    heroTagline: "Build real skill in Cybersecurity",
    heroDescription:
      "A practical, project-driven pathway toward IT Specialist \u2013 Cybersecurity.",
    heroImages: ["/cybersecurity-hero.jpg", "/home/hero-campus.jpg"],
    overview:
      "This Cybersecurity track is designed for secondary students and external learners who want practical, certification-aligned skills. Lessons combine theory, labs, and portfolio tasks.",
    certificationDetails: {
      name: "IT Specialist \u2013 Cybersecurity",
      provider: "Certiport / Ykay IT Hub",
      examCode: "TRACK",
      validity: "Programme dependent",
      recognition: "Industry-aligned credential pathway",
      examFormat: "Practical + objective assessment",
      passingScore: "70%",
      logoText: "Cyber",
    },
    relatedCourses: [
      {
        title: "Python Programming",
        href: "/it-education/python",
      },
      {
        title: "Digital Literacy",
        href: "/it-education/digital-literacy",
      },
      {
        title: "Microsoft Excel",
        href: "/it-education/microsoft-excel",
      },
    ],
  },
  "digital-literacy": {
    duration: "8 Weeks",
    difficulty: "Beginner to Intermediate",
    learningObjectives: [
      "Master Python syntax and fundamentals",
      "Work with lists, tuples, dictionaries and sets",
      "Implement object-oriented programming",
      "Handle files and exceptions",
      "Build simple apps and automations",
      "Prepare for certification practice tests",
    ],
    curriculum: [
      {
        week: "Week 1\u20132: Fundamentals",
        topics: [
          "Environment setup",
          "Variables and operators",
          "Control flow",
          "Functions",
          "I/O basics",
        ],
      },
      {
        week: "Week 3\u20134: Data structures",
        topics: [
          "Lists and tuples",
          "Dictionaries and sets",
          "Comprehensions",
          "Strings",
          "Error handling",
        ],
      },
      {
        week: "Week 5\u20136: OOP",
        topics: ["Classes and objects", "Inheritance", "Encapsulation", "Magic methods", "Files"],
      },
      {
        week: "Week 7\u20138: Projects",
        topics: ["SQLite basics", "Flask intro", "APIs", "Capstone project", "Exam prep"],
      },
    ],
    targetAudience: ["Beginners", "Secondary students", "Career switchers"],
    prerequisites: ["Basic computer literacy", "No prior coding required"],
    careerOutcomes: ["Python Developer", "Data Analyst", "Automation Engineer"],
    slug: "digital-literacy",
    title: "Digital Literacy Certification",
    shortTitle: "Digital",
    certification: "Ykay Digital Literacy Certificate",
    category: "Foundation",
    heroTagline: "Build real skill in Digital Literacy",
    heroDescription:
      "A practical, project-driven pathway toward Ykay Digital Literacy Certificate.",
    heroImages: ["/it-hub-classroom.jpg", "/home/hero-campus.jpg"],
    overview:
      "This Digital Literacy track is designed for secondary students and external learners who want practical, certification-aligned skills. Lessons combine theory, labs, and portfolio tasks.",
    certificationDetails: {
      name: "Ykay Digital Literacy Certificate",
      provider: "Certiport / Ykay IT Hub",
      examCode: "TRACK",
      validity: "Programme dependent",
      recognition: "Industry-aligned credential pathway",
      examFormat: "Practical + objective assessment",
      passingScore: "70%",
      logoText: "Digital",
    },
    relatedCourses: [
      {
        title: "Python Programming",
        href: "/it-education/python",
      },
      {
        title: "Digital Literacy",
        href: "/it-education/digital-literacy",
      },
      {
        title: "Microsoft Excel",
        href: "/it-education/microsoft-excel",
      },
    ],
  },
  "microsoft-word": {
    duration: "8 Weeks",
    difficulty: "Beginner to Intermediate",
    learningObjectives: [
      "Master Python syntax and fundamentals",
      "Work with lists, tuples, dictionaries and sets",
      "Implement object-oriented programming",
      "Handle files and exceptions",
      "Build simple apps and automations",
      "Prepare for certification practice tests",
    ],
    curriculum: [
      {
        week: "Week 1\u20132: Fundamentals",
        topics: [
          "Environment setup",
          "Variables and operators",
          "Control flow",
          "Functions",
          "I/O basics",
        ],
      },
      {
        week: "Week 3\u20134: Data structures",
        topics: [
          "Lists and tuples",
          "Dictionaries and sets",
          "Comprehensions",
          "Strings",
          "Error handling",
        ],
      },
      {
        week: "Week 5\u20136: OOP",
        topics: ["Classes and objects", "Inheritance", "Encapsulation", "Magic methods", "Files"],
      },
      {
        week: "Week 7\u20138: Projects",
        topics: ["SQLite basics", "Flask intro", "APIs", "Capstone project", "Exam prep"],
      },
    ],
    targetAudience: ["Beginners", "Secondary students", "Career switchers"],
    prerequisites: ["Basic computer literacy", "No prior coding required"],
    careerOutcomes: ["Python Developer", "Data Analyst", "Automation Engineer"],
    slug: "microsoft-word",
    title: "Microsoft Word Certification",
    shortTitle: "Word",
    certification: "Microsoft Office Specialist",
    category: "Office",
    heroTagline: "Build real skill in Microsoft Word",
    heroDescription: "A practical, project-driven pathway toward Microsoft Office Specialist.",
    heroImages: ["/home/hero-campus.jpg", "/microsoft-excel-hero.jpg"],
    overview:
      "This Microsoft Word track is designed for secondary students and external learners who want practical, certification-aligned skills. Lessons combine theory, labs, and portfolio tasks.",
    certificationDetails: {
      name: "Microsoft Office Specialist",
      provider: "Certiport / Ykay IT Hub",
      examCode: "TRACK",
      validity: "Programme dependent",
      recognition: "Industry-aligned credential pathway",
      examFormat: "Practical + objective assessment",
      passingScore: "70%",
      logoText: "Word",
    },
    relatedCourses: [
      {
        title: "Python Programming",
        href: "/it-education/python",
      },
      {
        title: "Digital Literacy",
        href: "/it-education/digital-literacy",
      },
      {
        title: "Microsoft Excel",
        href: "/it-education/microsoft-excel",
      },
    ],
  },
  "microsoft-excel": {
    duration: "8 Weeks",
    difficulty: "Beginner to Intermediate",
    learningObjectives: [
      "Master Python syntax and fundamentals",
      "Work with lists, tuples, dictionaries and sets",
      "Implement object-oriented programming",
      "Handle files and exceptions",
      "Build simple apps and automations",
      "Prepare for certification practice tests",
    ],
    curriculum: [
      {
        week: "Week 1\u20132: Fundamentals",
        topics: [
          "Environment setup",
          "Variables and operators",
          "Control flow",
          "Functions",
          "I/O basics",
        ],
      },
      {
        week: "Week 3\u20134: Data structures",
        topics: [
          "Lists and tuples",
          "Dictionaries and sets",
          "Comprehensions",
          "Strings",
          "Error handling",
        ],
      },
      {
        week: "Week 5\u20136: OOP",
        topics: ["Classes and objects", "Inheritance", "Encapsulation", "Magic methods", "Files"],
      },
      {
        week: "Week 7\u20138: Projects",
        topics: ["SQLite basics", "Flask intro", "APIs", "Capstone project", "Exam prep"],
      },
    ],
    targetAudience: ["Beginners", "Secondary students", "Career switchers"],
    prerequisites: ["Basic computer literacy", "No prior coding required"],
    careerOutcomes: ["Python Developer", "Data Analyst", "Automation Engineer"],
    slug: "microsoft-excel",
    title: "Microsoft Excel Certification",
    shortTitle: "Excel",
    certification: "Microsoft Office Specialist",
    category: "Office",
    heroTagline: "Build real skill in Microsoft Excel",
    heroDescription: "A practical, project-driven pathway toward Microsoft Office Specialist.",
    heroImages: ["/microsoft-excel-hero.jpg", "/excel-expert-hero.jpg"],
    overview:
      "This Microsoft Excel track is designed for secondary students and external learners who want practical, certification-aligned skills. Lessons combine theory, labs, and portfolio tasks.",
    certificationDetails: {
      name: "Microsoft Office Specialist",
      provider: "Certiport / Ykay IT Hub",
      examCode: "TRACK",
      validity: "Programme dependent",
      recognition: "Industry-aligned credential pathway",
      examFormat: "Practical + objective assessment",
      passingScore: "70%",
      logoText: "Excel",
    },
    relatedCourses: [
      {
        title: "Python Programming",
        href: "/it-education/python",
      },
      {
        title: "Digital Literacy",
        href: "/it-education/digital-literacy",
      },
      {
        title: "Microsoft Excel",
        href: "/it-education/microsoft-excel",
      },
    ],
  },
  "microsoft-powerpoint": {
    duration: "8 Weeks",
    difficulty: "Beginner to Intermediate",
    learningObjectives: [
      "Master Python syntax and fundamentals",
      "Work with lists, tuples, dictionaries and sets",
      "Implement object-oriented programming",
      "Handle files and exceptions",
      "Build simple apps and automations",
      "Prepare for certification practice tests",
    ],
    curriculum: [
      {
        week: "Week 1\u20132: Fundamentals",
        topics: [
          "Environment setup",
          "Variables and operators",
          "Control flow",
          "Functions",
          "I/O basics",
        ],
      },
      {
        week: "Week 3\u20134: Data structures",
        topics: [
          "Lists and tuples",
          "Dictionaries and sets",
          "Comprehensions",
          "Strings",
          "Error handling",
        ],
      },
      {
        week: "Week 5\u20136: OOP",
        topics: ["Classes and objects", "Inheritance", "Encapsulation", "Magic methods", "Files"],
      },
      {
        week: "Week 7\u20138: Projects",
        topics: ["SQLite basics", "Flask intro", "APIs", "Capstone project", "Exam prep"],
      },
    ],
    targetAudience: ["Beginners", "Secondary students", "Career switchers"],
    prerequisites: ["Basic computer literacy", "No prior coding required"],
    careerOutcomes: ["Python Developer", "Data Analyst", "Automation Engineer"],
    slug: "microsoft-powerpoint",
    title: "Microsoft PowerPoint Certification",
    shortTitle: "PowerPoint",
    certification: "Microsoft Office Specialist",
    category: "Office",
    heroTagline: "Build real skill in Microsoft PowerPoint",
    heroDescription: "A practical, project-driven pathway toward Microsoft Office Specialist.",
    heroImages: ["/it-hub-3.jpg", "/home/hero-campus.jpg"],
    overview:
      "This Microsoft PowerPoint track is designed for secondary students and external learners who want practical, certification-aligned skills. Lessons combine theory, labs, and portfolio tasks.",
    certificationDetails: {
      name: "Microsoft Office Specialist",
      provider: "Certiport / Ykay IT Hub",
      examCode: "TRACK",
      validity: "Programme dependent",
      recognition: "Industry-aligned credential pathway",
      examFormat: "Practical + objective assessment",
      passingScore: "70%",
      logoText: "PowerPoint",
    },
    relatedCourses: [
      {
        title: "Python Programming",
        href: "/it-education/python",
      },
      {
        title: "Digital Literacy",
        href: "/it-education/digital-literacy",
      },
      {
        title: "Microsoft Excel",
        href: "/it-education/microsoft-excel",
      },
    ],
  },
  "excel-expert": {
    duration: "8 Weeks",
    difficulty: "Beginner to Intermediate",
    learningObjectives: [
      "Master Python syntax and fundamentals",
      "Work with lists, tuples, dictionaries and sets",
      "Implement object-oriented programming",
      "Handle files and exceptions",
      "Build simple apps and automations",
      "Prepare for certification practice tests",
    ],
    curriculum: [
      {
        week: "Week 1\u20132: Fundamentals",
        topics: [
          "Environment setup",
          "Variables and operators",
          "Control flow",
          "Functions",
          "I/O basics",
        ],
      },
      {
        week: "Week 3\u20134: Data structures",
        topics: [
          "Lists and tuples",
          "Dictionaries and sets",
          "Comprehensions",
          "Strings",
          "Error handling",
        ],
      },
      {
        week: "Week 5\u20136: OOP",
        topics: ["Classes and objects", "Inheritance", "Encapsulation", "Magic methods", "Files"],
      },
      {
        week: "Week 7\u20138: Projects",
        topics: ["SQLite basics", "Flask intro", "APIs", "Capstone project", "Exam prep"],
      },
    ],
    targetAudience: ["Beginners", "Secondary students", "Career switchers"],
    prerequisites: ["Basic computer literacy", "No prior coding required"],
    careerOutcomes: ["Python Developer", "Data Analyst", "Automation Engineer"],
    slug: "excel-expert",
    title: "Excel Expert Certification",
    shortTitle: "Excel Expert",
    certification: "Microsoft Office Expert",
    category: "Office",
    heroTagline: "Build real skill in Excel Expert",
    heroDescription: "A practical, project-driven pathway toward Microsoft Office Expert.",
    heroImages: ["/excel-expert-hero.jpg", "/excel-expert-hero.jpg"],
    overview:
      "This Excel Expert track is designed for secondary students and external learners who want practical, certification-aligned skills. Lessons combine theory, labs, and portfolio tasks.",
    certificationDetails: {
      name: "Microsoft Office Expert",
      provider: "Certiport / Ykay IT Hub",
      examCode: "TRACK",
      validity: "Programme dependent",
      recognition: "Industry-aligned credential pathway",
      examFormat: "Practical + objective assessment",
      passingScore: "70%",
      logoText: "Excel Expert",
    },
    relatedCourses: [
      {
        title: "Python Programming",
        href: "/it-education/python",
      },
      {
        title: "Digital Literacy",
        href: "/it-education/digital-literacy",
      },
      {
        title: "Microsoft Excel",
        href: "/it-education/microsoft-excel",
      },
    ],
  },
};
