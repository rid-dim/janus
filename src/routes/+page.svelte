<script>
	import { goto, invalidateAll } from '$app/navigation';
	import ProjectCard from '$lib/components/ProjectCard.svelte';

	let { data } = $props();

	let suchfeld = $state(data.q || '');
	function sucheAbschicken(e) {
		e.preventDefault();
		const q = suchfeld.trim();
		goto(q ? '/?q=' + encodeURIComponent(q) : '/', { keepFocus: true });
	}

	function wannLabel(n) {
		if (n < -1) return `seit ${-n} Tagen überfällig`;
		if (n === -1) return 'seit gestern überfällig';
		if (n === 0) return 'heute';
		if (n === 1) return 'morgen';
		return `in ${n} Tagen`;
	}
	function datumLabel(iso) {
		const [y, m, d] = iso.split('-');
		return `${+d}.${+m}.${y}`;
	}

	let newTitel = $state('');
	let linkPath = $state('');
	let linkTitel = $state('');
	let busy = $state(false);
	let msg = $state(null); // { type: 'error'|'ok', text }

	async function post(url, body) {
		busy = true;
		msg = null;
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const d = await res.json();
			if (!d.ok) throw new Error(d.error || 'Fehlgeschlagen');
			return d;
		} catch (e) {
			msg = { type: 'error', text: String(e.message || e) };
			return null;
		} finally {
			busy = false;
		}
	}

	async function createProject(e) {
		e.preventDefault();
		if (!newTitel.trim()) return;
		const d = await post('/api/create', { titel: newTitel });
		if (d) {
			newTitel = '';
			await invalidateAll();
			if (d.id) goto('/projekt/' + d.id);
		}
	}

	async function linkProject(e) {
		e.preventDefault();
		if (!linkPath.trim()) return;
		const d = await post('/api/link', { path: linkPath, titel: linkTitel });
		if (d) {
			linkPath = '';
			linkTitel = '';
			await invalidateAll();
			if (d.id) goto('/projekt/' + d.id);
		}
	}
</script>

<svelte:head><title>Janus</title></svelte:head>

