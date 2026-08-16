import { FormEvent, useState } from "react";
import { BookOpen, Check, LockKeyhole } from "lucide-react";
import { trpc } from "../../lib/trpc";

export function CourseDeliveryPanel() {
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const courses = trpc.courseDelivery.publicList.useQuery(undefined, { retry: false });
  const createCourse = trpc.courseDelivery.create.useMutation({
    onSuccess: () => {
      setTitle("");
      void courses.refetch();
    },
  });
  const enroll = trpc.courseDelivery.enroll.useMutation();

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    createCourse.mutate({
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title: title.trim(),
      status: "draft",
      currency: "CLP",
    });
  };

  return (
    <section className="module-demo-section" id="course-delivery-module">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PILOT EXTENSION / COURSE DELIVERY</p>
          <h2>Cursos online en preparación.</h2>
        </div>
        <p>La extensión administra cursos, lecciones, matrículas y progreso. El checkout y el acceso protegido se habilitan después de completar Pedidos y Pagos.</p>
      </div>
      <div className="base-modules-grid">
        <div className="module-card">
          <div className="module-card-icon"><BookOpen size={18} /></div>
          <div className="module-card-topline"><span>COURSE DELIVERY</span><span className="module-status">STAGING</span></div>
          <h3>{courses.data?.[0]?.title ?? "Aún no hay cursos publicados"}</h3>
          <p>{courses.data?.[0]?.description ?? "Prepara el primer curso de Natalia desde el backend de la plataforma."}</p>
          <div className="module-card-meta"><span><strong>{courses.data?.length ?? 0}</strong> publicados</span><span><LockKeyhole size={14} /> acceso protegido pendiente</span></div>
        </div>
        <form className="module-card module-form" onSubmit={handleCreate}>
          <div className="module-card-topline"><span>ADMIN PREVIEW</span><span>MANUAL REVIEW</span></div>
          <h3>Crear curso de prueba</h3>
          <label>Título<input value={title} onChange={(eventInput) => setTitle(eventInput.target.value)} placeholder="Curso de automaquillaje" /></label>
          <label>Email de alumno para smoke<input type="email" value={email} onChange={(eventInput) => setEmail(eventInput.target.value)} placeholder="alumna@email.com" /></label>
          <button type="submit" disabled={!title.trim() || createCourse.isPending}>{createCourse.isPending ? "Guardando…" : "Guardar borrador"}</button>
          {courses.error ? <p className="form-error">{courses.error.message}</p> : null}
          {createCourse.error ? <p className="form-error">{createCourse.error.message}</p> : null}
          {enroll.data ? <p className="form-success"><Check size={15} /> Matrícula creada.</p> : null}
          {courses.data?.[0] && email ? (
            <button type="button" onClick={() => enroll.mutate({ courseId: courses.data[0].id, learnerEmail: email })} disabled={enroll.isPending}>
              {enroll.isPending ? "Creando matrícula…" : "Probar matrícula"}
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
}
