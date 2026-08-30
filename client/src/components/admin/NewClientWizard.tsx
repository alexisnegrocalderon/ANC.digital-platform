import { useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { useSelectedBusiness } from "../../hooks/useSelectedBusiness";

export function NewClientWizard() {
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessSlug, setNewBusinessSlug] = useState("");
  const [newBusinessBrandColor, setNewBusinessBrandColor] = useState("#1a2b3c");
  const [newBusinessLogoUrl, setNewBusinessLogoUrl] = useState("");
  const [newBusinessNotes, setNewBusinessNotes] = useState("");

  const { setSelectedBusinessId } = useSelectedBusiness();
  const utils = trpc.useUtils();

  const createBusiness = trpc.admin.businesses.create.useMutation({
    onSuccess: async (result) => {
      await utils.admin.businesses.list.invalidate();
      setNewBusinessName("");
      setNewBusinessSlug("");
      setNewBusinessBrandColor("#1a2b3c");
      setNewBusinessLogoUrl("");
      setNewBusinessNotes("");
      setSelectedBusinessId(result.id);
    },
  });

  const handleCreateBusiness = () => {
    if (!newBusinessName.trim()) return;
    createBusiness.mutate({
      name: newBusinessName.trim(),
      slug: newBusinessSlug.trim() || undefined,
      brandColor: newBusinessBrandColor || undefined,
      logoUrl: newBusinessLogoUrl.trim() || undefined,
      notes: newBusinessNotes.trim() || undefined,
    });
  };

  return (
    <section className="admin-panel" id="new-client-wizard">
      <div className="admin-panel-head">
        <div className="admin-panel-head-copy">
          <span className="admin-panel-head-icon"><Sparkles size={18} /></span>
          <p className="admin-eyebrow">01 · Nuevo cliente</p>
          <h2>Empieza acá: crea el registro del cliente</h2>
        </div>
        <p>
          Nombre, slug, marca y notas. Al crearlo se siembra automáticamente un checklist de onboarding de 8 pasos.
        </p>
      </div>

      <div className="admin-control-bar">
        <label>
          Nuevo negocio / cliente
          <input
            type="text"
            placeholder="Nombre del cliente"
            value={newBusinessName}
            onChange={(event) => setNewBusinessName(event.target.value)}
          />
        </label>
        <label>
          Slug (opcional)
          <input
            type="text"
            placeholder="se autogenera si lo dejas vacío"
            value={newBusinessSlug}
            onChange={(event) => setNewBusinessSlug(event.target.value)}
          />
        </label>
        <label>
          Color de marca
          <input
            type="color"
            value={newBusinessBrandColor}
            onChange={(event) => setNewBusinessBrandColor(event.target.value)}
          />
        </label>
        <label>
          URL de logo (opcional)
          <input
            type="text"
            placeholder="https://…"
            value={newBusinessLogoUrl}
            onChange={(event) => setNewBusinessLogoUrl(event.target.value)}
          />
        </label>
        <label>
          Notas (opcional)
          <textarea
            rows={2}
            placeholder="Contexto del acuerdo, contactos, detalles…"
            value={newBusinessNotes}
            onChange={(event) => setNewBusinessNotes(event.target.value)}
          />
        </label>
        <button
          className="admin-primary-button"
          type="button"
          disabled={createBusiness.isPending || !newBusinessName.trim()}
          onClick={handleCreateBusiness}
        >
          {createBusiness.isPending ? "Creando…" : "Crear negocio"}
        </button>
      </div>
      {createBusiness.error ? <p className="admin-error"><AlertTriangle size={15} /> {createBusiness.error.message}</p> : null}
    </section>
  );
}
