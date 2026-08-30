import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, LayoutGrid, LockKeyhole, Settings2, ShieldCheck } from "lucide-react";
import type { ModuleKey } from "../../../../shared/module";
import { trpc } from "../../lib/trpc";
import { useSelectedBusiness } from "../../hooks/useSelectedBusiness";

type OnboardingChecklistItem = { key: string; label: string; done: boolean; doneAt: string | null };

type AdminBusiness = {
  id: number;
  slug: string;
  name: string;
  status: string;
  timezone: string;
  currency: string;
  brandColor: string | null;
  logoUrl: string | null;
  repoUrl: string | null;
  vercelUrl: string | null;
  notes: string | null;
  onboardingChecklist: OnboardingChecklistItem[];
};

function checklistProgress(business: AdminBusiness | undefined) {
  const checklist = business?.onboardingChecklist ?? [];
  const done = checklist.filter((item) => item.done).length;
  return { done, total: checklist.length };
}

const categoryLabels: Record<string, string> = {
  offer: "Oferta y datos base",
  commerce: "Comercio y transacciones",
  customer: "Clientes y relación",
  operations: "Operación y atención",
  intelligence: "Inteligencia y control",
};

const maturityLabels: Record<string, string> = {
  implemented: "Implementado",
  "implemented-hardening": "Implementado / hardening",
  scaffolded: "Scaffold parcial",
  "contract-ready": "Contrato listo",
  planned: "Planificado",
};

