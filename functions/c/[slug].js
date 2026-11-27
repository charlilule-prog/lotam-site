// lotam.co.il/c/<slug> – a teacher's digital card. The page is made by the Lotam app (app.lotam.co.il/c/<slug>);
// this passes it on so the address teachers share stays lotam.co.il.
export async function onRequestGet({ params, request }) {
  const slug = String(params.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,40}(\.vcf)?$/.test(slug)) return new Response("Not found", { status: 404 });
  const res = await fetch(`https://app.lotam.co.il/c/${slug}`, { headers: { "User-Agent": request.headers.get("User-Agent") || "" }, cf: { cacheTtl: 60 } });
  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  return new Response(res.body, { status: res.status, headers });
}
