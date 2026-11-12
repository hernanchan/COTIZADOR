#!/usr/bin/env bash
set -euo pipefail
: "${ACCOUNT:?}"
: "${DEPLOY:?}"
root="https://api.cloudflare.com/client/v4/accounts/$ACCOUNT"
tmp=$(mktemp -d)
worker=saber-documentos-produccion
central=saber-pagos-produccion
api(){ curl -fsS --retry 2 --connect-timeout 10 --max-time 35 -H "Authorization: Bearer $DEPLOY" "$root/workers/scripts/$1/settings"; }
api "$worker" > "$tmp/docs.before.json"
api "$central" > "$tmp/central.before.json"
curl -fsS --retry 2 --connect-timeout 10 --max-time 35 \
 -H "Authorization: Bearer $DEPLOY" "$root/workers/scripts/$worker/deployments" > "$tmp/versions.before.json"
previous=$(jq -er '.result.deployments[0].versions |
 if length==1 and .[0].percentage==100 then .[0].version_id else empty end' "$tmp/versions.before.json")
jq -e '.success == true and
 (.result.bindings | 
  (any(.name=="CENTRAL_LIVE_R2_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
  (any(.name=="CENTRAL_LIVE_R2_QUOTA_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
  (any(.name=="CENTRAL_LIVE_R2_STAGING_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
  (any(.name=="MP_LIVE_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")))' "$tmp/central.before.json" >/dev/null
jq -e '.success == true and (.result.bindings |
  (any(.name=="SABER_ENTORNO" and .text=="produccion")) and
  (any(.name=="DOCS_LIVE_SESSION_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
  (any(.name=="DOCS_MP_LIVE_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
  (any(.name=="DOCS_LIVE_R2_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
  (any(.name=="DOCS_LIVE_R2_UPLOAD_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
  (any(.name=="DOCS_LIVE_R2_STAGING_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
  (any(.name=="DOCS_LIVE_SESSION_KEY" and .type=="secret_text")) and
  (any(.name=="DOCS_LIVE_TURNSTILE_SITE_KEY" and (.text|length)>19)) and
  (any(.name=="SABER_CENTRAL" and .type=="service" and .service=="saber-pagos-produccion")) and
  (any(.name=="SABER_R2_GRANDES_LIVE" and .type=="r2_bucket" and .bucket_name=="saber-documentos-produccion-privado")))' "$tmp/docs.before.json" >/dev/null
echo SABER_ORDER_RECOVERY_R2_GO_SNAPSHOT_OK
cp integraciones/autocotizador/produccion/wrangler.toml.template integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/^keep_vars = false$/keep_vars = true/' integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/SABER_ENTORNO = "preparacion"/SABER_ENTORNO = "produccion"/' integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/DOCS_MP_LIVE_GATE = "NO_GO"/DOCS_MP_LIVE_GATE = "GO_COMERCIAL_CONFIRMADO"/' integraciones/autocotizador/produccion/wrangler.toml
printf '\n[[r2_buckets]]\nbinding = "SABER_R2_GRANDES_LIVE"\nbucket_name = "saber-documentos-produccion-privado"\n' >> integraciones/autocotizador/produccion/wrangler.toml
changed=0
rollback(){
 code=$?
 if [ "$changed" = 1 ];then
  echo SABER_ORDER_RECOVERY_ROLLBACK_DOCS_ONLY
  jq -nc --arg old "$previous" '{strategy:"percentage",versions:[{version_id:$old,percentage:100}],annotations:{"workers/message":"Rollback documento: recuperación sesión falló comprobación"}}' |
  curl -fsS --retry 2 -X POST -H "Authorization: Bearer $DEPLOY" -H 'Content-Type: application/json' --data-binary @- "$root/workers/scripts/$worker/deployments" >/dev/null ||
  echo SABER_ORDER_RECOVERY_ROLLBACK_UNCONFIRMED
 fi
 exit "$code"
}
trap rollback ERR
changed=1
CI=true npx wrangler deploy --config integraciones/autocotizador/produccion/wrangler.toml > "$tmp/deploy.log" 2>&1 ||
 { tail -n 24 "$tmp/deploy.log";false; }
api "$worker" > "$tmp/docs.after.json"
api "$central" > "$tmp/central.after.json"
jq -cS '.result.bindings|sort_by(.name)' "$tmp/docs.before.json" > "$tmp/docs.before.bindings"
jq -cS '.result.bindings|sort_by(.name)' "$tmp/docs.after.json" > "$tmp/docs.after.bindings"
diff "$tmp/docs.before.bindings" "$tmp/docs.after.bindings"
jq -cS '[.result.bindings[]|select(.name|startswith("CENTRAL_LIVE_R2_") or .=="MP_LIVE_GATE")]|sort_by(.name)' "$tmp/central.before.json" > "$tmp/central.before.gates"
jq -cS '[.result.bindings[]|select(.name|startswith("CENTRAL_LIVE_R2_") or .=="MP_LIVE_GATE")]|sort_by(.name)' "$tmp/central.after.json" > "$tmp/central.after.gates"
diff "$tmp/central.before.gates" "$tmp/central.after.gates"
echo SABER_ORDER_RECOVERY_ALL_BINDINGS_AND_CENTRAL_R2_GO_PRESERVED
for attempt in 1 2 3 4 5 6 7 8;do
 status=$(curl -sS -L --max-time 14 -o "$tmp/continuar.html" -w '%{http_code}' 'https://pedidos.libreriasaber.com.ar/pedido/continuar')
 if [ "$status" = 200 ] && grep -q 'Retomá tu pedido' "$tmp/continuar.html";then break;fi
 sleep 2
done
test "$status" = 200
grep -q 'saberRenovarPedido' "$tmp/continuar.html"
statusStaff=$(curl -sS --max-time 14 -o /dev/null -w '%{http_code}' 'https://pedidos.libreriasaber.com.ar/personal/api/live-r2-inspection-original')
test "$statusStaff" = 401
echo SABER_ORDER_RECOVERY_401_REPLACED_WITH_SECURE_TURNSTILE_NO_CHARGE
echo SABER_ORDER_RECOVERY_DOCS_ONLY_DEPLOY_PASS_CENTRAL_MP_R2_UNCHANGED
trap - ERR
