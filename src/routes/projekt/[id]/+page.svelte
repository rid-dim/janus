<script>
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import Markdown from '$lib/components/Markdown.svelte';
	import Dag from '$lib/components/Dag.svelte';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import NodeMeta from '$lib/components/NodeMeta.svelte';
	import { postJSON } from '$lib/client/api.js';

	let { data } = $props();
	const p = $derived(data.project);
	const projects = $derived(data.projects ?? []);

	// --- collapsible project sidebar (global preference) -----------------------
	let sidebarCollapsed = $state(false);
	let railCollapsed = $state(false);
	onMount(() => {
		try {
			sidebarCollapsed = localStorage.getItem('janus.sidebar') === '1';
			railCollapsed = localStorage.getItem('janus.rail') === '1';
		} catch {
			/* ignore */
		}
	});
	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
		try {
			localStorage.setItem('janus.sidebar', sidebarCollapsed ? '1' : '0');
		} catch {
			/* ignore */
		}
	}
	function toggleRail() {
		railCollapsed = !railCollapsed;
		try {
			localStorage.setItem('janus.rail', railCollapsed ? '1' : '0');
		} catch {
			/* ignore */
		}
	}

	// stand docs with `pin: right` in frontmatter render as a right-hand rail
	// (e.g. a chronicle / decision log kept always in view); the rest stay inline.
	const railStand = $derived((p.stand ?? []).filter((s) => s.pin === 'right'));
	const mainStand = $derived((p.stand ?? []).filter((s) => s.pin !== 'right'));
	const globalIndex = (sec) => p.stand.findIndex((s) => s.id === sec.id);

	// --- Rail-Tabs: bei mehreren gepinnten Dokumenten wird nur eines gezeigt ---
	const railKey = (id) => 'janus:rail-tab:' + id;
	let railTab = $state(null); // id der gewählten stand-Datei
	// Auswahl wiederherstellen (nur im Browser) bzw. auf die erste Datei fallen.
	$effect(() => {
		const ids = railStand.map((s) => s.id);
		if (ids.length === 0) {
			railTab = null;
			return;
		}
		if (railTab && ids.includes(railTab)) return;
		let gemerkt = null;
		if (typeof localStorage !== 'undefined') {
			try {
				gemerkt = localStorage.getItem(railKey(p.id));
			} catch {
				/* ignore */
			}
		}
		railTab = gemerkt && ids.includes(gemerkt) ? gemerkt : ids[0];
	});
	function waehleRailTab(id) {
		railTab = id;
		try {
			localStorage.setItem(railKey(p.id), id);
		} catch {
			/* ignore */
		}
	}
	const railAktiv = $derived(railStand.find((s) => s.id === railTab) ?? railStand[0] ?? null);

	// --- Knotenauswahl (geplant + Archiv) --------------------------------------
	const archivNodes = $derived(p.abgeschlossen ?? []);
	const alleNodes = $derived([...p.geplant.nodes, ...archivNodes]);

	// Archiv-Sektion ist standardmäßig eingeklappt.
	let archivOffen = $state(false);

	let selectedId = $state(data.knoten ?? data.project.geplant.nodes[0]?.id ?? null);
	// Deep-Link ?knoten=… (aus der Zeitleiste) übernehmen, sobald er sich ändert.
	let letzterDeepLink = null;
	$effect(() => {
		const k = data.knoten;
		if (k && k !== letzterDeepLink) {
			letzterDeepLink = k;
			selectedId = k;
			if (archivNodes.some((n) => n.id === k)) archivOffen = true;
		}
	});
	$effect(() => {
		const ids = new Set(alleNodes.map((n) => n.id));
		if (!ids.has(selectedId)) selectedId = p.geplant.nodes[0]?.id ?? archivNodes[0]?.id ?? null;
	});
	const selectedNode = $derived(alleNodes.find((n) => n.id === selectedId) ?? null);

	// --- edit mode -------------------------------------------------------------
	let editing = $state(false);
	let settingsOpen = $state(false);
	let bodyEditRel = $state(null); // rel-path of the doc whose body is being edited
	let busy = $state(false);
	let msg = $state(null); // { type: 'error'|'ok', text }
	let newSection = $state('');
	let newNode = $state('');

	// project-settings drafts (initialised when the panel opens)
	let sTitel = $state('');
	let sStatus = $state('');
	let sTags = $state('');
	let sBeschreibung = $state('');
	const STATUS_OPTS = ['aktiv', 'in-arbeit', 'fertig'];

	function flash(type, text) {
		msg = { type, text };
		if (type === 'ok') setTimeout(() => (msg = null), 2200);
	}
	async function refresh() {
		await invalidateAll();
	}

	function toggleEditing() {
		editing = !editing;
		if (!editing) {
			bodyEditRel = null;
			settingsOpen = false;
		}
	}
	function openSettings() {
		sTitel = p.titel ?? '';
		sStatus = p.status ?? '';
		sTags = (p.tags ?? []).join(', ');
		sBeschreibung = p.beschreibung ?? '';
		settingsOpen = !settingsOpen;
	}

	async function run(fn, okText) {
		busy = true;
		msg = null;
		try {
			await fn();
			await refresh();
			if (okText) flash('ok', okText);
			return true;
		} catch (e) {
			flash('error', String(e.message || e));
			return false;
		} finally {
			busy = false;
		}
	}

	function saveBody(rel, text) {
		run(() => postJSON('/api/save-body', { projectId: p.id, rel, body: text }), 'Gespeichert').then(
			(ok) => ok && (bodyEditRel = null)
		);
	}
	function createSection() {
		if (!newSection.trim()) return;
		run(() => postJSON('/api/create-doc', { projectId: p.id, kind: 'stand', title: newSection }), 'Sektion angelegt').then(
			(ok) => ok && (newSection = '')
		);
	}
	async function createNode() {
		if (!newNode.trim()) return;
		busy = true;
		msg = null;
		try {
			const d = await postJSON('/api/create-doc', { projectId: p.id, kind: 'geplant', title: newNode });
			newNode = '';
			await refresh();
			selectedId = d.id;
			flash('ok', 'Knoten angelegt');
		} catch (e) {
			flash('error', String(e.message || e));
		} finally {
			busy = false;
		}
	}
	function removeDoc(rel, label) {
		if (!confirm(`„${label}" wirklich löschen?\n(${rel})`)) return;
		run(() => postJSON('/api/delete-doc', { projectId: p.id, rel }), 'Gelöscht').then(
			(ok) => ok && bodyEditRel === rel && (bodyEditRel = null)
		);
	}
	function moveSection(i, dir) {
		const ids = p.stand.map((s) => s.id);
		const j = i + dir;
		if (j < 0 || j >= ids.length) return;
		[ids[i], ids[j]] = [ids[j], ids[i]];
		run(() => postJSON('/api/project-meta', { projectId: p.id, patch: { stand_reihenfolge: ids } }));
	}
	const STATUS_CYCLE = ['offen', 'in-arbeit', 'fertig'];
	function advanceStatus(id) {
		const node = alleNodes.find((n) => n.id === id);
		if (!node) return;
		const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(node.status) + 1) % STATUS_CYCLE.length];
		run(() => postJSON('/api/node-meta', { projectId: p.id, rel: node.rel, patch: { status: next } }), 'Status: ' + next);
	}
	function saveSettings() {
		const patch = {
			titel: sTitel,
			status: sStatus,
			beschreibung: sBeschreibung,
			tags: sTags.split(',').map((t) => t.trim()).filter(Boolean)
		};
		run(() => postJSON('/api/project-meta', { projectId: p.id, patch }), 'Projekt aktualisiert').then(
			(ok) => ok && (settingsOpen = false)
		);
	}

	// --- resizable panes -------------------------------------------------------
	const DEFAULT_LEFT = 0.46; // width share of the "Aktueller Stand" pane
	const DEFAULT_TOP = 0.55; // height share of the DAG within the "Geplant" pane
	let leftFrac = $state(DEFAULT_LEFT);
	let futureTopFrac = $state(DEFAULT_TOP);
	let splitEl = $state(null);
	let futureBodyEl = $state(null);

	const layoutKey = (id) => 'janus.layout.' + id;

	// Load the stored split positions for THIS project – and reload them whenever
	// we navigate to another project (the page component is reused across ids).
	$effect(() => {
		const id = p.id;
		let left = DEFAULT_LEFT;
		let top = DEFAULT_TOP;
		try {
			const saved = JSON.parse(localStorage.getItem(layoutKey(id)) || '{}');
			if (typeof saved.leftFrac === 'number') left = saved.leftFrac;
			if (typeof saved.futureTopFrac === 'number') top = saved.futureTopFrac;
		} catch {
			/* ignore */
		}
		leftFrac = left;
		futureTopFrac = top;
	});
	function persist() {
		try {
			localStorage.setItem(layoutKey(p.id), JSON.stringify({ leftFrac, futureTopFrac }));
		} catch {
			/* ignore */
		}
	}
	function drag(getFrac, setFrac) {
		document.body.style.userSelect = 'none';
		function move(ev) {
			setFrac(Math.min(0.85, Math.max(0.15, getFrac(ev))));
		}
		function up() {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			document.body.style.userSelect = '';
			persist();
		}
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}
	function startColDrag(e) {
		e.preventDefault();
		const rect = splitEl.getBoundingClientRect();
		drag((ev) => (ev.clientX - rect.left) / rect.width, (f) => (leftFrac = f));
	}
	function startRowDrag(e) {
		e.preventDefault();
		const rect = futureBodyEl.getBoundingClientRect();
		drag((ev) => (ev.clientY - rect.top) / rect.height, (f) => (futureTopFrac = f));
	}
	function resetCols() {
		leftFrac = 0.46;
		persist();
	}
	function resetRows() {
		futureTopFrac = 0.55;
		persist();
	}
