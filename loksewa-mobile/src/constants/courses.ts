/**
 * Static Course Catalog for Loksewa Prep Pro
 *
 * Defines the hierarchy: Course → Subject → Chapter → Topic.
 * The single CHAPTER_DEFS table drives BOTH:
 *   (a) TOPIC_TO_CHAPTER — maps bundled question `topic` values to chapters
 *   (b) COURSES          — the seeded catalog written to SQLite on first launch
 *
 * One table means the mapping and the catalog can never disagree.
 */

export interface CatalogTopic {
  name: string;
  questionCount: number;
}

export interface CatalogChapter {
  id: string;
  name: string;
  description?: string;
  topics: CatalogTopic[];
}

export interface CatalogSubject {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  chapters: CatalogChapter[];
}

export interface CatalogCourse {
  id: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  subjects: CatalogSubject[];
}

type SubjectKind = 'ce_technical' | 'ce_gk';

interface ChapterDef {
  id: string;
  name: string;
  kind: SubjectKind;
  count: number; // questions currently bundled for this topic
}


const CHAPTER_DEFS: ChapterDef[] = [
  // ---- Civil Engineering (technical) ----
  { id: 'ce_structural', name: 'Structural Engineering', kind: 'ce_technical', count: 349 },
  { id: 'ce_concrete', name: 'Concrete Technology', kind: 'ce_technical', count: 402 },
  { id: 'ce_geotechnical', name: 'Geotechnical Engineering', kind: 'ce_technical', count: 551 },
  { id: 'ce_surveying', name: 'Surveying Engineering', kind: 'ce_technical', count: 976 },
  { id: 'ce_airport', name: 'Airport Engineering', kind: 'ce_technical', count: 100 },
  { id: 'ce_building_construction', name: 'Building Construction Technology', kind: 'ce_technical', count: 334 },
  { id: 'ce_highway', name: 'Highway Engineering', kind: 'ce_technical', count: 272 },
  { id: 'ce_hydraulics', name: 'Hydraulics', kind: 'ce_technical', count: 255 },
  { id: 'ce_irrigation', name: 'Irrigation Engineering', kind: 'ce_technical', count: 240 },
  { id: 'ce_mechanics', name: 'Mechanics of Materials & Structures', kind: 'ce_technical', count: 231 },
  { id: 'ce_water_supply', name: 'Water Supply & Sanitation Engineering', kind: 'ce_technical', count: 209 },
  { id: 'ce_construction_materials', name: 'Construction Materials', kind: 'ce_technical', count: 958 },
  { id: 'ce_construction_mgmt', name: 'Construction Management', kind: 'ce_technical', count: 447 },
  { id: 'ce_estimation', name: 'Estimation', kind: 'ce_technical', count: 431 },
  { id: 'ce_engineering_drawing', name: 'Engineering Drawing', kind: 'ce_technical', count: 290 },
  { id: 'ce_engineering_economics', name: 'Engineering Economics', kind: 'ce_technical', count: 219 },
  { id: 'ce_eng_professional_practice', name: 'Engineering Professional Practice', kind: 'ce_technical', count: 99 },
  // ---- General Knowledge & Administration ----
  { id: 'gk_civil_service', name: 'Civil Service Act & Regulation', kind: 'ce_gk', count: 80 },
  { id: 'gk_constitution', name: 'Constitution of Nepal(Part1-5)', kind: 'ce_gk', count: 69 },
  { id: 'gk_current_affairs', name: 'Current Affairs', kind: 'ce_gk', count: 274 },
  { id: 'gk_periodical_plan', name: 'Current Periodical Plan of Nepal', kind: 'ce_gk', count: 75 },
  { id: 'gk_economic_aspects', name: 'Economic Aspects of Nepal', kind: 'ce_gk', count: 171 },
  { id: 'gk_federal_affairs', name: 'Federal Affairs & General Administration', kind: 'ce_gk', count: 1 },
  { id: 'gk_functional_scope', name: 'Functional Scope of Public Services', kind: 'ce_gk', count: 42 },
  { id: 'gk_management', name: 'Fundamentals of Management', kind: 'ce_gk', count: 167 },
  { id: 'gk_general_info', name: 'General Information & Legislation', kind: 'ce_gk', count: 3 },
  { id: 'gk_geo_diversity', name: 'Geographical Diversity, Climatic Condition & Cultures', kind: 'ce_gk', count: 144 },
  { id: 'gk_geography', name: 'Geography of Nepal', kind: 'ce_gk', count: 224 },
  { id: 'gk_governance', name: 'Governance System & Government', kind: 'ce_gk', count: 82 },
  { id: 'gk_budgeting', name: 'Government Budgeting and Accounting', kind: 'ce_gk', count: 112 },
  { id: 'gk_human_rights', name: 'Human Rights, Good Governance & RTI', kind: 'ce_gk', count: 3 },
  { id: 'gk_human_values', name: 'Human Values & Civic Duties', kind: 'ce_gk', count: 0 },
  { id: 'gk_iq', name: 'IQ & Reasoning', kind: 'ce_gk', count: 75 },
  { id: 'gk_natural_resources', name: 'Major Natural Resources', kind: 'ce_gk', count: 85 },
  { id: 'gk_modern_history', name: 'Modern History of Nepal', kind: 'ce_gk', count: 121 },
  { id: 'gk_office_mgmt', name: 'Office Management', kind: 'ce_gk', count: 5 },
  { id: 'gk_public_health', name: 'Public Health, Disease & Nutrition', kind: 'ce_gk', count: 55 },
  { id: 'gk_public_policy', name: 'Public Policy', kind: 'ce_gk', count: 55 },
  { id: 'gk_public_service_charter', name: 'Public Service Charter', kind: 'ce_gk', count: 61 },
  { id: 'gk_sustainable_dev', name: 'Sustainable Development, Science and Technology', kind: 'ce_gk', count: 175 },
  { id: 'gk_uno_saarc', name: 'UNO, SAARC & BIMSTEC', kind: 'ce_gk', count: 222 },
];


