<script>
	/**
	 * Wiedervorlage-Liste (stand/-Datei mit `typ: termine`), von der App nach
	 * Aktualität sortiert. Die Datei selbst darf unsortiert sein – siehe
	 * lib/server/termine.js.
	 * @type {{ termine: any, projectId: string, rel: string }}
	 */
	let { termine, projectId, rel } = $props();

	const GRUPPEN = [
		{ key: 'ueberfaellig', titel: 'Überfällig / sofort' },
		{ key: 'woche', titel: 'Nächste 7 Tage' },
		{ key: 'monat', titel: 'Nächste 30 Tage' },
		{ key: 'spaeter', titel: 'Weiter draußen' }
	];
	const gruppen = $derived(
		GRUPPEN.map((g) => ({ ...g, eintraege: termine.eintraege.filter((e) => e.bucket === g.key) })).filter((g) => g.eintraege.length)
	);
	const erledigt = $derived(termine.eintraege.filter((e) => e.bucket === 'erledigt').slice().reverse());

	function wann(e) {
		if (e.sofort) return 'sofort';
		if (e.laufend) return 'läuft';
		const n = e.inTagen;
		const c = e.circa ? '~' : '';
		if (n === 0) return c + 'heute';
		if (n === 1) return c + 'morgen';
		if (n === -1) return c + 'gestern';
		if (n < 0) return `${c}seit ${-n} T.`;
		if (e.praefix === 'bis') return `bis ${c}${n} T.`;
		if (e.praefix === 'ab') return `ab ${c}${n} T.`;
		return `${c}in ${n} T.`;
	}
	function datumLabel(isoStr) {
		const [y, m, d] = isoStr.split('-');
		return `${+d}.${+m}.${y}`;
	}
	function titel(e) {
		let t = e.datum ? datumLabel(e.datum) : '';
		if (e.bis) t += ' – ' + datumLabel(e.bis);
		if (e.circa) t = '≈ ' + t;
		return t;
	}

	// Dokument-Links (doc:/absolut) öffnen auf der Platte – wie in Markdown.svelte.
	async function onClick(ev) {
		const link = ev.target.closest && ev.target.closest('.janus-doclink');
		if (!link) return;
		ev.preventDefault();
		try {
			const res = await fetch('/api/open', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ projectId, target: link.getAttribute('data-target'), kind: link.getAttribute('data-kind') })
			});
			const data = await res.json();
			if (!data.ok) console.warn('Öffnen fehlgeschlagen:', data.error);
		} catch (e) {
			console.warn(e);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="termine" onclick={onClick} data-rel={rel}>
	{#if termine.introHtml}
		<div class="intro md">{@html termine.introHtml}</div>
	{/if}

	{#if termine.eintraege.length === 0 && termine.ohneDatum.length === 0}
		<p class="leer">Keine Termine – Listeneinträge mit Datum am Anfang (<code>- **04.09.2026** — …</code>) erscheinen hier sortiert.</p>
	{/if}

	{#each gruppen as g (g.key)}
		<h4 class="grp {g.key}">{g.titel} <span class="n">{g.eintraege.length}</span></h4>
		<ul class="liste">
			{#each g.eintraege as e (e.lauf)}
				<li class="eintrag {g.key}" class:circa={e.circa} class:laufend={e.laufend}>
					<span class="wann" title={titel(e)}>{wann(e)}</span>
					<div class="txt md">{@html e.html}</div>
				</li>
			{/each}
		</ul>
	{/each}

	{#each termine.ohneDatum as s, i (i)}
		<h4 class="grp ohne">{s.titel ?? 'Ohne Datum'} <span class="n">{s.eintraege.length}</span></h4>
		<ul class="liste">
			{#each s.eintraege as e (e.lauf)}
				<li class="eintrag ohne" class:verdaechtig={e.verdaechtig}>
					<div class="txt md">
						{#if e.verdaechtig}
							<span class="warn" title="Der Eintrag beginnt wie eine Datumsangabe, aber Janus versteht sie nicht – absolut schreiben, z. B. **12.09.2026**, **~Mitte September**, **Q1 2027**.">Datum nicht erkannt</span>
						{/if}
						{@html e.html}
					</div>
				</li>
			{/each}
		</ul>
	{/each}

	{#if erledigt.length}
		<details class="erledigt-box">
			<summary>Erledigt <span class="n">{erledigt.length}</span></summary>
			<ul class="liste">
				{#each erledigt as e (e.lauf)}
					<li class="eintrag erledigt">
						<span class="wann" title={titel(e)}>{datumLabel(e.datum)}</span>
						<div class="txt md">{@html e.html}</div>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.termine {
		font-size: 13.5px;
		line-height: 1.45;
	}
	.intro {
		color: var(--text-dim);
		font-size: 12.5px;
		margin-bottom: 6px;
	}
	.intro :global(p) {
		margin: 6px 0;
	}
	.leer {
		color: var(--text-dim);
		font-style: italic;
	}
	.grp {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin: 14px 0 6px;
		font-size: 0.74em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-dim);
	}
	.grp.ueberfaellig {
		color: var(--kat-vorfall);
	}
	.grp.woche {
		color: var(--future);
	}
	.n {
		font-weight: 600;
		opacity: 0.7;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.eintrag {
		display: flex;
		gap: 10px;
		align-items: baseline;
		padding: 6px 0;
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.eintrag:first-child {
		border-top: 0;
	}
	.wann {
		flex: 0 0 auto;
		min-width: 62px;
		font-size: 11.5px;
		font-weight: 700;
		white-space: nowrap;
		color: var(--text-dim);
		font-variant-numeric: tabular-nums;
	}
	.eintrag.ueberfaellig .wann {
		color: var(--kat-vorfall);
	}
	.eintrag.woche .wann {
		color: var(--future);
	}
	.eintrag.laufend .wann {
		color: var(--ok);
	}
	.txt {
		flex: 1 1 auto;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.eintrag.erledigt .txt {
		color: var(--text-dim);
	}
	.warn {
		display: inline-block;
		margin-right: 6px;
		padding: 0 6px;
		border-radius: 6px;
		font-size: 10.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--kat-entscheidung);
		border: 1px solid color-mix(in srgb, var(--kat-entscheidung) 50%, var(--border));
		background: color-mix(in srgb, var(--kat-entscheidung) 12%, transparent);
		cursor: help;
		vertical-align: 1px;
	}
	.erledigt-box {
		margin-top: 14px;
	}
	.erledigt-box summary {
		cursor: pointer;
		font-size: 0.74em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-dim);
	}
</style>
