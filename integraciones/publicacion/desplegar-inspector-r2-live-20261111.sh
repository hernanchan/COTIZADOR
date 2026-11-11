#!/usr/bin/env bash
set -euo pipefail
test -n "$ACCOUNT" && test -n "$DEPLOY" && test -n "$D1_TOKEN"
root="https://api.cloudflare.com/client/v4/accounts/$ACCOUNT"
mkdir -p /tmp/saber-r2-staff
for w in saber-pagos-produccion saber-documentos-produccion; do
  curl -fsS -H "Authorization: Bearer $DEPLOY" "$root/workers/scripts/$w/settings" >/tmp/saber-r2-staff/$w.before.json
  jq -r '.result.bindings[].name' /tmp/saber-r2-staff/$w.before.json |sort >/tmp/saber-r2-staff/$w.before.names
  curl -fsS -H "Authorization: Bearer $DEPLOY" "$root/workers/scripts/$w/deployments" >/tmp/saber-r2-staff/$w.versions.json
  jq -re '.result.deployments[0].versions|if length==1 and .[0].percentage==100 then .[0].version_id else empty end' /tmp/saber-r2-staff/$w.versions.json >/tmp/saber-r2-staff/$w.before.version
  echo 0 >/tmp/saber-r2-staff/$w.changed
done
jq -e '.success==true and (.result.bindings|any(.name=="CENTRAL_LIVE_R2_GATE" and .text=="NO_GO")) and (.result.bindings|any(.name=="CENTRAL_LIVE_R2_QUOTA_GATE" and .text=="NO_GO")) and (.result.bindings|any(.name=="CENTRAL_LIVE_R2_STAGING_GATE" and .text=="NO_GO")) and (.result.bindings|any(.name=="CENTRAL_LIVE_R2_INSPECTION_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and (.result.bindings|any(.name=="CENTRAL_LIVE_R2_INSPECTION_KEY" and .type=="secret_text")) and (.result.bindings|any(.name=="MP_LIVE_GATE" and .text=="GO_COMERCIAL_CONFIRMADO"))' /tmp/saber-r2-staff/saber-pagos-produccion.before.json >/dev/null
jq -e '.success==true and (.result.bindings|any(.name=="DOCS_LIVE_R2_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and (.result.bindings|any(.name=="DOCS_LIVE_R2_UPLOAD_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and (.result.bindings|any(.name=="DOCS_LIVE_R2_STAGING_GATE" and .text=="GO_COMERCIAL_CONFIRMADO")) and (.result.bindings|any(.name=="DOCS_LIVE_STAFF_SECRET" and .type=="secret_text")) and (.result.bindings|any(.name=="SABER_R2_GRANDES_LIVE" and .type=="r2_bucket" and .bucket_name=="saber-documentos-produccion-privado"))' /tmp/saber-r2-staff/saber-documentos-produccion.before.json >/dev/null
curl -fsS -H "Authorization: Bearer $D1_TOKEN" "$root/d1/database" >/tmp/saber-r2-staff/dbs.json
id=$(jq -r '[.result[]|select(.name=="saber-pagos-produccion")]|if length==1 then .[0].uuid else empty end' /tmp/saber-r2-staff/dbs.json)
test -n "$id"
sed "s/__D1_PRODUCCION_UUID__/$id/g" integraciones/mercadopago/produccion/wrangler.toml.template >integraciones/mercadopago/produccion/wrangler.toml
sed -i 's/SABER_ENTORNO = "preparacion"/SABER_ENTORNO = "produccion"/' integraciones/mercadopago/produccion/wrangler.toml
sed -i 's/MP_LIVE_GATE = "NO_GO"/MP_LIVE_GATE = "GO_COMERCIAL_CONFIRMADO"/' integraciones/mercadopago/produccion/wrangler.toml
cp integraciones/autocotizador/produccion/wrangler.toml.template integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/^keep_vars = false$/keep_vars = true/' integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/SABER_ENTORNO = "preparacion"/SABER_ENTORNO = "produccion"/' integraciones/autocotizador/produccion/wrangler.toml
sed -i 's/DOCS_MP_LIVE_GATE = "NO_GO"/DOCS_MP_LIVE_GATE = "GO_COMERCIAL_CONFIRMADO"/' integraciones/autocotizador/produccion/wrangler.toml
printf '\n[[r2_buckets]]\nbinding = "SABER_R2_GRANDES_LIVE"\nbucket_name = "saber-documentos-produccion-privado"\n' >>integraciones/autocotizador/produccion/wrangler.toml
echo SABER_R2_STAFF_SNAPSHOT_AND_PRECONDITIONS_OK
rollback(){
  code=$?
  for w in saber-documentos-produccion saber-pagos-produccion; do
    if [ "$(cat /tmp/saber-r2-staff/$w.changed)" = 1 ];then
      old=$(cat /tmp/saber-r2-staff/$w.before.version)
      echo "SABER_R2_STAFF_RESTORE_$w"
      jq -nc --arg old "$old" '{strategy:"percentage",versions:[{version_id:$old,percentage:100}],annotations:{"workers/message":"R2 staff rollback: failed safety check"}}' |
       curl -fsS -X POST -H "Authorization: Bearer $DEPLOY" -H 'Content-Type: application/json' --data-binary @- "$root/workers/scripts/$w/deployments" >/dev/null || true
    fi
  done
  exit "$code"
}
trap rollback ERR
CI=true npx wrangler deploy --config integraciones/mercadopago/produccion/wrangler.toml >/tmp/saber-r2-staff/central.log 2>&1 ||
 { tail -n 24 /tmp/saber-r2-staff/central.log;false; }