/** topic string → owning subject/chapter ids */
export const TOPIC_TO_CHAPTER: Record<string, { subjectId: SubjectKind; chapterId: string }> =
  Object.fromEntries(
    CHAPTER_DEFS.map(c => [c.name, { subjectId: c.kind, chapterId: c.id }])
  );

function topicsFor(kind: SubjectKind): CatalogChapter[] {
  return CHAPTER_DEFS.filter(c => c.kind === kind).map(c => ({
    id: c.id,
    name: c.name,
    topics: [{ name: c.name, questionCount: c.count }],
  }));
}

export const COURSES: CatalogCourse[] = [
  {
    id: 'ce_7th',
    name: 'Civil Engineering 7th Level',
    code: 'CE-7',
    description: 'PSC Section Officer level preparation for Civil Engineers.',
    icon: 'HardHat',
    color: '#123258',
    subjects: [
      {
        id: 'ce_technical',
        name: 'Civil Engineering',
        description: 'Technical engineering papers',
        color: '#2563EB',
        icon: 'Calculator',
        chapters: topicsFor('ce_technical'),
      },
      {
        id: 'ce_gk',
        name: 'GK & Administration',
        description: 'General knowledge, governance and management',
        color: '#D97706',
        icon: 'BookOpen',
        chapters: topicsFor('ce_gk'),
      },
    ],
  },
];

export const DEFAULT_COURSE_ID = 'ce_7th';

/** Subject ids of the default (active) course — the fallback scope for custom
 *  exams that select no subject. Single source, never hardcoded elsewhere. */
export const DEFAULT_SUBJECT_IDS: string[] =
  COURSES[0]?.subjects.map(s => s.id) ?? [];

/** Number of chapters across all subjects — used by integrity tests/telemetry. */
export const CHAPTERS_TOTAL = CHAPTER_DEFS.length;

/** Look up the course that contains a given topic name. */
export function findTopicCourse(topicName: string): CatalogCourse | undefined {
  return COURSES.find(c =>
    c.subjects.some(s =>
      s.chapters.some(ch => ch.topics.some(t => t.name === topicName))
    )
  );
}

/** Full hierarchy path for a question's topic string, or null if unmapped. */
export function getTopicPath(topicName: string): {
  courseId: string;
  courseName: string;
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterName: string;
} | null {
  const mapped = TOPIC_TO_CHAPTER[topicName];
  if (!mapped) return null;

  for (const course of COURSES) {
    for (const subject of course.subjects) {
      if (subject.id !== mapped.subjectId) continue;
      for (const chapter of subject.chapters) {
        if (chapter.topics.some(t => t.name === topicName)) {
          return {
            courseId: course.id,
            courseName: course.name,
            subjectId: subject.id,
            subjectName: subject.name,
            chapterId: chapter.id,
            chapterName: chapter.name,
          };
        }
      }
    }
  }
  return null;
}


