import { prisma } from "../lib/prisma";
import { logger } from "@/lib/logger";

type ModuleSeed = { title: string; summary: string; content: string; durationMinutes: number };
type CourseSeed = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  level: string;
  certification: string;
  durationWeeks: number;
  modules: ModuleSeed[];
};

const COURSES: CourseSeed[] = [
  {
    slug: "digital-literacy",
    title: "Digital Literacy",
    tagline: "Master the computer fundamentals every modern student needs.",
    description:
      "Build a rock-solid foundation in computing: hardware, operating systems, file management, internet safety, email etiquette, and responsible digital citizenship. Designed for JSS students and absolute beginners.",
    level: "Beginner",
    certification: "Ykay Digital Literacy Certificate",
    durationWeeks: 6,
    modules: [
      {
        title: "Understanding Computers",
        summary: "Hardware, software, and how computers think.",
        content:
          "In this module you will identify the main components of a computer system — CPU, memory, storage, input and output devices — and understand how hardware and software work together.\n\nPractical: label the parts of a desktop and laptop, and boot a computer safely.",
        durationMinutes: 45,
      },
      {
        title: "Operating Systems & Files",
        summary: "Windows navigation, folders, and file management.",
        content:
          "Learn to navigate Windows confidently: the desktop, taskbar, and settings. Create, rename, move, and organise folders. Understand file types and extensions.\n\nPractical: build an organised folder structure for your school subjects.",
        durationMinutes: 50,
      },
      {
        title: "The Internet & Web Browsers",
        summary: "Searching effectively and evaluating information.",
        content:
          "Understand how the internet works, use browsers effectively, master search techniques, and learn to judge whether online information is trustworthy.\n\nPractical: research a school topic using three reliable sources.",
        durationMinutes: 45,
      },
      {
        title: "Email & Digital Communication",
        summary: "Professional email and online etiquette.",
        content:
          "Create and manage an email account, write clear professional messages, manage attachments, and practise respectful digital communication.\n\nPractical: compose and send a properly formatted email with an attachment.",
        durationMinutes: 40,
      },
      {
        title: "Online Safety & Digital Citizenship",
        summary: "Passwords, privacy, and staying safe online.",
        content:
          "Learn password hygiene, recognise phishing and scams, protect personal information, and understand cyberbullying and your digital footprint.\n\nPractical: audit and strengthen your own account security.",
        durationMinutes: 45,
      },
    ],
  },
  {
    slug: "microsoft-word",
    title: "Microsoft Word",
    tagline: "Produce professional documents, reports, and letters.",
    description:
      "From first click to polished documents: formatting, styles, tables, images, mail merge, and collaborative editing — aligned with Microsoft Office Specialist (MOS) Word objectives.",
    level: "Beginner",
    certification: "MOS Word preparation track",
    durationWeeks: 6,
    modules: [
      {
        title: "Word Interface & First Documents",
        summary: "Ribbon, saving, and basic text editing.",
        content:
          "Tour the Word interface, create and save documents, and master text selection, editing, and undo/redo.\n\nPractical: type and save a one-page letter.",
        durationMinutes: 40,
      },
      {
        title: "Formatting Like a Professional",
        summary: "Fonts, paragraphs, styles, and themes.",
        content:
          "Apply font and paragraph formatting, use styles for consistent documents, and work with themes, bullets, and numbering.\n\nPractical: format a school report with headings and styles.",
        durationMinutes: 50,
      },
      {
        title: "Tables, Images & Page Layout",
        summary: "Rich content and print-ready layouts.",
        content:
          "Insert and style tables, position images correctly, control margins, orientation, headers, footers, and page numbers.\n\nPractical: design a class timetable document.",
        durationMinutes: 50,
      },
      {
        title: "Long Documents & References",
        summary: "Table of contents, citations, and sections.",
        content:
          "Handle multi-page documents: automatic table of contents, footnotes, citations, and section breaks.\n\nPractical: build a structured mini-project report.",
        durationMinutes: 55,
      },
      {
        title: "Mail Merge & Collaboration",
        summary: "Bulk letters and working with others.",
        content:
          "Use mail merge for personalised letters, add comments, track changes, and prepare documents for sharing.\n\nPractical: mail-merge invitation letters for a school event.",
        durationMinutes: 45,
      },
    ],
  },
  {
    slug: "microsoft-powerpoint",
    title: "Microsoft PowerPoint",
    tagline: "Design presentations that captivate any audience.",
    description:
      "Slide design principles, animations, multimedia, and confident delivery — aligned with Microsoft Office Specialist (MOS) PowerPoint objectives.",
    level: "Beginner",
    certification: "MOS PowerPoint preparation track",
    durationWeeks: 5,
    modules: [
      {
        title: "PowerPoint Essentials",
        summary: "Slides, layouts, and your first deck.",
        content:
          "Understand slides, layouts, and placeholders. Create, arrange, and duplicate slides, and choose effective templates.\n\nPractical: create a 5-slide 'About Me' presentation.",
        durationMinutes: 40,
      },
      {
        title: "Design Principles",
        summary: "Colour, contrast, fonts, and visual hierarchy.",
        content:
          "Learn what makes slides readable and memorable: contrast, alignment, whitespace, and consistent design. Avoid common mistakes like text overload.\n\nPractical: redesign a cluttered slide.",
        durationMinutes: 45,
      },
      {
        title: "Images, Charts & Media",
        summary: "Visual storytelling with pictures and data.",
        content:
          "Insert and edit images, icons, SmartArt, charts, audio, and video. Compress media for sharing.\n\nPractical: build a data slide with a chart.",
        durationMinutes: 50,
      },
      {
        title: "Animations & Transitions",
        summary: "Motion that supports the message.",
        content:
          "Apply entrance, emphasis, and exit animations, sequence them with the Animation Pane, and use transitions tastefully.\n\nPractical: animate a process diagram.",
        durationMinutes: 45,
      },
      {
        title: "Presenting with Confidence",
        summary: "Presenter view, rehearsal, and delivery.",
        content:
          "Use Presenter View, speaker notes, and rehearse timings. Learn delivery techniques for classroom and competition presentations.\n\nPractical: deliver a 3-minute presentation.",
        durationMinutes: 45,
      },
    ],
  },
  {
    slug: "microsoft-excel",
    title: "Microsoft Excel",
    tagline: "Organise, calculate, and visualise data with confidence.",
    description:
      "Spreadsheets from scratch: formulas, functions, formatting, charts, and printing — the essential data skill for school and every future career.",
    level: "Beginner",
    certification: "MOS Excel Associate preparation track",
    durationWeeks: 6,
    modules: [
      {
        title: "Excel Fundamentals",
        summary: "Workbooks, cells, and data entry.",
        content:
          "Navigate worksheets, enter and edit data, use AutoFill, and manage rows, columns, and sheets.\n\nPractical: build a class register worksheet.",
        durationMinutes: 45,
      },
      {
        title: "Formulas & Basic Functions",
        summary: "SUM, AVERAGE, MIN, MAX, COUNT.",
        content:
          "Write formulas with cell references, understand relative vs absolute references, and use core functions.\n\nPractical: compute subject totals and averages.",
        durationMinutes: 55,
      },
      {
        title: "Formatting & Conditional Formatting",
        summary: "Readable, professional spreadsheets.",
        content:
          "Apply number formats, styles, and themes. Use conditional formatting to highlight top scores and missing data.\n\nPractical: format a results sheet with pass/fail highlighting.",
        durationMinutes: 45,
      },
      {
        title: "Charts & Data Visualisation",
        summary: "Turn numbers into insight.",
        content:
          "Create column, line, and pie charts. Choose the right chart type and style it for clarity.\n\nPractical: chart attendance trends over a term.",
        durationMinutes: 50,
      },
      {
        title: "Sorting, Filtering & Printing",
        summary: "Manage larger datasets and share them.",
        content:
          "Sort and filter tables, freeze panes, set print areas, and prepare professional printouts.\n\nPractical: prepare a printable class performance summary.",
        durationMinutes: 45,
      },
    ],
  },
  {
    slug: "excel-expert",
    title: "Excel Expert",
    tagline: "Advanced analytics: lookups, pivot tables, and dashboards.",
    description:
      "Go beyond the basics: logical and lookup functions, data validation, PivotTables, and interactive dashboards — aligned with MOS Excel Expert objectives.",
    level: "Advanced",
    certification: "MOS Excel Expert preparation track",
    durationWeeks: 8,
    modules: [
      {
        title: "Logical & Lookup Functions",
        summary: "IF, nested IF, VLOOKUP, XLOOKUP.",
        content:
          "Master decision-making formulas and look up data across tables with VLOOKUP, INDEX/MATCH, and XLOOKUP.\n\nPractical: build an automatic grade-assignment sheet.",
        durationMinutes: 60,
      },
      {
        title: "Data Validation & Protection",
        summary: "Clean input and protected workbooks.",
        content:
          "Create dropdown lists, validation rules, and input messages. Protect sheets and workbooks from accidental edits.\n\nPractical: build a validated data-entry form.",
        durationMinutes: 50,
      },
      {
        title: "PivotTables & PivotCharts",
        summary: "Summarise thousands of rows in seconds.",
        content:
          "Create PivotTables, group data, add slicers, and build PivotCharts for interactive analysis.\n\nPractical: analyse a school fee-payment dataset.",
        durationMinutes: 60,
      },
      {
        title: "Advanced Functions & Text Tools",
        summary: "SUMIFS, COUNTIFS, TEXT functions.",
        content:
          "Use conditional aggregation, date/time functions, and text manipulation (LEFT, MID, TEXTJOIN) to clean and analyse data.\n\nPractical: clean a messy student-record export.",
        durationMinutes: 55,
      },
      {
        title: "Dashboards & What-If Analysis",
        summary: "Interactive reports and goal seek.",
        content:
          "Combine charts, slicers, and formulas into a one-page dashboard. Use Goal Seek and scenarios for planning.\n\nPractical: build a school-performance dashboard.",
        durationMinutes: 60,
      },
    ],
  },
  {
    slug: "python",
    title: "Python Programming",
    tagline: "Learn the world's most popular programming language.",
    description:
      "From your first line of code to real projects: variables, logic, loops, functions, and problem-solving with Python — the language behind AI, data science, and modern software.",
    level: "Intermediate",
    certification: "PCEP — Certified Entry-Level Python Programmer track",
    durationWeeks: 10,
    modules: [
      {
        title: "Hello, Python!",
        summary: "Setup, print, variables, and data types.",
        content:
          "Install Python, run your first program, and work with variables, numbers, strings, and input/output.\n\nPractical: write a program that greets a user and does simple arithmetic.",
        durationMinutes: 50,
      },
      {
        title: "Making Decisions",
        summary: "Booleans, comparisons, and if/elif/else.",
        content:
          "Control program flow with conditions and logical operators.\n\nPractical: build a grade-classification program using WAEC boundaries.",
        durationMinutes: 55,
      },
      {
        title: "Loops & Repetition",
        summary: "for, while, and iteration patterns.",
        content:
          "Automate repetitive work with loops, ranges, and loop control (break/continue).\n\nPractical: generate multiplication tables and simple patterns.",
        durationMinutes: 55,
      },
      {
        title: "Lists, Dictionaries & Strings",
        summary: "Store and organise collections of data.",
        content:
          "Work with lists, tuples, dictionaries, and string methods to manage real data.\n\nPractical: build a simple class-register program.",
        durationMinutes: 60,
      },
      {
        title: "Functions & Modules",
        summary: "Reusable, organised code.",
        content:
          "Define functions with parameters and return values, and organise code into modules.\n\nPractical: refactor earlier projects into functions.",
        durationMinutes: 55,
      },
      {
        title: "Mini Project: Quiz App",
        summary: "Bring it all together.",
        content:
          "Design and build a console quiz application with scoring — applying variables, conditions, loops, collections, and functions.\n\nPractical: present your working quiz app.",
        durationMinutes: 70,
      },
    ],
  },
  {
    slug: "cybersecurity",
    title: "Cybersecurity",
    tagline: "Defend systems, data, and people in a digital world.",
    description:
      "Threats, defences, and ethical practice: malware, phishing, passwords and encryption, safe networking, and careers in security.",
    level: "Intermediate",
    certification: "Ykay Cyber Defender Certificate",
    durationWeeks: 8,
    modules: [
      {
        title: "The Threat Landscape",
        summary: "Who attacks, why, and how.",
        content:
          "Understand hackers, malware families (viruses, worms, ransomware), and real-world attack case studies.\n\nPractical: analyse a famous cyber incident.",
        durationMinutes: 50,
      },
      {
        title: "Social Engineering & Phishing",
        summary: "The human side of hacking.",
        content:
          "Recognise phishing emails, vishing calls, and manipulation tactics. Learn verification habits that defeat them.\n\nPractical: spot the phish — analyse sample emails.",
        durationMinutes: 45,
      },
      {
        title: "Passwords & Encryption Basics",
        summary: "Protecting accounts and data.",
        content:
          "Password strength, managers, and multi-factor authentication. An intuitive introduction to encryption and hashing.\n\nPractical: set up MFA and evaluate password strength.",
        durationMinutes: 50,
      },
      {
        title: "Safe Networks & Devices",
        summary: "Wi-Fi, updates, and device hygiene.",
        content:
          "Secure home and school networks, understand HTTPS, keep systems patched, and manage app permissions.\n\nPractical: run a security checklist on a device.",
        durationMinutes: 50,
      },
      {
        title: "Ethics & Cyber Careers",
        summary: "White hats, laws, and your future.",
        content:
          "Ethical hacking, Nigeria's cybercrime laws, responsible disclosure, and career paths from SOC analyst to penetration tester.\n\nPractical: map your personal cyber-career roadmap.",
        durationMinutes: 45,
      },
    ],
  },
  {
    slug: "ai",
    title: "Artificial Intelligence",
    tagline: "Understand and apply the technology reshaping the world.",
    description:
      "What AI really is, how machine learning works, hands-on experiments with AI tools, prompt engineering, and the ethics of intelligent systems.",
    level: "Intermediate",
    certification: "Ykay AI Foundations Certificate",
    durationWeeks: 8,
    modules: [
      {
        title: "What Is AI?",
        summary: "History, types, and everyday AI.",
        content:
          "Trace AI from Turing to today. Distinguish narrow vs general AI and identify AI you already use daily.\n\nPractical: catalogue AI systems in your daily life.",
        durationMinutes: 45,
      },
      {
        title: "How Machines Learn",
        summary: "Data, training, and models — intuitively.",
        content:
          "Understand supervised and unsupervised learning, training data, and why data quality matters — no heavy math required.\n\nPractical: train a simple image classifier with a no-code tool.",
        durationMinutes: 55,
      },
      {
        title: "Generative AI & Prompting",
        summary: "LLMs, chatbots, and prompt engineering.",
        content:
          "How large language models work at a high level, and how to write effective prompts for study and creativity — responsibly.\n\nPractical: craft prompts for a research task and compare outputs.",
        durationMinutes: 50,
      },
      {
        title: "AI Ethics & Society",
        summary: "Bias, privacy, jobs, and truth.",
        content:
          "Examine algorithmic bias, deepfakes, privacy, and AI's impact on work. Build habits for responsible AI use in school.\n\nPractical: debate an AI-ethics scenario.",
        durationMinutes: 45,
      },
      {
        title: "AI Project Studio",
        summary: "Build something intelligent.",
        content:
          "Plan and build a mini AI-powered project — a chatbot flow, classifier, or AI-assisted presentation — and demo it.\n\nPractical: present your AI project.",
        durationMinutes: 65,
      },
    ],
  },
];

