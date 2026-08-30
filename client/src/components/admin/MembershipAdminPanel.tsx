import { ShieldCheck, UserMinus, UserRoundCog } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { BUSINESS_ROLE_KEYS, type BusinessRole } from "../../../../shared/auth";
import { useSelectedBusiness } from "../../hooks/useSelectedBusiness";

export function MembershipAdminPanel() {
  const { selectedBusinessId } = useSelectedBusiness();
  const memberships = trpc.admin.memberships.list.useQuery(
    { businessId: selectedBusinessId ?? 0 },
    { enabled: selectedBusinessId !== null, retry: false },
  );
  const utils = trpc.useUtils();
  const setRole = trpc.admin.memberships.setRole.useMutation({
    onSuccess: async () => {
      if (selectedBusinessId !== null) {
        await utils.admin.memberships.list.invalidate({ businessId: selectedBusinessId });
      }
    },
  });
  const revoke = trpc.admin.memberships.revoke.useMutation({
    onSuccess: async () => {
      if (selectedBusinessId !== null) {
        await utils.admin.memberships.list.invalidate({ businessId: selectedBusinessId });
      }
    },
  });

  return (
    <section className="admin-memberships-section" id="membership-admin">
      <div className="section-heading">
        <div>
          <p className="eyebrow">05 / MEMBERSHIPS & ROLES</p>
          <h2>Acceso por negocio, no por confianza en el cliente.</h2>
        </div>
        <p>
          Cada usuario entra por OAuth y solo recibe acceso a los negocios donde tiene una membership activa.
          Los cambios quedan auditados.
        </p>
      </div>

      <div className="admin-control-bar">
        <div className="admin-summary"><span><ShieldCheck size={15} /> {memberships.data?.length ?? 0} miembros</span></div>
      </div>

      {memberships.error ? <p className="admin-error">{memberships.error.message}</p> : null}
      {selectedBusinessId === null ? (
        <p className="booking-muted">Selecciona un cliente arriba para ver sus membresías.</p>
      ) : (
        <div className="membership-list">
          {(memberships.data ?? []).map((member) => (
            <article className="membership-row" key={member.membershipId}>
              <div>
                <strong>{member.name ?? member.email ?? member.authSubject}</strong>
                <span>{member.email ?? "Sin email"} · {member.status}</span>
              </div>
              <label>
                Rol
                <select
                  value={member.roleKey}
                  onChange={(event) => setRole.mutate({
                    businessId: selectedBusinessId,
                    userId: member.userId,
                    roleKey: event.target.value as BusinessRole,
                  })}
                  disabled={setRole.isPending}
                >
                  {BUSINESS_ROLE_KEYS.map((role) => <option value={role} key={role}>{role}</option>)}
                </select>
              </label>
              <button
                type="button"
                className="auth-button"
                onClick={() => revoke.mutate({ businessId: selectedBusinessId, userId: member.userId })}
                disabled={revoke.isPending || member.status !== "active"}
              >
                <UserMinus size={14} /> Revocar
              </button>
            </article>
          ))}
          {!memberships.isLoading && memberships.data?.length === 0 ? (
            <p className="booking-muted"><UserRoundCog size={16} /> No hay memberships para este negocio.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
