#!/usr/bin/env bash
set -euo pipefail
: "${ACCOUNT:?}"
: "${DEPLOY:?}"
: "${D1_TOKEN:?}"
root="https://api.cloudflare.com/client/v4/accounts/$ACCOUNT"
tmp=$(mktemp -d)
cd "$GITHUB_WORKSPACE"
api(){ curl -fsS --retry 2 --connect-timeout 10 --max-time 35 -H "Authorization: Bearer $DEPLOY" "$root/workers/scripts/$1/$2"; }
for w in saber-pagos-produccion saber-documentos-produccion;do
 api "$w" "settings" > "$tmp/$w.before.json"
 api "$w" "deployments" > "$tmp/$w.deps.json"
 jq -er '.result.deployments[0].versions|
  if length==1 and .[0].percentage==100 then .[0].version_id else empty end' "$tmp/$w.deps.json" > "$tmp/$w.version"
 jq -cS '.result.bindings|sort_by(.name)' "$tmp/$w.before.json" > "$tmp/$w.bindings"
 echo 0 > "$tmp/$w.changed"
done
jq -e '.success==true and (.result.bindings|
 (any(.name=="SABER_ENTORNO" and .text=="produccion")) and
 (any(.name=="MP_LIVE_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
 (any(.name=="CENTRAL_LIVE_R2_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
 (any(.name=="CENTRAL_LIVE_R2_QUOTA_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
 (any(.name=="CENTRAL_LIVE_R2_STAGING_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
 (any(.name=="CENTRAL_LIVE_TRANSFER_GATE" and .text=="NO_GO")) and
 (any(.name=="CENTRAL_LIVE_TRANSFER_APPROVAL_GATE" and .text=="NO_GO")))' "$tmp/saber-pagos-produccion.before.json" >/dev/null
jq -e '.success==true and (.result.bindings|
 (any(.name=="SABER_ENTORNO" and .text=="produccion")) and
 (any(.name=="DOCS_MP_LIVE_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
 (any(.name=="DOCS_LIVE_R2_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
 (any(.name=="DOCS_LIVE_R2_UPLOAD_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
 (any(.name=="DOCS_LIVE_STAFF_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and
 (any(.name=="DOCS_LIVE_TRANSFER_GATE" and .text=="NO_GO")) and
 (any(.name=="DOCS_LIVE_STAFF_SECRET" and .type=="secret_text")) and
 (any(.name=="SABER_R2_GRANDES_LIVE" and .type=="r2_bucket")))' "$tmp/saber-documentos-produccion.before.json" >/dev/null
id=$(curl -fsS -H "Authorization: Bearer $D1_TOKEN" "$root/d1/database" |
 jq -er '.result|[.[]|select(.name=="saber-pagos-produccion")]|if length==1 then .[0].uuid else empty end')
sed "s/__D1_PRODUCCION_UUID__/$id/g" integraciones/mercadopago/produccion/wrangler.toml.template > integraciones/mercadopago/produccion/wrangler.toml
sed -i 's/SABER_ENTORNO = "preparacion"/SABER_ENTORNO = "produccion"/' integraciones/mercadopago/produccion/wrangler.toml
sed -i 's/MP_LIVE_GATE = "NO_GO"/MP_LIVE_GATE = "GO_COMERCIAL_CONFIRMADO"/' integraciones/mercadopago/produccion/wrangler.toml
cp integraciones/autocotizador/produccion/wrangler.toml.template integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/^keep_vars = false$/keep_vars = true/' integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/SABER_ENTORNO = "preparacion"/SABER_ENTORNO = "produccion"/' integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/DOCS_MP_LIVE_GATE = "NO_GO"/DOCS_MP_LIVE_GATE = "GO_COMERCIAL_CONFIRMADO"/' integraciones/autocotizador/produccion/wrangler.toml
printf '\n[[r2_buckets]]\nbinding = "SABER_R2_GRANDES_LIVE"\nbucket_name = "saber-documentos-produccion-privado"\n' >> integraciones/autocotizador/produccion/wrangler.toml
echo SABER_TRANSFER_DEPLOY_SNAPSHOTS_GATES_OFF_MP_R2_GO
rollback(){
 code=$?
 for w in saber-documentos-produccion saber-pagos-produccion;do
  if [ "$(cat "$tmp/$w.changed")" = 1 ];then
   old=$(cat "$tmp/$w.version")
   echo "SABER_TRANSFER_RESTORE_PREVIOUS_$w"
   jq -nc --arg old "$old" '{strategy:"percentage",versions:[{version_id:$old,percentage:100}],annotations:{"workers/message":"Rollback staff transfers due to validation failure"}}' |
    curl -fsS -X POST -H "Authorization: Bearer $DEPLOY" -H "Content-Type: application/json" --data-binary @- "$root/workers/scripts/$w/deployments" >/dev/null ||
    echo "SABER_TRANSFER_ROLLBACK_UNCONFIRMED_$w"
  fi
 done
 exit "$code"
}
trap rollback ERR
CI=true npx wrangler deploy --config integraciones/mercadopago/produccion/wrangler.toml > "$tmp/central.log" 2>&1 ||
 { tail -n 24 "$tmp/central.log";false; }
echo 1 > "$tmp/saber-pagos-produccion.changed"
CI=true npx wrangler deploy --config integraciones/autocotizador/produccion/wrangler.toml > "$tmp/docs.log" 2>&1 ||
 { tail -n 24 "$tmp/docs.log";false; }
echo 1 > "$tmp/saber-documentos-produccion.changed"
for w in saber-pagos-produccion saber-documentos-produccion;do
 api "$w" "settings" > "$tmp/$w.after.json"
 jq -cS '.result.bindings|sort_by(.name)' "$tmp/$w.after.json" > "$tmp/$w.after.bindings"
 diff "$tmp/$w.bindings" "$tmp/$w.after.bindings"
done
for path in /personal/transferencias /personal/api/live-transferencias-pendientes /personal/api/live-transferencias-aprobar /personal/paquete;do
 status=0
 for attempt in 1 2 3 4 5 6 7 8 9 10 11 12;do
  status=$(curl -sS --max-time 16 -o /dev/null -w '%{http_code}' "https://pedidos.libreriasaber.com.ar$path")
  if [ "$status" = 401 ];then break;fi
  sleep 2
 done
 echo "SABER_TRANSFER_PROTECTED_PATH_HTTP_$status"
 test "$status" = 401
done
status=$(curl -sS --max-time 16 -o /dev/null -w '%{http_code}' https://pedidos.libreriasaber.com.ar/cotizar)
test "$status" = 200
status=$(curl -sS --max-time 16 -o /dev/null -w '%{http_code}' https://pedidos.libreriasaber.com.ar/personal/api/live-r2-inspection-original)
test "$status" = 401
echo SABER_TRANSFER_STAFF_ONLY_WORKERS_DEPLOY_SUCCESS_GATES_STILL_OFF
echo SABER_MP_R2_TUS_BUDGETS_AND_WORKER_BINDINGS_UNCHANGED
trap - ERR
