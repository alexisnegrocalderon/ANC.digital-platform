import { and, asc, eq } from "drizzle-orm";
import { courseEnrollments, courseLessons, courses, customers } from "../../drizzle/schema";

type Database = any;

export type CourseInput = {
  slug: string;
  title: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  status?: "draft" | "published" | "archived";
  metadata?: Record<string, unknown>;
};

export type LessonInput = {
  courseId: number;
  title: string;
  position: number;
  contentType?: "video" | "text" | "download" | "live";
  contentUrl?: string;
  durationMinutes?: number;
  preview?: boolean;
  status?: "draft" | "published" | "archived";
  metadata?: Record<string, unknown>;
};

function cleanSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

export async function listPublishedCourses(db: Database, businessId: number) {
  return db.select().from(courses).where(and(eq(courses.businessId, businessId), eq(courses.status, "published"))).orderBy(asc(courses.title));
}

export async function listCoursesForAdmin(db: Database, businessId: number) {
  return db.select().from(courses).where(eq(courses.businessId, businessId)).orderBy(asc(courses.title));
}

export async function createCourse(db: Database, businessId: number, input: CourseInput) {
  const [course] = await db.insert(courses).values({
    businessId,
    slug: cleanSlug(input.slug || input.title),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    priceCents: input.priceCents ?? 0,
    currency: (input.currency ?? "CLP").toUpperCase(),
    status: input.status ?? "draft",
    metadata: input.metadata ?? {},
  }).returning();
  return course;
}

export async function addLesson(db: Database, businessId: number, input: LessonInput) {
  const [course] = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.id, input.courseId), eq(courses.businessId, businessId))).limit(1);
  if (!course) throw new Error("Course does not belong to this business.");
  const [lesson] = await db.insert(courseLessons).values({
    businessId,
    courseId: input.courseId,
    title: input.title.trim(),
    position: input.position,
    contentType: input.contentType ?? "video",
    contentUrl: input.contentUrl?.trim() || null,
    durationMinutes: input.durationMinutes ?? null,
    preview: input.preview ?? false,
    status: input.status ?? "draft",
    metadata: input.metadata ?? {},
  }).returning();
  return lesson;
}

export async function listLessons(db: Database, businessId: number, courseId: number) {
  return db.select().from(courseLessons).where(and(eq(courseLessons.businessId, businessId), eq(courseLessons.courseId, courseId))).orderBy(asc(courseLessons.position));
}

export async function enrollLearner(db: Database, businessId: number, input: { courseId: number; learnerEmail: string; learnerName?: string; customerId?: number }) {
  const [course] = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.id, input.courseId), eq(courses.businessId, businessId), eq(courses.status, "published"))).limit(1);
  if (!course) throw new Error("Course is not published for this business.");
  if (input.customerId) {
    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.businessId, businessId))).limit(1);
    if (!customer) throw new Error("Customer does not belong to this business.");
  }
  const [enrollment] = await db.insert(courseEnrollments).values({
    businessId,
    courseId: input.courseId,
    customerId: input.customerId ?? null,
    learnerEmail: input.learnerEmail.trim().toLowerCase(),
    learnerName: input.learnerName?.trim() || null,
    status: "active",
    progressPct: 0,
    metadata: {},
  }).returning();
  return enrollment;
}

export async function updateProgress(db: Database, businessId: number, enrollmentId: number, progressPct: number) {
  const normalized = Math.max(0, Math.min(100, Math.round(progressPct)));
  const [enrollment] = await db.update(courseEnrollments).set({
    progressPct: normalized,
    status: normalized >= 100 ? "completed" : "active",
    completedAt: normalized >= 100 ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(eq(courseEnrollments.id, enrollmentId), eq(courseEnrollments.businessId, businessId))).returning();
  return enrollment ?? null;
}