<div class="container">
	<header class="page-head">
		<div>
			<h1>Projekte</h1>
			<p class="sub">Blick zurück auf den Stand, Blick nach vorn auf die Wege.</p>
		</div>
		<form class="wiki-suche" onsubmit={sucheAbschicken}>
			<input placeholder="Alle Wikis durchsuchen…" bind:value={suchfeld} />
		</form>
	</header>

	{#if data.q}
		<section class="wiki-treffer">
			<h2>Wiki-Suche: „{data.q}" <span class="dim">({data.treffer.length} Treffer)</span>
				<a class="reset" href="/">×</a>
			</h2>
			{#each data.treffer as t (t.projektId + ':' + t.slug)}
				<a class="wt-item" href={'/projekt/' + t.projektId + '/wiki/' + t.slug.split('/').map(encodeURIComponent).join('/')}>
					<span class="wt-badge">{t.projektTitel}</span>
					<span class="wt-titel">{t.title}</span>
					{#if t.snippet}<span class="wt-snippet">{t.snippet}</span>{/if}
				</a>
			{:else}
				<p class="dim">Nichts gefunden.</p>
			{/each}
		</section>
	{/if}

	<details class="actions">
		<summary>+ Projekt anlegen oder verlinken</summary>
		<div class="actions-body">
			<form onsubmit={createProject}>
				<label for="new-titel">Neues Projekt (zentraler Store)</label>
				<div class="row">
					<input id="new-titel" placeholder="Titel, z. B. Website-Relaunch" bind:value={newTitel} />
					<button disabled={busy || !newTitel.trim()}>Anlegen</button>
				</div>
			</form>
			<form onsubmit={linkProject}>
				<label for="link-path">Bestehendes Repo verlinken (In-Repo-Tracking)</label>
				<div class="row">
					<input id="link-path" placeholder="Pfad, z. B. ~/dev/mein-projekt" bind:value={linkPath} />
					<input class="opt" placeholder="Titel (optional)" bind:value={linkTitel} />
					<button disabled={busy || !linkPath.trim()}>Verlinken</button>
				</div>
				<p class="hint">
					Legt bzw. liest <code>{data.projectSubdir}/</code> im Repo. Der Stand wird mit dem Repo
					versioniert &amp; synchronisiert.
				</p>
			</form>
			{#if msg}
				<p class="msg {msg.type}">{msg.text}</p>
			{/if}
		</div>
	</details>

	{#if data.deadlines.length > 0}
		<section class="faellig">
			<h2>Fällig <span class="dim">(nächste 7 Tage)</span></h2>
			{#each data.deadlines as d (d.projektId + ':' + d.knotenId)}
				<a
					class="f-item"
					class:ueberfaellig={d.inTagen < 0}
					href="/projekt/{d.projektId}?knoten={d.knotenId}"
				>
					<span class="f-wann">{wannLabel(d.inTagen)}</span>
					<span class="f-titel">{d.titel}</span>
					<span class="f-badge">{d.projektTitel}</span>
					<span class="f-datum">{datumLabel(d.ende)}</span>
				</a>
			{/each}
		</section>
	{/if}

	{#if data.projects.length === 0}
		<div class="empty">
			<p>Noch keine Projekte.</p>
			<p class="dim">
				Lege oben eines an oder verlinke ein Repo. Zentraler Store:
				<code>{data.dataRoot}</code>. Format siehe <code>FORMAT.md</code>.
			</p>
		</div>
	{:else}
		<div class="grid">
			{#each data.projects as project (project.id)}
				<ProjectCard {project} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.page-head {
		margin-bottom: 18px;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.wiki-suche input {
		width: 260px;
		max-width: 100%;
		padding: 7px 12px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 13.5px;
	}
	.faellig {
		margin-bottom: 22px;
	}
	.faellig h2 {
		font-size: 15px;
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.f-item {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 7px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		margin-bottom: 8px;
		text-decoration: none;
		color: var(--text);
	}
	.f-item:hover {
		border-color: var(--accent);
	}
	.f-wann {
		flex: none;
		min-width: 96px;
		font-size: 12px;
		font-weight: 700;
		color: var(--future);
	}
	.f-item.ueberfaellig {
		border-color: color-mix(in srgb, var(--kat-vorfall) 45%, var(--border));
	}
	.f-item.ueberfaellig .f-wann {
		color: var(--kat-vorfall);
	}
	.f-titel {
		font-weight: 600;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.f-badge {
		flex: none;
		font-size: 11px;
		font-weight: 700;
		padding: 1px 8px;
		border-radius: 99px;
		background: var(--surface-2);
		color: var(--text-dim);
	}
	.f-datum {
		flex: none;
		margin-left: auto;
		font-size: 12px;
		color: var(--text-dim);
		font-variant-numeric: tabular-nums;
	}

	.wiki-treffer {
		margin-bottom: 22px;
	}
	.wiki-treffer h2 {
		font-size: 15px;
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.wiki-treffer .reset {
		text-decoration: none;
		color: var(--text-dim);
		font-weight: 700;
	}
	.wt-item {
		display: block;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		margin-bottom: 8px;
		text-decoration: none;
	}
	.wt-item:hover {
		border-color: var(--accent);
	}
	.wt-badge {
		display: inline-block;
		font-size: 11px;
		font-weight: 700;
		padding: 1px 8px;
		border-radius: 99px;
		background: var(--surface-2);
		color: var(--text-dim);
		margin-right: 8px;
	}
	.wt-titel {
		font-weight: 600;
		color: var(--text);
	}
	.wt-snippet {
		display: block;
		font-size: 12.5px;
		color: var(--text-dim);
		margin-top: 2px;
	}
	.dim {
		color: var(--text-dim);
	}
	.page-head h1 {
		margin: 0 0 2px;
		font-size: 1.7em;
	}
	.sub {
		margin: 0;
		color: var(--text-dim);
	}
	.actions {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		margin-bottom: 22px;
	}
	.actions summary {
		cursor: pointer;
		padding: 12px 16px;
		font-weight: 600;
		color: var(--text-dim);
		user-select: none;
	}
	.actions-body {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 4px 16px 16px;
	}
	.actions label {
		display: block;
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 6px;
	}
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.actions input {
		flex: 1;
		min-width: 180px;
		padding: 8px 11px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
	}
	.actions input.opt {
		flex: 0 1 160px;
	}
	.actions button {
		padding: 8px 16px;
		border: 1px solid var(--accent);
		border-radius: 8px;
		background: var(--accent);
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.actions button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.hint {
		margin: 8px 0 0;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.msg {
		margin: 0;
		font-size: 13px;
	}
	.msg.error {
		color: #d1495b;
	}
	.msg.ok {
		color: var(--ok);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}
	.empty {
		padding: 40px;
		text-align: center;
		background: var(--surface);
		border: 1px dashed var(--border);
		border-radius: var(--radius);
	}
	.dim {
		color: var(--text-dim);
		font-size: 14px;
	}
</style>
