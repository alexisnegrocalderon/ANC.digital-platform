import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, LockKeyhole, Settings2, ShieldCheck } from "lucide-react";
import type { ModuleKey } from "../../../../shared/module";
import { trpc } from "../../lib/trpc";

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
  const [selectedBusinessId, setSelectedBusinessId] = useState(1);
  const [selectedPresetKey, setSelectedPresetKey] = useState("events");
  const [selectedKeys, setSelectedKeys] = useState<ModuleKey[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("anc-active-business-id", String(selectedBusinessId));
    }
  }, [selectedBusinessId]);
  const businesses = trpc.admin.businesses.list.useQuery(undefined, { retry: false });
  const presets = trpc.admin.presets.list.useQuery(undefined, { retry: false });
  const catalog = trpc.admin.modules.catalog.useQuery({ businessId: selectedBusinessId }, { retry: false });
  const plan = trpc.admin.modules.resolveActivationPlan.useQuery(
    { moduleKeys: selectedKeys },
    { enabled: selectedKeys.length > 0, retry: false },
  );
  const utils = trpc.useUtils();
  const enable = trpc.admin.businessModules.enable.useMutation({
    onSuccess: async () => {
      await utils.admin.modules.catalog.invalidate({ businessId: selectedBusinessId });
      setSelectedKeys([]);
    },
  });
  const disable = trpc.admin.businessModules.disable.useMutation({
    onSuccess: async () => {
      await utils.admin.modules.catalog.invalidate({ businessId: selectedBusinessId });
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
      await utils.admin.modules.catalog.invalidate({ businessId: selectedBusinessId });
    },
  });

  const toggleModule = (key: ModuleKey, enabled: boolean) => {
    setSelectedKeys((current) =>
      enabled ? [...new Set([...current, key])] : current.filter((item) => item !== key),
    );
  };

  const handleApplyPreset = () => {
    applyPreset.mutate({
      businessId: selectedBusinessId,
      presetKey: selectedPresetKey as never,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const handleEnable = () => {
    if (selectedKeys.length === 0) return;
    enable.mutate({
      businessId: selectedBusinessId,
      moduleKeys: selectedKeys,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const handleDisable = (key: ModuleKey) => {
    disable.mutate({
      businessId: selectedBusinessId,
      moduleKeys: [key],
      idempotencyKey: crypto.randomUUID(),
    });
  };

  return (
    <section className="admin-modules-section" id="module-admin">
      <div className="section-heading">
        <div>
          <p className="eyebrow">04 / PLATFORM ADMIN</p>
          <h2>Activa capacidades sin crear otro proyecto.</h2>
        </div>
        <p>
          Selecciona un negocio, revisa el plan de dependencias y activa solo lo que el cliente necesita. El catálogo distingue entre runtime disponible y módulo todavía planificado.
        </p>
      </div>

      <div className="admin-control-bar">
        <label>
          Cliente / negocio
          <select value={selectedBusinessId} onChange={(event) => setSelectedBusinessId(Number(event.target.value))}>
            {(businesses.data ?? [{ id: 1, name: "ANC Platform Demo" }]).map((business: { id: number; name: string }) => (
              <option key={business.id} value={business.id}>{business.name}</option>
            ))}
          </select>
        </label>
        <label>
          Preset inicial
          <select value={selectedPresetKey} onChange={(event) => setSelectedPresetKey(event.target.value)}>
            {(presets.data ?? []).map((preset) => <option value={preset.key} key={preset.key}>{preset.displayName}</option>)}
          </select>
        </label>
        <button className="admin-primary-button" type="button" disabled={applyPreset.isPending} onClick={handleApplyPreset}>
          {applyPreset.isPending ? "Aplicando preset…" : "Aplicar preset"}
        </button>
        <div className="admin-summary">
          <span><ShieldCheck size={15} /> {selectedKeys.length} seleccionados</span>
          <span><ChevronRight size={15} /> {plan.data?.ordered.length ?? 0} en plan</span>
        </div>
        <button className="admin-primary-button" type="button" disabled={!selectedKeys.length || enable.isPending} onClick={handleEnable}>
          {enable.isPending ? "Aplicando…" : "Aplicar selección"}
        </button>
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