echo 1 >/tmp/saber-r2-staff/saber-pagos-produccion.changed
CI=true npx wrangler deploy --config integraciones/autocotizador/produccion/wrangler.toml >/tmp/saber-r2-staff/docs.log 2>&1 ||
 { tail -n 24 /tmp/saber-r2-staff/docs.log;false; }
echo 1 >/tmp/saber-r2-staff/saber-documentos-produccion.changed
for w in saber-pagos-produccion saber-documentos-produccion;do
  curl -fsS -H "Authorization: Bearer $DEPLOY" "$root/workers/scripts/$w/settings" >/tmp/saber-r2-staff/$w.after.json
  jq -r '.result.bindings[].name' /tmp/saber-r2-staff/$w.after.json |sort >/tmp/saber-r2-staff/$w.after.names
  diff /tmp/saber-r2-staff/$w.before.names /tmp/saber-r2-staff/$w.after.names
  jq -e '.result.bindings|any(.name=="SABER_ENTORNO" and .text=="produccion")' /tmp/saber-r2-staff/$w.after.json >/dev/null
done
jq -e '.result.bindings|any(.name=="CENTRAL_LIVE_R2_GATE" and .text=="NO_GO") and any(.name=="CENTRAL_LIVE_R2_QUOTA_GATE" and .text=="NO_GO") and any(.name=="CENTRAL_LIVE_R2_STAGING_GATE" and .text=="NO_GO") and any(.name=="CENTRAL_LIVE_R2_INSPECTION_GATE" and .text=="GO_COMERCIAL_CONFIRMADO") and any(.name=="CENTRAL_LIVE_R2_INSPECTION_KEY" and .type=="secret_text")' /tmp/saber-r2-staff/saber-pagos-produccion.after.json >/dev/null
jq -e '.result.bindings|any(.name=="DOCS_LIVE_STAFF_SECRET" and .type=="secret_text") and any(.name=="SABER_R2_GRANDES_LIVE" and .type=="r2_bucket" and .bucket_name=="saber-documentos-produccion-privado")' /tmp/saber-r2-staff/saber-documentos-produccion.after.json >/dev/null
for route in live-r2-board live-r2-inspection-source live-r2-inspection-original;do
  status=0
  for attempt in 1 2 3 4 5 6 7 8;do
    status=$(curl -sS --max-time 14 -o /dev/null -w '%{http_code}' "https://pedidos.libreriasaber.com.ar/personal/api/$route")
    if [ "$status" = 401 ];then break;fi
    sleep 1
  done
  echo "R2_LIVE_STAFF_$route=$status"
  test "$status" = 401
done
echo SABER_R2_LIVE_STAFF_DEPLOYED_AUTH_ONLY_RECEIVING_R2_PAYMENT_CLOSED
