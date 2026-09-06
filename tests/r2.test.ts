import { test } from "node:test";
import assert from "node:assert/strict";
import { faltantesR2, leerR2, parsearListado, revisarConfigR2, urlObjeto } from "../lib/r2.ts";

const config = { accountId: "0123456789abcdef0123456789abcdef", accessKeyId: "k", secretAccessKey: "s", bucket: "fuego-tiene" };

test("leerR2 exige las cuatro variables", () => {
  assert.equal(leerR2({}), null);
  assert.equal(leerR2({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c" }), null);
  assert.deepEqual(faltantesR2({ R2_BUCKET: "x" }), ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]);
  assert.deepEqual(leerR2({ R2_ACCOUNT_ID: " a ", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" }), {
    accountId: "a",
    accessKeyId: "b",
    secretAccessKey: "c",
    bucket: "d",
  });
});

test("urlObjeto usa estilo path y codifica el key", () => {
  assert.equal(urlObjeto(config, "s01e01.mp4").toString(), "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/fuego-tiene/s01e01.mp4");
  assert.equal(
    urlObjeto(config, "Los Simuladores 1x01 - Tarjeta de Navidad.mp4").pathname,
    "/fuego-tiene/Los%20Simuladores%201x01%20-%20Tarjeta%20de%20Navidad.mp4",
  );
  assert.equal(urlObjeto(config, "carpeta/capítulo.mp4").pathname, "/fuego-tiene/carpeta/cap%C3%ADtulo.mp4");
});

test("parsearListado lee Key, Size e IsTruncated", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>fuego-tiene</Name><KeyCount>2</KeyCount><MaxKeys>200</MaxKeys><IsTruncated>false</IsTruncated>
<Contents><Key>s01e01.mp4</Key><LastModified>2026-09-01T00:00:00.000Z</LastModified><ETag>"x"</ETag><Size>987654321</Size><StorageClass>STANDARD</StorageClass></Contents>
<Contents><Key>Marcela &amp; Paul.mp4</Key><Size>12</Size></Contents>
</ListBucketResult>`;
  const r = parsearListado(xml);
  assert.deepEqual(r, { objetos: [{ key: "s01e01.mp4", tamano: 987654321 }, { key: "Marcela & Paul.mp4", tamano: 12 }], truncado: false });
  assert.deepEqual(parsearListado("<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>"), { objetos: [], truncado: true });
});

test("revisarConfigR2 detecta los valores cruzados", () => {
  const id = "c2e8fa43edb2da85c1350e2d0dc5d13b";
  const key = "0123456789abcdef0123456789abcdef";
  const secret = "a".repeat(64);
  assert.equal(revisarConfigR2({ accountId: id, accessKeyId: key, secretAccessKey: secret, bucket: "fuego-tiene" }), null);
  assert.match(revisarConfigR2({ accountId: id, accessKeyId: key, secretAccessKey: secret, bucket: id }) ?? "", /R2_BUCKET.*32/);
  assert.match(revisarConfigR2({ accountId: "fuego-tiene", accessKeyId: key, secretAccessKey: secret, bucket: "x" }) ?? "", /R2_ACCOUNT_ID/);
  assert.match(revisarConfigR2({ accountId: id, accessKeyId: id, secretAccessKey: secret, bucket: "x" }) ?? "", /mismo valor/);
  assert.match(revisarConfigR2({ accountId: id, accessKeyId: key, secretAccessKey: "corto", bucket: "x" }) ?? "", /R2_SECRET_ACCESS_KEY.*64/);
});
