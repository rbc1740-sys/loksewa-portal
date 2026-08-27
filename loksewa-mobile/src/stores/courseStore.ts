/**
 * Course Store — Zustand
 *
 * Manages the active course. Changing the active course is the single
 * entry-point that re-aligns every dependent area (Home, Subjects,
 * Practice, Exams, Progress, Analytics, etc.).
 *
 * Persisted via AsyncStorage so the active course survives app restart.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeWithSelector } from 'zustand/middleware';
import { CatalogCourse, COURSES, DEFAULT_COURSE_ID } from '../constants/courses';
import {
  ensureCoursesSeeded as dbEnsureCoursesSeeded,
  setActiveCourse as dbSetActiveCourse,
  getActiveCourse as dbGetActiveCourse,
  enrollInCourse,
  getEnrolledCourses,
  getActiveEnrollment,
  setActiveEnrollment,
  CourseEnrollment,
} from '../services/database';
import { useAuthStore } from './authStore';

/**
 * Device-scoped fallback used before sign-in. Once the user authenticates,
 * their firebase uid keeps course data isolated per account.
 */
const currentUserId = (): string => useAuthStore.getState().user?.uid ?? 'device-user';


interface CourseState {
  activeCourseId: string | null;
  courses: CatalogCourse[];
  enrolledCourseIds: string[];
  hydrated: boolean;

  // actions
  hydrate: () => Promise<void>;
  setCourse: (courseId: string) => Promise<void>;
  loadCourses: () => Promise<CatalogCourse[]>;
  loadEnrollments: () => Promise<void>;
  enroll: (courseId: string) => Promise<void>;
  getEnrolledCourses: () => CatalogCourse[];
}

const STORAGE_KEY = 'loksewa:activeCourse';

export const useCourseStore = create<CourseState>()(
  subscribeWithSelector((set, get) => ({
    activeCourseId: null,
    courses: COURSES,
    enrolledCourseIds: [],
    hydrated: false,

    hydrate: async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const defaultId = DEFAULT_COURSE_ID;
      const activeId = saved ?? defaultId;

      // Make sure DB catalog rows exist.
      try {
        await dbEnsureCoursesSeeded();
      } catch (e) {
        console.warn('[CourseStore] DB seeding skipped', e);
      }

      // Load enrollments from DB
      try {
        await get().loadEnrollments();
      } catch (e) {
        console.warn('[CourseStore] Could not load enrollments', e);
      }

      // Record this as the active course in the DB too (for sync).
      try {
        await dbSetActiveCourse(currentUserId(), activeId);
      } catch (e) {
        console.warn('[CourseStore] Could not persist active course', e);
      }

      set({ activeCourseId: activeId, hydrated: true });
    },

    loadEnrollments: async () => {
      const userId = currentUserId();
      const enrollments = await getEnrolledCourses(userId);
      const enrolledIds = enrollments.map(e => e.course_id);
      set({ enrolledCourseIds: enrolledIds });
    },

    enroll: async (courseId: string) => {
      const userId = currentUserId();
      await enrollInCourse(userId, courseId);
      await get().loadEnrollments();
    },

    setCourse: async (courseId: string) => {
      await AsyncStorage.setItem(STORAGE_KEY, courseId);
      const userId = currentUserId();
      await dbSetActiveCourse(userId, courseId);
      await setActiveEnrollment(userId, courseId);
      set({ activeCourseId: courseId });
    },


    loadCourses: async () => {
      try {
        await dbEnsureCoursesSeeded();
      } catch (e) {
        console.warn('[CourseStore] DB seeding skipped', e);
      }
      set({ courses: COURSES });
      return COURSES;
    },

    getEnrolledCourses: () => {
      const { courses, enrolledCourseIds } = get();
      return courses.filter(c => enrolledCourseIds.includes(c.id));
    },
  }))
);
