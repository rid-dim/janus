/** Small POST-JSON helper for the editor endpoints. Throws on { ok:false }. */
export async function postJSON(url, body) {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	let d;
	try {
		d = await res.json();
	} catch {
		d = { ok: false, error: 'Ungültige Serverantwort' };
	}
	if (!d.ok) throw new Error(d.error || 'Fehlgeschlagen');
	return d;
}
