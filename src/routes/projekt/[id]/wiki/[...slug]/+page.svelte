<script>
	import { goto, invalidateAll } from '$app/navigation';
	import Markdown from '$lib/components/Markdown.svelte';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import { postJSON } from '$lib/client/api.js';

	let { data } = $props();
	const base = $derived(`/projekt/${data.id}/wiki`);

	let editing = $state(false);
	let bodyEdit = $state(false);
	let busy = $state(false);
	let msg = $state(null);
	let neueSeite = $state('');
	let suchfeld = $state(data.q || '');
	// Beim Seitenwechsel Editor schließen, Suchfeld mit URL synchron halten.
	$effect(() => {
		void data.page?.slug;
		bodyEdit = false;
	});
	$effect(() => {
		suchfeld = data.q || '';
	});

	// --- eingeklappte Ordner (pro Projekt gemerkt) ---------------------------
	let zu = $state({});
	$effect(() => {
		try {
			zu = JSON.parse(localStorage.getItem('janus:wiki-zu:' + data.id) || '{}');
		} catch {
			zu = {};
		}
	});
	function toggleOrdner(pfad) {
		zu = { ...zu, [pfad]: !zu[pfad] };
		try {
			localStorage.setItem('janus:wiki-zu:' + data.id, JSON.stringify(zu));
		} catch {
			/* ignore */
		}
	}

	let pflegeOffen = $state(false);

	function flash(type, text) {
		msg = { type, text };
		if (type === 'ok') setTimeout(() => (msg = null), 2200);
	}
	async function run(fn, okText) {
		busy = true;
		msg = null;
		try {
			await fn();
			await invalidateAll();
			if (okText) flash('ok', okText);
			return true;
		} catch (e) {
			flash('error', String(e.message || e));
			return false;
		} finally {
			busy = false;
		}
	}

	function speichern(text) {
		run(() => postJSON('/api/save-body', { projectId: data.id, rel: data.page.rel, body: text }), 'Gespeichert').then(
			(ok) => ok && (bodyEdit = false)
		);
	}
	async function anlegen(slug, title) {
		const ok = await run(
			() => postJSON('/api/create-doc', { projectId: data.id, kind: 'wissen', title, slug }),
			'Seite angelegt'
		);
		if (ok) {
			await goto(base + '/' + (slug || '').split('/').map(encodeURIComponent).join('/') || base);
			bodyEdit = true;
		}
	}
	function neueSeiteAnlegen() {
		if (!neueSeite.trim()) return;
		const titel = neueSeite.trim();
		neueSeite = '';
		anlegen('', titel).then(() => goto(base));
	}
	function loeschen() {
		if (!confirm(`„${data.page.title}" wirklich löschen?\n(${data.page.rel})`)) return;
		run(() => postJSON('/api/delete-doc', { projectId: data.id, rel: data.page.rel }), 'Gelöscht').then(
			(ok) => ok && goto(base)
		);
	}
	function stempeln() {
		run(
			() => postJSON('/api/node-meta', { projectId: data.id, rel: data.page.rel, patch: { geprueft: data.heute } }),
			'Als geprüft gestempelt'
		);
	}
	function suchen(e) {
		e.preventDefault();
		const q = suchfeld.trim();
		goto(base + (data.page ? '/' + data.page.slug : '') + (q ? '?q=' + encodeURIComponent(q) : ''), {
			keepFocus: true
		});
	}
	const wikiHref = (slug) => base + '/' + slug.split('/').map(encodeURIComponent).join('/');
	const abgestandenTage = (iso) => Math.round((new Date(data.heute) - new Date(iso)) / 86400000);
</script>

