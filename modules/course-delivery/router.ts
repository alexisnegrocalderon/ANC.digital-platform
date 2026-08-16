import { z } from "zod";
import { businessManagerProcedure, moduleEnabledProcedure, router } from "../../server/trpc";
import {
  addLesson,
  createCourse,
  enrollLearner,
  listCoursesForAdmin,
  listLessons,
  listPublishedCourses,
  updateProgress,
} from "./service";

const courseInput = z.object({
  slug: z.string().min(2).max(120),
  title: z.string().min(2).max(220),
  description: z.string().max(10000).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const courseDeliveryRouter = router({
  publicList: moduleEnabledProcedure("catalogue").query(({ ctx }) => listPublishedCourses(ctx.db, ctx.businessId)),
  adminList: businessManagerProcedure.query(({ ctx }) => listCoursesForAdmin(ctx.db, ctx.businessId)),
  create: businessManagerProcedure.input(courseInput).mutation(({ ctx, input }) => createCourse(ctx.db, ctx.businessId, input)),
  addLesson: businessManagerProcedure.input(z.object({
    courseId: z.number().int().positive(),
    title: z.string().min(1).max(220),
    position: z.number().int().min(0).max(10000),
    contentType: z.enum(["video", "text", "download", "live"]).optional(),
    contentUrl: z.string().url().optional(),
    durationMinutes: z.number().int().positive().max(10000).optional(),
    preview: z.boolean().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).mutation(({ ctx, input }) => addLesson(ctx.db, ctx.businessId, input)),
  lessons: moduleEnabledProcedure("catalogue").input(z.object({ courseId: z.number().int().positive() })).query(({ ctx, input }) => listLessons(ctx.db, ctx.businessId, input.courseId)),
  enroll: moduleEnabledProcedure("catalogue").input(z.object({ courseId: z.number().int().positive(), learnerEmail: z.string().email(), learnerName: z.string().max(180).optional(), customerId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => enrollLearner(ctx.db, ctx.businessId, input)),
  progress: moduleEnabledProcedure("catalogue").input(z.object({ enrollmentId: z.number().int().positive(), progressPct: z.number().min(0).max(100) })).mutation(({ ctx, input }) => updateProgress(ctx.db, ctx.businessId, input.enrollmentId, input.progressPct)),
});
