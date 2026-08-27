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
  { id: 'ce_structural', name: 'Structural Engineering', kind: 'ce_technical', count: 174 },
  { id: 'ce_concrete', name: 'Concrete Technology', kind: 'ce_technical', count: 402 },
  { id: 'ce_geotechnical', name: 'Geotechnical Engineering', kind: 'ce_technical', count: 250 },
  { id: 'ce_surveying', name: 'Surveying Engineering', kind: 'ce_technical', count: 453 },
  { id: 'ce_construction_materials', name: 'Construction Materials', kind: 'ce_technical', count: 441 },
  { id: 'ce_construction_mgmt', name: 'Construction Management', kind: 'ce_technical', count: 300 },
  { id: 'ce_estimation', name: 'Estimation', kind: 'ce_technical', count: 249 },
  { id: 'ce_engineering_drawing', name: 'Engineering Drawing', kind: 'ce_technical', count: 180 },
  { id: 'ce_engineering_economics', name: 'Engineering Economics', kind: 'ce_technical', count: 127 },
  { id: 'ce_eng_professional_practice', name: 'Engineering Professional Practice', kind: 'ce_technical', count: 108 },
  // ---- General Knowledge & Administration ----
  { id: 'gk_civil_service', name: 'Civil Service Act & Regulation', kind: 'ce_gk', count: 68 },
  { id: 'gk_constitution', name: 'Constitution of Nepal(Part1-5)', kind: 'ce_gk', count: 69 },
  { id: 'gk_current_affairs', name: 'Current Affairs', kind: 'ce_gk', count: 270 },
  { id: 'gk_periodical_plan', name: 'Current Periodical Plan of Nepal', kind: 'ce_gk', count: 75 },
  { id: 'gk_economic_aspects', name: 'Economic Aspects of Nepal', kind: 'ce_gk', count: 165 },
  { id: 'gk_functional_scope', name: 'Functional Scope of Public Services', kind: 'ce_gk', count: 43 },
  { id: 'gk_management', name: 'Fundamentals of Management', kind: 'ce_gk', count: 130 },
  { id: 'gk_geo_diversity', name: 'Geographical Diversity, Climatic Condition & Cultures', kind: 'ce_gk', count: 144 },
  { id: 'gk_geography', name: 'Geography of Nepal', kind: 'ce_gk', count: 220 },
  { id: 'gk_governance', name: 'Governance System & Government', kind: 'ce_gk', count: 79 },
  { id: 'gk_budgeting', name: 'Government Budgeting and Accounting', kind: 'ce_gk', count: 100 },
  { id: 'gk_natural_resources', name: 'Major Natural Resources', kind: 'ce_gk', count: 85 },
  { id: 'gk_modern_history', name: 'Modern History of Nepal', kind: 'ce_gk', count: 121 },
  { id: 'gk_public_policy', name: 'Public Policy', kind: 'ce_gk', count: 55 },
  { id: 'gk_public_service_charter', name: 'Public Service Charter', kind: 'ce_gk', count: 57 },
  { id: 'gk_sustainable_dev', name: 'Sustainable Development, Science and Technology', kind: 'ce_gk', count: 137 },
  { id: 'gk_uno_saarc', name: 'UNO, SAARC & BIMSTEC', kind: 'ce_gk', count: 183 },
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