{#snippet hubEbene(node, hubId)}
	{#each node.ordner as o (o.name)}
		<div class="ordner">
			<div class="ordner-kopf statisch">{o.name}</div>
			<div class="ordner-inhalt">
				{@render hubEbene(o, hubId)}
			</div>
		</div>
	{/each}
	{#each node.seiten as s (s.slug)}
		<a class="seite hub-seite" href={'/projekt/' + hubId + '/wiki/' + s.slug.split('/').map(encodeURIComponent).join('/')} title="öffnet im Hub-Projekt {hubId}">{s.title}</a>
	{/each}
{/snippet}

{#snippet baumEbene(node, pfad)}
	{#each node.ordner as o (o.name)}
		<div class="ordner">
			<button class="ordner-kopf" onclick={() => toggleOrdner(pfad + o.name)} aria-expanded={!zu[pfad + o.name]}>
				<span class="chev">{zu[pfad + o.name] ? '▸' : '▾'}</span>{o.name}
			</button>
			{#if !zu[pfad + o.name]}
				<div class="ordner-inhalt">
					{@render baumEbene(o, pfad + o.name + '/')}
				</div>
			{/if}
		</div>
	{/each}
	{#each node.seiten as s (s.slug)}
		<a class="seite" class:active={s.slug === data.page?.slug} href={wikiHref(s.slug)}>{s.title}</a>
	{/each}
{/snippet}

<svelte:head><title>{data.titel} · Wiki · Janus</title></svelte:head>

<div class="wiki-layout">
	<aside class="sidebar">
		<div class="sidebar-head">
			<a class="sidebar-title" href={base}>Wiki</a>
			<span class="anzahl">{data.anzahl} Seiten</span>
		</div>

		<form class="suche" onsubmit={suchen}>
			<input placeholder="Wissen durchsuchen…" bind:value={suchfeld} />
		</form>

		<nav class="baum">
			{#if data.anzahl === 0 && !data.hubs.length}
				<p class="dim">Noch kein Wissen hinterlegt (lege Dateien in <code>wissen/</code> an).</p>
			{:else}
				{@render baumEbene(data.baum, '')}
			{/if}

			{#each data.hubs as hub (hub.id)}
				<section class="hub">
					<button class="ordner-kopf hub-kopf" onclick={() => toggleOrdner('hub:' + hub.id)} aria-expanded={!zu['hub:' + hub.id]}>
						<span class="chev">{zu['hub:' + hub.id] ? '▸' : '▾'}</span>
						aus {hub.titel}
						<span class="hub-badge" title="Wissens-Hub: read-only eingeblendet, bearbeitet wird im Hub-Projekt">{hub.anzahl}</span>
					</button>
					{#if !zu['hub:' + hub.id]}
						<div class="ordner-inhalt hub-inhalt">
							{@render hubEbene(hub.baum, hub.id)}
						</div>
					{/if}
				</section>
			{/each}
		</nav>

		{#if editing}
			<form class="add-row" onsubmit={(e) => (e.preventDefault(), neueSeiteAnlegen())}>
				<input placeholder="Neue Seite – Titel…" bind:value={neueSeite} />
				<button class="btn" disabled={busy || !neueSeite.trim()}>+</button>
			</form>
		{/if}

		{#if data.pflege.rot.length || data.pflege.waisen.length || data.pflege.abgestanden.length || data.kollisionen.length}
			<section class="pflege" class:offen={pflegeOffen}>
				<button class="pflege-kopf" onclick={() => (pflegeOffen = !pflegeOffen)} aria-expanded={pflegeOffen}>
					<span class="chev">{pflegeOffen ? '▾' : '▸'}</span>
					Pflege
					<span class="pflege-zahlen">
						{#if data.kollisionen.length}<span class="altzahl" title="Slug-Kollisionen mit einem Wissens-Hub">⚠ {data.kollisionen.length}</span>{/if}
						{#if data.pflege.rot.length}<span class="rotzahl" title="Rotlinks: verlinkte Seiten, die noch fehlen">{data.pflege.rot.length}</span>{/if}
						{#if data.pflege.abgestanden.length}<span class="altzahl" title="Abgestandene Seiten (geprüft vor > 6 Monaten)">{data.pflege.abgestanden.length}</span>{/if}
					</span>
				</button>
				{#if pflegeOffen}
					<div class="pflege-inhalt">
						{#if data.kollisionen.length}
							<h4>Slug-Kollision mit Hub</h4>
							{#each data.kollisionen as k (k.slug)}
								<a class="kollision" href={wikiHref(k.slug)} title="Lokale Seite überdeckt die gleichnamige Hub-Seite (lokal gewinnt)">{k.slug} <span class="dim">↔ {k.hub}</span></a>
							{/each}
						{/if}
						{#if data.pflege.rot.length}
							<h4>Gewünschte Seiten</h4>
							{#each data.pflege.rot as r (r.slug)}
								<a class="rotlink" href={wikiHref(r.slug)} title="{r.quellen}× verlinkt – Klick legt die Seite an">{r.slug} <span class="dim">({r.quellen}×)</span></a>
							{/each}
						{/if}
						{#if data.pflege.abgestanden.length}
							<h4>Abgestanden</h4>
							{#each data.pflege.abgestanden as a (a.slug)}
								<a class="altlink" href={wikiHref(a.slug)}>{a.title} <span class="dim">({a.geprueft})</span></a>
							{/each}
						{/if}
						{#if data.pflege.waisen.length}
							<h4>Ohne eingehende Links</h4>
							{#each data.pflege.waisen as w (w.slug)}
								<a class="waise" href={wikiHref(w.slug)}>{w.title}</a>
							{/each}
						{/if}
						{#if data.pflege.ungeprueft}
							<p class="dim klein">{data.pflege.ungeprueft} Seiten ohne <code>geprueft:</code>-Stempel</p>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		<div class="sidebar-fuss">
			<a class="side-item" href="/">← Alle Projekte</a>
		</div>
	</aside>

	<div class="wiki-main">
		<div class="proj-head">
			<a href="/projekt/{data.id}" class="back">← Projekt</a>
			<h1>{data.titel}</h1>
			<span class="pill status-{(data.status || '').replace(/\s+/g, '-')}">{data.status}</span>
			<nav class="viewtabs">
				<a class="vtab" href="/projekt/{data.id}">Projekt</a>
				<span class="vtab on">Wiki</span>
				<a class="vtab" href="/projekt/{data.id}/zeit">Zeitleiste</a>
			</nav>
			<div class="head-actions">
				{#if msg}<span class="msg {msg.type}">{msg.text}</span>{/if}
				<button class="btn" class:on={editing} onclick={() => { editing = !editing; if (!editing) bodyEdit = false; }}>
					{editing ? '✓ Fertig' : '✎ Bearbeiten'}
				</button>
			</div>
		</div>

		<div class="wiki-scroll">
			{#if data.q}
				<section class="treffer">
					<h2>Suche: „{data.q}" <span class="dim">({data.treffer.length} Treffer)</span></h2>
					{#each data.treffer as t (t.slug)}
						<a class="treffer-item" href={wikiHref(t.slug)}>
							<span class="treffer-titel">{t.title}</span>
							{#if t.snippet}<span class="treffer-snippet">{t.snippet}</span>{/if}
						</a>
					{:else}
						<p class="dim">Nichts gefunden.</p>
					{/each}
				</section>
			{/if}

			{#if data.fehlt}
				<article class="page fehlt">
					<h2>„{data.fehlt}" gibt es noch nicht</h2>
					<p class="dim">
						Ein Rotlink zeigt hierher – die Seite <code>wissen/{data.fehlt}.md</code> existiert noch nicht.
					</p>
					{#if data.fehltHub}
						<p>
							Aber ein Wissens-Hub kennt sie:
							<a href={data.fehltHub.href}>im Hub „{data.fehltHub.hub}" öffnen →</a>
						</p>
					{/if}
					<button class="btn primary" disabled={busy} onclick={() => anlegen(data.fehlt, data.fehlt.split('/').pop().replace(/[-_]/g, ' '))}>
						Seite {data.fehltHub ? 'trotzdem lokal' : 'jetzt'} anlegen
					</button>
				</article>
			{:else if data.page}
				<article class="page">
					<header class="page-kopf">
						<h2>{data.page.title}</h2>
						<span class="grow"></span>
						{#if data.page.geprueft}
							<span class="geprueft" class:alt={abgestandenTage(data.page.geprueft) > 180} title="Zuletzt inhaltlich bestätigt">
								✓ geprüft {data.page.geprueft}
							</span>
						{/if}
						{#if editing}
							<button class="btn klein" disabled={busy} onclick={stempeln} title="geprueft: auf heute setzen">Heute geprüft</button>
							<button class="btn klein" disabled={busy} onclick={() => (bodyEdit = !bodyEdit)}>{bodyEdit ? 'Vorschau' : '✎ Text'}</button>
							<button class="btn klein danger" disabled={busy} onclick={loeschen}>Löschen</button>
						{/if}
					</header>
					{#if bodyEdit}
						<MarkdownEditor value={data.page.body} {busy} onsave={speichern} oncancel={() => (bodyEdit = false)} />
					{:else}
						<Markdown html={data.page.html} projectId={data.id} rel={data.page.rel} />
					{/if}

					{#if data.page.backlinks.length}
						<footer class="backlinks">
							<h3>Verwiesen von</h3>
							{#each data.page.backlinks as b (b.wo + ':' + (b.projektId ?? '') + ':' + b.von)}
								{#if b.wo === 'wissen'}
									<a class="backlink" href={wikiHref(b.von)}>{b.titel}</a>
								{:else if b.wo === 'projekt'}
									<a
										class="backlink extern"
										href={b.von.endsWith('.md')
											? '/projekt/' + b.projektId
											: '/projekt/' + b.projektId + '/wiki/' + b.von.split('/').map(encodeURIComponent).join('/')}
										title="aus Projekt {b.projektTitel}"
									>{b.titel} <span class="dim">({b.projektTitel})</span></a>
								{:else}
									<a class="backlink extern" href="/projekt/{data.id}" title={b.von}>{b.titel} <span class="dim">({b.wo})</span></a>
								{/if}
							{/each}
						</footer>
					{/if}
				</article>
			{:else if !data.q}
				<p class="dim leer">
					Noch keine Wissens-Seiten. Lege Markdown-Dateien in <code>wissen/</code> an
					oder nutze „✎ Bearbeiten" → „+ Neue Seite".
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.wiki-layout {
		display: flex;
		min-height: calc(100vh - 54px);
	}
	.sidebar {
		width: 250px;
		flex: 0 0 250px;
		border-right: 1px solid var(--border);
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 10px;
		overflow-y: auto;
	}
	.sidebar-head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 0 6px 4px;
	}
	.sidebar-title {
		font-weight: 700;
		color: var(--text);
		text-decoration: none;
	}
	.anzahl {
		font-size: 11.5px;
		color: var(--text-dim);
	}
	.suche input {
		width: 100%;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 13px;
	}
	.baum {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
	}
	.ordner-kopf {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 4px 6px;
		border: 0;
		background: none;
		color: var(--text-dim);
		font: inherit;
		font-size: 12.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		cursor: pointer;
		text-align: left;
	}
	.ordner-inhalt {
		margin-left: 10px;
		border-left: 1px solid var(--border);
		padding-left: 6px;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.chev {
		font-size: 10px;
		width: 12px;
	}
	.seite {
		display: block;
		padding: 4px 8px;
		border-radius: 7px;
		color: var(--text);
		text-decoration: none;
		font-size: 13.5px;
	}
	.seite:hover {
		background: var(--surface-2);
	}
	.seite.active {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
		font-weight: 600;
	}
	.add-row {
		display: flex;
		gap: 6px;
	}
	.add-row input {
		flex: 1;
		min-width: 0;
		padding: 5px 9px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 13px;
	}
	.pflege {
		border-top: 1px solid var(--border);
		padding-top: 6px;
	}
	.pflege-kopf {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 4px 6px;
		border: 0;
		background: none;
		color: var(--text-dim);
		font: inherit;
		font-size: 12.5px;
		font-weight: 700;
		cursor: pointer;
	}
	.pflege-zahlen {
		margin-left: auto;
		display: flex;
		gap: 4px;
	}
	.rotzahl,
	.altzahl {
		font-size: 11px;
		padding: 0 6px;
		border-radius: 99px;
		font-weight: 700;
	}
	.rotzahl {
		background: color-mix(in srgb, #d33 18%, transparent);
		color: #d33;
	}
	.altzahl {
		background: color-mix(in srgb, #c80 18%, transparent);
		color: #c80;
	}
	.pflege-inhalt {
		padding: 2px 6px 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.pflege-inhalt h4 {
		margin: 6px 0 2px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-dim);
	}
	.hub {
		margin-top: 8px;
		border-top: 1px dashed var(--border);
		padding-top: 4px;
	}
	.hub-kopf {
		text-transform: none;
		letter-spacing: 0;
	}
	.hub-badge {
		margin-left: auto;
		font-size: 10.5px;
		padding: 0 6px;
		border-radius: 99px;
		background: var(--surface-2);
		color: var(--text-dim);
	}
	.hub-seite {
		color: var(--text-dim);
		font-style: italic;
	}
	.ordner-kopf.statisch {
		cursor: default;
	}
	.kollision {
		font-size: 12.5px;
		text-decoration: none;
		padding: 2px 4px;
		border-radius: 5px;
		color: #c80;
	}
	.kollision:hover {
		background: var(--surface-2);
	}
	.rotlink,
	.altlink,
	.waise {
		font-size: 12.5px;
		text-decoration: none;
		padding: 2px 4px;
		border-radius: 5px;
	}
	.rotlink {
		color: #d33;
	}
	.altlink {
		color: #c80;
	}
	.waise {
		color: var(--text-dim);
	}
	.rotlink:hover,
	.altlink:hover,
	.waise:hover {
		background: var(--surface-2);
	}
	.sidebar-fuss {
		border-top: 1px solid var(--border);
		padding-top: 8px;
	}
	.side-item {
		color: var(--text-dim);
		text-decoration: none;
		font-size: 13px;
		padding: 2px 6px;
	}

	.wiki-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.proj-head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 20px 10px;
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}
	.proj-head h1 {
		margin: 0;
		font-size: 20px;
	}
	.back {
		color: var(--text-dim);
		text-decoration: none;
		font-size: 13px;
	}
	.head-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.msg {
		font-size: 12.5px;
	}
	.msg.error {
		color: #d33;
	}
	.msg.ok {
		color: var(--accent);
	}
	.btn {
		padding: 5px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.btn.on,
	.btn.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #fff;
	}
	.btn.klein {
		padding: 3px 9px;
		font-size: 12px;
	}
	.btn.danger {
		color: #d33;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.wiki-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 18px 24px 40px;
	}
	.page {
		max-width: 820px;
		margin: 0 auto;
	}
	.page-kopf {
		display: flex;
		align-items: center;
		gap: 8px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 8px;
		margin-bottom: 10px;
	}
	.page-kopf h2 {
		margin: 0;
		font-size: 22px;
	}
	.grow {
		flex: 1;
	}
	.geprueft {
		font-size: 12px;
		color: var(--accent);
		white-space: nowrap;
	}
	.geprueft.alt {
		color: #c80;
	}
	.backlinks {
		margin-top: 28px;
		border-top: 1px solid var(--border);
		padding-top: 10px;
	}
	.backlinks h3 {
		margin: 0 0 6px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-dim);
	}
	.backlink {
		display: inline-block;
		margin: 0 8px 4px 0;
		padding: 3px 10px;
		border: 1px solid var(--border);
		border-radius: 99px;
		font-size: 12.5px;
		text-decoration: none;
		color: var(--text);
	}
	.backlink:hover {
		border-color: var(--accent);
	}
	.treffer {
		max-width: 820px;
		margin: 0 auto 24px;
	}
	.treffer h2 {
		font-size: 16px;
	}
	.treffer-item {
		display: block;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		margin-bottom: 8px;
		text-decoration: none;
	}
	.treffer-item:hover {
		border-color: var(--accent);
	}
	.treffer-titel {
		display: block;
		font-weight: 600;
		color: var(--text);
	}
	.treffer-snippet {
		display: block;
		font-size: 12.5px;
		color: var(--text-dim);
		margin-top: 2px;
	}
	.dim {
		color: var(--text-dim);
	}
	.klein {
		font-size: 12px;
	}
	.leer {
		max-width: 820px;
		margin: 24px auto;
	}
	.fehlt h2 {
		margin-top: 0;
	}
</style>