async function main() {
  for (let index = 0; index < COURSES.length; index += 1) {
    const seed = COURSES[index];
    const course = await prisma.itCourse.upsert({
      where: { slug: seed.slug },
      update: {
        title: seed.title,
        tagline: seed.tagline,
        description: seed.description,
        level: seed.level,
        certification: seed.certification,
        durationWeeks: seed.durationWeeks,
        sortOrder: index + 1,
        isActive: true,
      },
      create: {
        slug: seed.slug,
        title: seed.title,
        tagline: seed.tagline,
        description: seed.description,
        level: seed.level,
        certification: seed.certification,
        durationWeeks: seed.durationWeeks,
        sortOrder: index + 1,
      },
    });

    const existingModules = await prisma.itModule.findMany({
      where: { courseId: course.id },
      select: { id: true, title: true },
    });
    const existingByTitle = new Map(existingModules.map((module) => [module.title, module.id]));

    for (let moduleIndex = 0; moduleIndex < seed.modules.length; moduleIndex += 1) {
      const moduleSeed = seed.modules[moduleIndex];
      const existingId = existingByTitle.get(moduleSeed.title);
      if (existingId) {
        await prisma.itModule.update({
          where: { id: existingId },
          data: {
            summary: moduleSeed.summary,
            content: moduleSeed.content,
            durationMinutes: moduleSeed.durationMinutes,
            sortOrder: moduleIndex + 1,
          },
        });
      } else {
        await prisma.itModule.create({
          data: {
            courseId: course.id,
            title: moduleSeed.title,
            summary: moduleSeed.summary,
            content: moduleSeed.content,
            durationMinutes: moduleSeed.durationMinutes,
            sortOrder: moduleIndex + 1,
          },
        });
      }
    }

    console.log(`Course ready: ${seed.title} (${seed.modules.length} modules)`);
  }

  console.log("");
  console.log("IT course catalog seeded successfully.");
  console.log("Visit /it-portal/auth to sign up and /it-portal/dashboard to enroll.");
}

main()
  .catch((error) => {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