export function ModuleAdminPanel() {
  const { selectedBusinessId } = useSelectedBusiness();
  const [selectedPresetKey, setSelectedPresetKey] = useState("events");
  const [selectedKeys, setSelectedKeys] = useState<ModuleKey[]>([]);
  const [detailBusinessId, setDetailBusinessId] = useState<number | null>(null);
  const [detailForm, setDetailForm] = useState({
    brandColor: "",
    logoUrl: "",
    repoUrl: "",
    vercelUrl: "",
    notes: "",
  });

  const businesses = trpc.admin.businesses.list.useQuery(undefined, { retry: false }) as {
    data?: AdminBusiness[];
    isLoading: boolean;
  };
  const presets = trpc.admin.presets.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();

  const updateDetails = trpc.admin.businesses.updateDetails.useMutation({
    onSuccess: async () => {
      await utils.admin.businesses.list.invalidate();
    },
  });

  const toggleChecklistItem = trpc.admin.businesses.toggleChecklistItem.useMutation({
    onSuccess: async () => {
      await utils.admin.businesses.list.invalidate();
    },
  });

  const catalog = trpc.admin.modules.catalog.useQuery(
    { businessId: selectedBusinessId ?? 0 },
    { enabled: selectedBusinessId !== null, retry: false },
  );
  const plan = trpc.admin.modules.resolveActivationPlan.useQuery(
    { moduleKeys: selectedKeys },
    { enabled: selectedKeys.length > 0, retry: false },
  );
  const enable = trpc.admin.businessModules.enable.useMutation({
    onSuccess: async () => {
      await utils.admin.modules.catalog.invalidate({ businessId: selectedBusinessId ?? 0 });
      setSelectedKeys([]);
    },
  });
  const disable = trpc.admin.businessModules.disable.useMutation({
    onSuccess: async () => {
      await utils.admin.modules.catalog.invalidate({ businessId: selectedBusinessId ?? 0 });
    },
  });

  useEffect(() => {
    const enabled = catalog.data?.filter((module) => module.enabled).map((module) => module.key) ?? [];
    setSelectedKeys(enabled);
  }, [selectedBusinessId, catalog.data]);

  const grouped = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof catalog.data>>();
    for (const module of catalog.data ?? []) {
      const current = groups.get(module.category) ?? [];
      current.push(module);
      groups.set(module.category, current);
    }
    return [...groups.entries()];
  }, [catalog.data]);

  const applyPreset = trpc.admin.presets.applyPreset.useMutation({
    onSuccess: async (result) => {
      setSelectedKeys(result.result.resolved);
      await utils.admin.modules.catalog.invalidate({ businessId: selectedBusinessId ?? 0 });
    },
  });

  const toggleModule = (key: ModuleKey, enabled: boolean) => {
    setSelectedKeys((current) =>
      enabled ? [...new Set([...current, key])] : current.filter((item) => item !== key),
    );
  };

  const openBusinessDetail = (business: AdminBusiness) => {
    if (detailBusinessId === business.id) {
      setDetailBusinessId(null);
      return;
    }
    setDetailBusinessId(business.id);
    setDetailForm({
      brandColor: business.brandColor ?? "",
      logoUrl: business.logoUrl ?? "",
      repoUrl: business.repoUrl ?? "",
      vercelUrl: business.vercelUrl ?? "",
      notes: business.notes ?? "",
    });
  };

  const handleSaveDetails = () => {
    if (detailBusinessId === null) return;
    updateDetails.mutate({
      businessId: detailBusinessId,
      brandColor: detailForm.brandColor.trim() || null,
      logoUrl: detailForm.logoUrl.trim() || null,
      repoUrl: detailForm.repoUrl.trim() || null,
      vercelUrl: detailForm.vercelUrl.trim() || null,
      notes: detailForm.notes.trim() || null,
    });
  };

  const handleToggleChecklistItem = (businessId: number, key: string, done: boolean) => {
    toggleChecklistItem.mutate({ businessId, key, done });
  };

  const handleApplyPreset = () => {
    if (selectedBusinessId === null) return;
    applyPreset.mutate({
      businessId: selectedBusinessId,
      presetKey: selectedPresetKey as never,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const handleEnable = () => {
    if (selectedKeys.length === 0 || selectedBusinessId === null) return;
    enable.mutate({
      businessId: selectedBusinessId,
      moduleKeys: selectedKeys,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const handleDisable = (key: ModuleKey) => {
    if (selectedBusinessId === null) return;
    disable.mutate({
      businessId: selectedBusinessId,
      moduleKeys: [key],
      idempotencyKey: crypto.randomUUID(),
    });
  };

  return (
    <section className="admin-panel" id="module-admin">
      <div className="admin-panel-head">
        <div className="admin-panel-head-copy">
          <span className="admin-panel-head-icon"><LayoutGrid size={18} /></span>
          <p className="admin-eyebrow">02 · Clientes y módulos</p>
          <h2>Activa capacidades sin crear otro proyecto</h2>
        </div>
        <p>
          Elegí un negocio, revisá el plan de dependencias y activá solo lo que ese cliente necesita.
        </p>
      </div>

      <div className="admin-control-bar">
        <label>
          Preset inicial
          <select value={selectedPresetKey} onChange={(event) => setSelectedPresetKey(event.target.value)}>
            {(presets.data ?? []).map((preset) => <option value={preset.key} key={preset.key}>{preset.displayName}</option>)}
          </select>
        </label>
        <button className="admin-primary-button" type="button" disabled={applyPreset.isPending || selectedBusinessId === null} onClick={handleApplyPreset}>
          {applyPreset.isPending ? "Aplicando preset…" : "Aplicar preset"}
        </button>
        <div className="admin-summary">
          <span><ShieldCheck size={15} /> {selectedKeys.length} seleccionados</span>
          <span><ChevronRight size={15} /> {plan.data?.ordered.length ?? 0} en plan</span>
        </div>
        <button className="admin-primary-button" type="button" disabled={!selectedKeys.length || enable.isPending || selectedBusinessId === null} onClick={handleEnable}>
          {enable.isPending ? "Aplicando…" : "Aplicar selección"}
        </button>
      </div>

      <div className="membership-list">
        {(businesses.data ?? []).map((business) => {
          const progress = checklistProgress(business);
          const isOpen = detailBusinessId === business.id;
          const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
          return (
            <article className="membership-row" key={business.id}>
              <div>
                <strong>
                  {business.brandColor ? (
                    <span className="client-swatch" style={{ background: business.brandColor, marginRight: 8 }} />
                  ) : null}
                  {business.name}
                </strong>
                <span className="client-progress">
                  {business.slug} ·
                  <span className="client-progress-track">
                    <span className="client-progress-fill" style={{ width: `${percent}%` }} />
                  </span>
                  {progress.done}/{progress.total}
                </span>
              </div>
              <button type="button" className="auth-button" onClick={() => openBusinessDetail(business)}>
                <ClipboardList size={14} /> {isOpen ? "Cerrar detalle" : "Detalle"}
              </button>
              {isOpen ? (
                <div className="admin-control-bar" style={{ width: "100%" }}>
                  <label>
                    Color de marca
                    <input
                      type="color"
                      value={detailForm.brandColor || "#1a2b3c"}
                      onChange={(event) => setDetailForm((form) => ({ ...form, brandColor: event.target.value }))}
                    />
                  </label>
                  <label>
                    URL de logo
                    <input
                      type="text"
                      value={detailForm.logoUrl}
                      onChange={(event) => setDetailForm((form) => ({ ...form, logoUrl: event.target.value }))}
                    />
                  </label>
                  <label>
                    URL del repo
                    <input
                      type="text"
                      value={detailForm.repoUrl}
                      onChange={(event) => setDetailForm((form) => ({ ...form, repoUrl: event.target.value }))}
                    />
                  </label>
                  <label>
                    URL de Vercel
                    <input
                      type="text"
                      value={detailForm.vercelUrl}
                      onChange={(event) => setDetailForm((form) => ({ ...form, vercelUrl: event.target.value }))}
                    />
                  </label>
                  <label>
                    Notas
                    <textarea
                      rows={2}
                      value={detailForm.notes}
                      onChange={(event) => setDetailForm((form) => ({ ...form, notes: event.target.value }))}
                    />
                  </label>
                  <button
                    className="admin-primary-button"
                    type="button"
                    disabled={updateDetails.isPending}
                    onClick={handleSaveDetails}
                  >
                    {updateDetails.isPending ? "Guardando…" : "Guardar"}
                  </button>
                  {updateDetails.error ? (
                    <p className="admin-error"><AlertTriangle size={15} /> {updateDetails.error.message}</p>
                  ) : null}

                  <div className="admin-summary" style={{ width: "100%", flexDirection: "column", alignItems: "flex-start" }}>
                    {(business.onboardingChecklist ?? []).map((item) => (
                      <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          disabled={toggleChecklistItem.isPending}
                          onChange={(event) => handleToggleChecklistItem(business.id, item.key, event.target.checked)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  {toggleChecklistItem.error ? (
                    <p className="admin-error"><AlertTriangle size={15} /> {toggleChecklistItem.error.message}</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {applyPreset.error ? <p className="admin-error"><AlertTriangle size={15} /> {applyPreset.error.message}</p> : null}
      {enable.error ? <p className="admin-error"><AlertTriangle size={15} /> {enable.error.message}</p> : null}
      {catalog.error ? <p className="admin-error"><AlertTriangle size={15} /> {catalog.error.message}</p> : null}

      <div className="admin-module-grid">
        {grouped.map(([category, modules]) => (
          <div className="admin-module-group" key={category}>
            <div className="admin-group-heading">
              <span className="metric-label">{categoryLabels[category] ?? category}</span>
              <span>{modules.length} módulos</span>
            </div>
            {modules.map((module) => {
              const selected = selectedKeys.includes(module.key);
              const blocked = module.status === "blocked";
              return (
                <article className={selected ? "admin-module-card is-selected" : "admin-module-card"} key={module.key}>
                  <div className="admin-module-card-head">
                    <label className="admin-module-toggle">
                      <input checked={selected} disabled={blocked} onChange={(event) => toggleModule(module.key, event.target.checked)} type="checkbox" />
                      <span>{module.displayName}</span>
                    </label>
                    <span className={`admin-status admin-status-${module.status.replaceAll("_", "-")}`}>
                      {blocked ? <LockKeyhole size={12} /> : <CheckCircle2 size={12} />}
                      {maturityLabels[module.maturity] ?? module.maturity}
                    </span>
                  </div>
                  <p>{module.description}</p>
                  <div className="admin-module-meta">
                    <span>{module.key}</span>
                    <span>{module.dependencies.length ? `depende de ${module.dependencies.join(", ")}` : "sin dependencias"}</span>
                  </div>
                  {module.requiresSetup ? (
                    <div className="admin-setup-note"><Settings2 size={13} /> {module.setupChecklist.join(" · ")}</div>
                  ) : null}
                  {module.enabled && !blocked ? (
                    <button className="admin-disable-link" type="button" onClick={() => handleDisable(module.key)} disabled={disable.isPending}>
                      Desactivar este módulo
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        ))}
      </div>

      {plan.data ? (
        <div className="admin-plan-preview">
          <span className="metric-label">ACTIVATION PLAN</span>
          <p>{plan.data.ordered.join(" → ")}</p>
        </div>
      ) : null}
    </section>
  );
}