</script>

<svelte:head><title>{p.titel} · Janus</title></svelte:head>

<div class="proj-layout">
	<aside class="sidebar" class:collapsed={sidebarCollapsed}>
		<div class="sidebar-head">
			<button class="tb" title={sidebarCollapsed ? 'Projekte einblenden' : 'Einklappen'} onclick={toggleSidebar}>
				{sidebarCollapsed ? '»' : '«'}
			</button>
			{#if !sidebarCollapsed}<a class="sidebar-title" href="/">Projekte</a>{/if}
		</div>
		{#if !sidebarCollapsed}
			<nav class="sidebar-nav">
				{#each projects as pr (pr.id)}
					<a class="side-item" class:active={pr.id === p.id} href="/projekt/{pr.id}" title={pr.titel}>
						<span class="side-name">{pr.titel}</span>
						<span class="dot status-{(pr.status || '').replace(/\s+/g, '-')}" title={pr.status}></span>
					</a>
				{/each}
			</nav>
		{/if}
	</aside>

	<div class="proj-main">
		<div class="proj-head">
			<a href="/" class="back">← Projekte</a>
		<h1>{p.titel}</h1>
		<span class="pill status-{(p.status || '').replace(/\s+/g, '-')}">{p.status}</span>
		<nav class="viewtabs">
			<span class="vtab on">Projekt</span>
			<a class="vtab" href="/projekt/{p.id}/wiki" title="Wissensbasis: wissen/-Seiten mit Wikilinks und Backlinks">Wiki{#if p.wissenAnzahl}&nbsp;({p.wissenAnzahl}){/if}</a>
			<a class="vtab" href="/projekt/{p.id}/zeit" title="Chronik als Aktivitätsstreifen + Themen-Gantt">Zeitleiste</a>
		</nav>
		{#if p.tags?.length}
			<span class="tags">{#each p.tags as t}<span class="tag">{t}</span>{/each}</span>
		{/if}
		<span class="loc" title={p.location}>
			{p.source === 'linked' ? '⎇ im Repo:' : '▦ Store:'} {p.location}
		</span>
		<div class="head-actions">
			{#if editing}
				<button class="btn" onclick={openSettings}>⚙ Projekt</button>
			{/if}
			<button class="btn" class:on={editing} onclick={toggleEditing}>
				{editing ? '✓ Fertig' : '✎ Bearbeiten'}
			</button>
		</div>
	</div>

	{#if editing && settingsOpen}
		<div class="settings">
			<div class="settings-grid">
				<label class="fld grow"><span>Titel</span><input bind:value={sTitel} /></label>
				<label class="fld"
					><span>Status</span>
					<select bind:value={sStatus}>
						{#each STATUS_OPTS as s}<option value={s}>{s}</option>{/each}
						{#if !STATUS_OPTS.includes(sStatus)}<option value={sStatus}>{sStatus}</option>{/if}
					</select>
				</label>
				<label class="fld grow"><span>Tags (kommagetrennt)</span><input bind:value={sTags} /></label>
			</div>
			<label class="fld"><span>Beschreibung</span><input bind:value={sBeschreibung} /></label>
			<div class="settings-actions">
				<button class="btn primary" disabled={busy} onclick={saveSettings}>Speichern</button>
				<button class="btn" disabled={busy} onclick={() => (settingsOpen = false)}>Schließen</button>
			</div>
		</div>
	{/if}

	<div class="split" bind:this={splitEl}>
		<!-- Blick zurück: aktueller Stand -->
		<section class="pane pane-past" style="flex:{leftFrac}">
			<h2 class="pane-title">
				Aktueller Stand
				<span class="grow"></span>
			</h2>
			<div class="pane-scroll">
				{#if editing}
					<form class="add-row" onsubmit={(e) => (e.preventDefault(), createSection())}>
						<input placeholder="Neue Sektion – Titel…" bind:value={newSection} />
						<button class="btn" disabled={busy || !newSection.trim()}>+ Sektion</button>
					</form>
				{/if}
				{#if mainStand.length === 0}
					<p class="dim">Noch kein Stand hinterlegt (lege Dateien in <code>stand/</code> an).</p>
				{/if}
				{#each mainStand as sec (sec.id)}
					{@render standCard(sec, true)}
				{/each}
			</div>
		</section>

		<div class="gutter gutter-col" title="Breite ziehen · Doppelklick setzt zurück" onpointerdown={startColDrag} ondblclick={resetCols}></div>

		<!-- Blick nach vorn: geplant -->
		<section class="pane pane-future" style="flex:{1 - leftFrac}">
			<h2 class="pane-title">
				Geplant
				<span class="grow"></span>
			</h2>
			<div class="future-body" bind:this={futureBodyEl}>
				<div class="future-top" style="flex:{futureTopFrac}">
					{#if editing}
						<form class="add-row" onsubmit={(e) => (e.preventDefault(), createNode())}>
							<input placeholder="Neuer Knoten – Titel…" bind:value={newNode} />
							<button class="btn" disabled={busy || !newNode.trim()}>+ Knoten</button>
						</form>
					{/if}
					{#if p.geplant.nodes.length === 0}
						<p class="dim">Noch keine Schritte (lege Dateien in <code>geplant/</code> an).</p>
					{:else}
						<Dag geplant={p.geplant} {selectedId} onselect={(id) => (selectedId = id)} onadvance={advanceStatus} />
					{/if}

					{#if archivNodes.length}
						<section class="archiv" class:offen={archivOffen}>
							<button class="archiv-kopf" onclick={() => (archivOffen = !archivOffen)} aria-expanded={archivOffen}>
								<span class="chev">{archivOffen ? '▾' : '▸'}</span>
								Abgeschlossen ({archivNodes.length})
							</button>
							{#if archivOffen}
								<div class="archiv-grid">
									{#each archivNodes as n (n.id)}
										<button
											class="archiv-item"
											class:selected={n.id === selectedId}
											onclick={() => (selectedId = n.id)}
											title="{n.title} · {n.rel}"
										>
											<span class="archiv-titel">{n.title}</span>
											<span class="archiv-meta">
												{#if n.start}{n.start}{#if n.ende}&nbsp;– {n.ende}{/if} ·{/if}
												{#if n.tasks.total}{n.tasks.done}/{n.tasks.total}{:else}—{/if}
											</span>
										</button>
									{/each}
								</div>
							{/if}
						</section>
					{/if}
				</div>

				<div class="gutter gutter-row" title="Höhe ziehen · Doppelklick setzt zurück" onpointerdown={startRowDrag} ondblclick={resetRows}></div>

				<div class="future-bottom" style="flex:{1 - futureTopFrac}">
					{#if selectedNode}
						<article class="section-card node-detail">
							<div class="node-detail-head">
								<h3>{selectedNode.title}</h3>
								<span class="pill status-{(selectedNode.status || '').replace(/\s+/g, '-')}">{selectedNode.status}</span>
								{#if selectedNode.archiviert}
									<span class="pill archiv-pill" title={selectedNode.rel}>archiviert</span>
								{/if}
								{#if editing}
									<div class="toolbar">
										<button class="tb" title="Text bearbeiten" onclick={() => (bodyEditRel = bodyEditRel === selectedNode.rel ? null : selectedNode.rel)}>✎</button>
										<button class="tb danger" title="Löschen" onclick={() => removeDoc(selectedNode.rel, selectedNode.title)}>🗑</button>
									</div>
								{/if}
							</div>
							{#if editing}
								{#key selectedNode.id}
									<NodeMeta node={selectedNode} allNodes={alleNodes} projectId={p.id} onchanged={refresh} />
								{/key}
							{/if}
							{#if bodyEditRel === selectedNode.rel}
								{#key selectedNode.rel}
									<MarkdownEditor value={selectedNode.body} {busy} onsave={(t) => saveBody(selectedNode.rel, t)} oncancel={() => (bodyEditRel = null)} />
								{/key}
							{:else}
								{#key selectedNode.id}
									<Markdown html={selectedNode.html} projectId={p.id} rel={selectedNode.rel} />
								{/key}
							{/if}
						</article>
					{:else}
						<p class="dim pad">Kein Knoten ausgewählt.</p>
					{/if}
				</div>
			</div>
		</section>
	</div>
	</div>

	{#if railStand.length}
		<aside class="rail" class:collapsed={railCollapsed}>
			<div class="rail-head">
				<button
					class="tb"
					title={railCollapsed ? (railAktiv?.title ?? 'Einblenden') + ' einblenden' : 'Einklappen'}
					onclick={toggleRail}
				>
					{railCollapsed ? '«' : '»'}
				</button>
				{#if !railCollapsed && railStand.length === 1}
					<span class="rail-title">{railStand[0].title}</span>
				{/if}
			</div>
			{#if !railCollapsed}
				{#if railStand.length > 1}
					<!-- Mehrere gepinnte Dokumente: Tabs statt Stapel -->
					<div class="rail-tabs" role="tablist">
						{#each railStand as sec (sec.id)}
							<button
								class="rail-tab"
								class:on={sec.id === railAktiv?.id}
								role="tab"
								aria-selected={sec.id === railAktiv?.id}
								title={sec.title}
								onclick={() => waehleRailTab(sec.id)}
							>
								{sec.title}
							</button>
						{/each}
					</div>
				{/if}
				<div class="rail-scroll">
					{#if railStand.length > 1}
						{#if railAktiv}
							{#key railAktiv.id}
								{@render standCard(railAktiv, false)}
							{/key}
						{/if}
					{:else}
						{#each railStand as sec (sec.id)}
							{@render standCard(sec, false)}
						{/each}
					{/if}
				</div>
			{/if}
		</aside>
	{/if}
</div>

{#snippet standCard(sec, movable)}
	<article class="section-card">
		<div class="card-head">
			<h3>{sec.title}</h3>
			{#if editing}
				<div class="toolbar">
					{#if movable}
						<button class="tb" title="Nach oben" disabled={globalIndex(sec) === 0} onclick={() => moveSection(globalIndex(sec), -1)}>↑</button>
						<button class="tb" title="Nach unten" disabled={globalIndex(sec) === p.stand.length - 1} onclick={() => moveSection(globalIndex(sec), 1)}>↓</button>
					{/if}
					<button class="tb" title="Bearbeiten" onclick={() => (bodyEditRel = bodyEditRel === sec.rel ? null : sec.rel)}>✎</button>
					<button class="tb danger" title="Löschen" onclick={() => removeDoc(sec.rel, sec.title)}>🗑</button>
				</div>
			{/if}
		</div>
		{#if bodyEditRel === sec.rel}
			{#key sec.rel}
				<MarkdownEditor value={sec.body} {busy} onsave={(t) => saveBody(sec.rel, t)} oncancel={() => (bodyEditRel = null)} />
			{/key}
		{:else}
			<Markdown html={sec.html} projectId={p.id} rel={sec.rel} />
		{/if}
	</article>
{/snippet}

{#if msg}
	<div class="toast {msg.type}">{msg.text}</div>
{/if}

<style>
	.proj-layout {
		display: flex;
		height: calc(100dvh - var(--topbar-h));
		overflow: hidden;
	}
	.proj-main {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* sidebar */
	.sidebar {
		flex: 0 0 auto;
		width: 224px;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		background: var(--surface);
		overflow: hidden;
		transition: width 0.14s ease;
	}
	.sidebar.collapsed {
		width: 44px;
	}

	/* right rail: pinned stand docs (chronicle / decision log) */
	.rail {
		flex: 0 0 auto;
		width: 340px;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--border);
		background: var(--surface);
		overflow: hidden;
		transition: width 0.14s ease;
	}
	.rail.collapsed {
		width: 44px;
	}
	.rail-head {
		display: flex;
		align-items: center;
		gap: 8px;
		height: var(--topbar-h);
		padding: 0 8px;
		border-bottom: 1px solid var(--border);
		flex: 0 0 auto;
	}
	.rail-title {
		font-weight: 650;
		color: var(--text);
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Tabs, sobald mehr als ein stand-Dokument `pin: right` trägt */
	.rail-tabs {
		flex: 0 0 auto;
		display: flex;
		gap: 3px;
		padding: 8px 8px 0;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.rail-tabs::-webkit-scrollbar {
		display: none;
	}
	.rail-tab {
		flex: 0 1 auto;
		min-width: 0;
		padding: 5px 11px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--text-dim);
		font: inherit;
		font-size: 12.5px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.rail-tab:hover {
		color: var(--text);
		background: var(--surface-2);
	}
	.rail-tab.on {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 13%, transparent);
		border-color: color-mix(in srgb, var(--accent) 32%, transparent);
	}
	.rail-tabs + .rail-scroll {
		padding-top: 8px;
	}
	.rail-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 10px 10px 20px;
	}
	/* compact cards inside the rail */
	.rail-scroll :global(.section-card) {
		padding: 2px 12px 10px;
		margin-bottom: 10px;
	}
	.rail-scroll :global(.section-card h3) {
		font-size: 0.95em;
	}
	.sidebar-head {
		display: flex;
		align-items: center;
		gap: 8px;
		height: var(--topbar-h);
		padding: 0 8px;
		border-bottom: 1px solid var(--border);
		flex: 0 0 auto;
	}
	.sidebar-title {
		font-weight: 650;
		color: var(--text);
		font-size: 14px;
	}
	.sidebar-nav {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 8px 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.side-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 9px;
		border-radius: 8px;
		color: var(--text);
		font-size: 13.5px;
		text-decoration: none;
	}
	.side-item:hover {
		background: var(--surface-2);
		text-decoration: none;
	}
	.side-item.active {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
		font-weight: 600;
	}
	.side-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dot {
		flex: 0 0 auto;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-dim);
	}
	.dot.status-aktiv,
	.dot.status-in-arbeit {
		background: var(--future);
	}
	.dot.status-fertig,
	.dot.status-done,
	.dot.status-erledigt {
		background: var(--ok);
	}
	.proj-head {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 12px 22px;
		flex: 0 0 auto;
	}
	.proj-head h1 {
		margin: 0;
		font-size: 1.35em;
	}
	.back {
		color: var(--text-dim);
		font-size: 14px;
	}
	.tags {
		display: inline-flex;
		gap: 6px;
	}
	.tag {
		font-size: 11px;
		color: var(--text-dim);
		background: var(--surface-2);
		border-radius: 6px;
		padding: 1px 7px;
	}
	.loc {
		font-size: 12px;
		color: var(--text-dim);
		max-width: 32%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.head-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}
	.btn {
		padding: 6px 13px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
	}
	.btn:hover {
		border-color: var(--accent);
	}
	.btn.on,
	.btn.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #fff;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* settings panel */
	.settings {
		flex: 0 0 auto;
		margin: 0 22px 8px;
		padding: 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.settings-grid {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.fld {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-dim);
	}
	.fld.grow {
		flex: 1;
		min-width: 200px;
	}
	.settings input,
	.settings select {
		padding: 7px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-weight: 500;
	}
	.settings-actions {
		display: flex;
		gap: 8px;
	}

	/* split */
	.split {
		flex: 1 1 auto;
		display: flex;
		min-height: 0;
		padding: 0 12px 12px;
	}
	.pane {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
	.pane-title {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.8em;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
		margin: 0 10px 10px;
		padding-bottom: 6px;
		border-bottom: 2px solid var(--border);
		flex: 0 0 auto;
	}
	.grow {
		flex: 1;
	}
	.pane-past .pane-title {
		border-color: color-mix(in srgb, var(--past) 55%, var(--border));
	}
	.pane-future .pane-title {
		border-color: color-mix(in srgb, var(--future) 55%, var(--border));
	}
	.pane-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 2px 10px 20px;
	}
	.future-body {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.future-top {
		min-height: 0;
		overflow: auto;
		padding: 2px 10px 6px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.future-top :global(.dag-scroll) {
		flex: 1 1 auto;
		min-height: 120px;
	}
	.future-bottom {
		min-height: 0;
		overflow: auto;
		padding: 6px 10px 20px;
	}

	/* gutters */
	.gutter {
		flex: 0 0 auto;
		position: relative;
		background: transparent;
	}
	.gutter::after {
		content: '';
		position: absolute;
		background: var(--border);
		border-radius: 2px;
		transition: background 0.12s;
	}
	.gutter:hover::after {
		background: var(--accent);
	}
	.gutter-col {
		width: 12px;
		cursor: col-resize;
		align-self: stretch;
	}
	.gutter-col::after {
		inset: 20% 5px;
		width: 2px;
	}
	.gutter-row {
		height: 12px;
		cursor: row-resize;
		margin: 0 10px;
	}
	.gutter-row::after {
		inset: 5px 40%;
		height: 2px;
	}

	/* cards */
	.section-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 4px 16px 14px;
		margin-bottom: 14px;
	}
	.card-head,
	.node-detail-head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-top: 10px;
	}
	.card-head h3,
	.node-detail-head h3 {
		margin: 0;
		font-size: 1.05em;
	}
	.card-head h3 {
		flex: 1;
	}
	.toolbar {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}
	.tb {
		width: 28px;
		height: 28px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--surface);
		color: var(--text);
		font-size: 13px;
		cursor: pointer;
	}
	.tb:hover {
		border-color: var(--accent);
	}
	.tb.danger:hover {
		border-color: #d1495b;
		color: #d1495b;
	}
	.tb:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.add-row {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}
	.add-row input {
		flex: 1;
		min-width: 120px;
		padding: 7px 11px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}
	.dim {
		color: var(--text-dim);
	}
	.pad {
		padding: 8px 4px;
	}

	/* --- Archiv: beendete Themen aus abgeschlossen/ --- */
	.archiv {
		flex: 0 0 auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
	}
	.archiv-kopf {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 12px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--text-dim);
		font: inherit;
		font-size: 0.78em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		text-align: left;
		cursor: pointer;
	}
	.archiv-kopf:hover {
		color: var(--text);
	}
	.chev {
		font-size: 11px;
	}
	.archiv-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0 12px 12px;
	}
	.archiv-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 7px 11px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface-2);
		color: var(--text-dim);
		font: inherit;
		text-align: left;
		cursor: pointer;
		opacity: 0.78;
	}
	.archiv-item:hover {
		opacity: 1;
		border-color: var(--accent);
	}
	.archiv-item.selected {
		opacity: 1;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.archiv-titel {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}
	.archiv-meta {
		font-size: 11px;
		color: var(--text-dim);
	}
	.archiv-pill {
		font-weight: 500;
		font-style: italic;
	}

	/* toast */
	.toast {
		position: fixed;
		bottom: 18px;
		left: 50%;
		transform: translateX(-50%);
		padding: 9px 16px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 600;
		box-shadow: var(--shadow);
		z-index: 50;
	}
	.toast.ok {
		background: color-mix(in srgb, var(--ok) 18%, var(--surface));
		color: var(--ok);
		border: 1px solid color-mix(in srgb, var(--ok) 45%, var(--border));
	}
	.toast.error {
		background: color-mix(in srgb, #d1495b 16%, var(--surface));
		color: #d1495b;
		border: 1px solid color-mix(in srgb, #d1495b 45%, var(--border));
	}

	@media (max-width: 900px) {
		.sidebar,
		.rail {
			display: none;
		}
		.proj-layout,
		.proj-main {
			height: auto;
			overflow: visible;
		}
		.split {
			flex-direction: column;
		}
		.gutter-col {
			display: none;
		}
		.pane {
			flex: none !important;
			overflow: visible;
		}
		.pane-scroll,
		.future-top,
		.future-bottom {
			overflow: visible;
		}
	}
</style>
