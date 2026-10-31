// One degree program, everything the planner needs to know about it in one place. To support another program or a
// newer SPO, write another definition like this one (rules from the module handbook, the Stammmodul list, the areas
// of specialization, the term the catalog is scraped for) and point PROGRAM at it; the scraper's SPO and program
// page (scraper/kit_scraper/models.py) must name the same program.

export interface ProgramRules {
  total: number
  thesis: number
  areaMin: number
  areaLectureMin: number
  /** Areas with a smaller lecture minimum. */
  areaLectureMinReduced: Record<string, number>
  areasMax: number
  stamm: number
  seminarMin: number
  practicalMin: number
  spMin: number
  spMax: number
  electiveMin: number
  electiveMax: number
  minorMin: number
  minorMax: number
  iqMin: number
  iqMax: number
  /** A typical full term. */
  semesterTarget: number
}

export interface ProgramDefinition {
  id: string
  name: string
  spo: string
  /** Version of the module handbook the rules were read from. */
  handbookAsOf: string
  rules: ProgramRules
  /** Stammmodule by id, and by title in case a module gets a new id. */
  stammIds: string[]
  stammTitles: string[]
  areas: string[]
  /** The term the catalog data is scraped for, and the terms a new plan starts with. */
  currentTerm: string
  defaultTerms: string[]
}

/** Computer Science M.Sc., SPO 88-979-H-2025 (module handbook of 09/09/2026, WS 26/27, §1.3, §2, §3; Figure 2). */
export const CS_MSC_2025: ProgramDefinition = {
  id: 'cs-msc-2025',
  name: 'Computer Science M.Sc.',
  spo: '88-979-H-2025',
  handbookAsOf: '2026-09-09',
  rules: {
    total: 120, thesis: 30, areaMin: 15, areaLectureMin: 10, areaLectureMinReduced: { Telematics: 8 }, areasMax: 73, stamm: 4,
    seminarMin: 3, practicalMin: 6, spMin: 12, spMax: 18, electiveMin: 6, electiveMax: 49, minorMin: 9, minorMax: 18,
    iqMin: 2, iqMax: 6, semesterTarget: 30,
  },
  stammIds: [
    'M-INFO-107201', 'M-INFO-100818', 'M-INFO-100856', 'M-INFO-100799', 'M-INFO-107166', 'M-INFO-106998',
    'M-INFO-107169', 'M-INFO-107676', 'M-INFO-107162', 'M-INFO-107235', 'M-INFO-107243',
  ],
  stammTitles: [
    'Algorithms II', 'Computer Architecture', 'Computer Graphics', 'Formal Systems', 'Human Computer Interaction', 'IT Security',
    'Machine Learning - Foundations and Algorithms', 'Multimodal Artificial Intelligence', 'Robotics I - Introduction to Robotics',
    'Software Engineering II', 'Telematics',
  ],
  areas: [
    'Algorithm Engineering', 'Cryptography and Security', 'Data Science', 'Design of Embedded Systems and Computer Architectures',
    'Human-centred Machine Intelligence', 'Robotics and Automation', 'Software Engineering and Compiler Construction',
    'Telematics', 'Theoretical Foundations',
  ],
  currentTerm: 'WS26',
  defaultTerms: ['WS26', 'SS27', 'WS27', 'SS28'],
}

export const PROGRAM: ProgramDefinition = CS_MSC_2025
