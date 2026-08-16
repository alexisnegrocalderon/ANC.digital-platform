import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { courseEnrollments, courseLessons, courses } from "../drizzle/schema";
import { requireDb } from "../server/db";
import { addLesson, createCourse, enrollLearner, listLessons, updateProgress } from "../modules/course-delivery/service";

async function main() {
  const db = requireDb();
  const businessId = Number(process.env.SMOKE_BUSINESS_ID ?? 1);
  const token = `course-smoke-${Date.now()}`;
  let courseId: number | undefined;
  let lessonId: number | undefined;
  let enrollmentId: number | undefined;
  try {
    const course = await createCourse(db, businessId, {
      slug: token,
      title: "Curso smoke Natalia",
      description: "Contenido de prueba",
      priceCents: 49000,
      status: "published",
    });
    courseId = course.id;
    const lesson = await addLesson(db, businessId, {
      courseId: course.id,
      title: "Lección 1",
      position: 1,
      contentType: "video",
      preview: true,
      status: "published",
    });
    lessonId = lesson.id;
    const enrollment = await enrollLearner(db, businessId, {
      courseId: course.id,
      learnerEmail: `${token}@example.test`,
      learnerName: "Learner Smoke",
    });
    enrollmentId = enrollment.id;
    const lessons = await listLessons(db, businessId, course.id);
    const completed = await updateProgress(db, businessId, enrollment.id, 100);
    if (lessons.length !== 1 || completed?.status !== "completed" || completed.progressPct !== 100) {
      throw new Error("Course delivery smoke assertion failed");
    }
    console.log(JSON.stringify({ ok: true, courseId, lessonId, enrollmentId, lessonCount: lessons.length, progressPct: completed.progressPct }, null, 2));
  } finally {
    if (enrollmentId) await db.delete(courseEnrollments).where(and(eq(courseEnrollments.id, enrollmentId), eq(courseEnrollments.businessId, businessId)));
    if (lessonId) await db.delete(courseLessons).where(and(eq(courseLessons.id, lessonId), eq(courseLessons.businessId, businessId)));
    if (courseId) await db.delete(courses).where(and(eq(courses.id, courseId), eq(courses.businessId, businessId)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
