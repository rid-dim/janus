<script>
	import { goto, invalidateAll } from '$app/navigation';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import AgentenZeile from '$lib/components/AgentenZeile.svelte';
	import Kanal from '$lib/components/Kanal.svelte';
	import { postJSON } from '$lib/client/api.js';
	import { flip } from 'svelte/animate';

	let { data } = $props();

	// Das Agenten-Board veraltet in Sekunden, nicht in Minuten – deshalb zieht
	// sich das Dashboard die Daten selbst nach. Nur im sichtbaren Tab, damit ein
	// vergessenes Fenster nicht dauernd das Dateisystem abklappert.
	$effect(() => {
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') invalidateAll();
		}, 15000);
		return () => clearInterval(id);
	});

	// Je Projekt die auffälligste lebende Session: Wartende schlagen Arbeitende.
	const agentJeProjekt = $derived.by(() => {
		const m = new Map();
		for (const a of data.agenten) {
			if (a.veraltet || !a.projektId) continue;
			const da = m.get(a.projektId);
			if (!da || (a.wartet && !da.wartet) || (a.status === 'arbeitet' && da.status === 'idle')) {
				m.set(a.projektId, a);
			}
		}
		return m;
	});

	// --- verschiebbare Trennung (gleiches Idiom wie die Projektansicht) -------
	const VORGABE_LINKS = 0.44; // Breitenanteil der Kanal-Spalte
	let linksAnteil = $state(VORGABE_LINKS);
	let splitEl = $state(null);
	const LAYOUT_KEY = 'janus.layout.dashboard';

	$effect(() => {
		try {
			const gespeichert = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
			if (typeof gespeichert.linksAnteil === 'number') linksAnteil = gespeichert.linksAnteil;
		} catch {
			/* ohne gespeicherten Stand bleibt die Vorgabe */
		}
	});
	function merken() {
		try {
			localStorage.setItem(LAYOUT_KEY, JSON.stringify({ linksAnteil }));
		} catch {
			/* ignorieren */
		}
	}
	function ziehen(e) {
		e.preventDefault();
		const rect = splitEl.getBoundingClientRect();
		document.body.style.userSelect = 'none';
		const move = (ev) => (linksAnteil = Math.min(0.75, Math.max(0.2, (ev.clientX - rect.left) / rect.width)));
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			document.body.style.userSelect = '';
			merken();
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}
	function zuruecksetzen() {
		linksAnteil = VORGABE_LINKS;
		merken();
	}

	// --- Reihenfolge der Kacheln ------------------------------------------------
	// Gespeichert wird in janus.config.json (wie `hidden`): rein lokal, aber
	// unabhängig vom Browser.
	//
	// Beim Ziehen ordnen sich die Kacheln sofort so an, wie sie danach stehen
	// werden. Ein Einfügestrich würde nur andeuten, *wo* etwas landet; die
	// Vorschau zeigt, *wie es aussieht* – und beantwortet damit die eigentliche
	// Frage, statt sie zu beschreiben.
	let ordnung = $state(null); // bestätigte Reihenfolge, bis der Server nachzieht
	let vorschau = $state(null); // Reihenfolge während eines laufenden Ziehens
	let zieheId = $state(null);

	const basis = $derived(ordnung ?? data.projects.map((p) => p.id));
	const projekte = $derived.by(() => {
		const ids = vorschau ?? basis;
		const nach = new Map(data.projects.map((p) => [p.id, p]));
		const sortiert = ids.map((id) => nach.get(id)).filter(Boolean);
		// Neu hinzugekommene Projekte kennt die gespeicherte Reihenfolge nicht –
		// sie dürfen nicht verschwinden.
		for (const p of data.projects) if (!ids.includes(p.id)) sortiert.push(p);
		return sortiert;
	});

	/** Während des Ziehens: Ziel-Reihenfolge berechnen und sofort anzeigen. */
	function ueberKachel(zielId) {
		if (!zieheId || zielId === zieheId) return;
		const ids = [...(vorschau ?? basis)];
		const von = ids.indexOf(zieheId);
		const nach = ids.indexOf(zielId);
		if (von < 0 || nach < 0 || von === nach) return;
		ids.splice(nach, 0, ids.splice(von, 1)[0]);
		vorschau = ids;
	}

	async function ablegen() {
		const ids = vorschau;
		zieheId = null;
		vorschau = null;
		if (!ids) return;
		ordnung = ids; // sofort stehen lassen, damit nichts zurückspringt
		try {
			await postJSON('/api/reihenfolge', { ids });
			await invalidateAll();
			ordnung = null; // ab jetzt liefert der Server die Reihenfolge
		} catch (e) {
			msg = { type: 'error', text: String(e.message || e) };
			ordnung = null;
		}
	}

	function abbrechen() {
		zieheId = null;
		vorschau = null;
	}

	// Umordnen soll man sehen können, nicht erraten: die Kacheln gleiten an ihre
	// neue Stelle, statt zu springen. Wer Bewegung abgeschaltet hat, bekommt sie
	// sofort ohne Übergang.
	const wenigerBewegung =
		typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	const gleitDauer = wenigerBewegung ? 0 : 180;

	let anlegenOffen = $state(false);

	let suchfeld = $state(data.q || '');
	function sucheAbschicken(e) {
		e.preventDefault();
		const q = suchfeld.trim();
		goto(q ? '/?q=' + encodeURIComponent(q) : '/', { keepFocus: true });
	}

	function wannLabel(d) {
		if (d.sofort) return 'sofort';
		if (d.laufend) return 'läuft';
		const n = d.inTagen;
		const c = d.circa ? '~' : '';
		if (n < -1) return `${c}seit ${-n} Tagen überfällig`;
		if (n === -1) return c + 'seit gestern überfällig';
		if (n === 0) return c + 'heute';
		if (n === 1) return c + 'morgen';
		return `${c}in ${n} Tagen`;
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

<div class="container dash">
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

	<div class="split" class:ohne-board={!data.boardAktiv} bind:this={splitEl}>
		{#if data.boardAktiv}
		<!-- Links: was gerade läuft -->
		<!-- Links: was gerade läuft. Fixiert, damit das Fenster beim Scrollen der
		     Projektspalte stehen bleibt – ein wegrutschender Chat ist kein Fenster. -->
		<div class="pane links" style="flex: 0 0 calc({linksAnteil * 100}% - 7px)">
			<AgentenZeile agenten={data.agenten} warten={data.warten} />
			<h2 class="pane-titel">
				Kanal
				<span class="dim">flüchtig · {Math.round(data.ttlMinuten / 60) || 1} h</span>
			</h2>
			<Kanal kanal={data.kanal.nachrichten} namen={data.kanal.namen} ttlMinuten={data.ttlMinuten} fuellen />
		</div>

		<div
			class="gutter gutter-col"
			title="Breite ziehen · Doppelklick setzt zurück"
			onpointerdown={ziehen}
			ondblclick={zuruecksetzen}
		></div>
		{/if}

		<!-- Rechts: die Projekte selbst, mit dem was ansteht -->
		<div class="pane rechts">
			<h2 class="pane-titel">
				Projekte
				<span class="dim">{data.projects.length}</span>
				<button class="anlegen" onclick={() => (anlegenOffen = !anlegenOffen)} aria-expanded={anlegenOffen}>
					{anlegenOffen ? '×' : '+ anlegen / verlinken'}
				</button>
			</h2>

			{#if anlegenOffen}
				<div class="anlegen-body">
					<form onsubmit={createProject}>
						<div class="row">
							<input placeholder="Neues Projekt (Titel)" bind:value={newTitel} />
							<button disabled={busy || !newTitel.trim()}>Anlegen</button>
						</div>
					</form>
					<form onsubmit={linkProject}>
						<div class="row">
							<input placeholder="Repo verlinken (Pfad, z. B. ~/dev/projekt)" bind:value={linkPath} />
							<input class="opt" placeholder="Titel" bind:value={linkTitel} />
							<button disabled={busy || !linkPath.trim()}>Verlinken</button>
						</div>
					</form>
					<p class="hint">
						Legt bzw. liest <code>{data.projectSubdir}/</code> im Repo. Store: <code>{data.dataRoot}</code>
					</p>
					{#if msg}<p class="msg {msg.type}">{msg.text}</p>{/if}
				</div>
			{/if}

			{#if data.deadlines.length > 0}
				<section class="faellig">
					<h3>Fällig <span class="dim">(nächste 7 Tage)</span></h3>
					{#each data.deadlines as d (d.projektId + ':' + (d.knotenId ?? d.ende + ':' + d.titel))}
						<a
							class="f-item"
							class:ueberfaellig={d.inTagen < 0}
							class:termin={d.quelle === 'termin'}
							href={d.href}
							title={d.quelle === 'termin'
								? 'Aus der Termine-Liste des Projekts'
								: d.quelle === 'pruefen'
									? 'pruefen: des Knotens – Arbeitsende war ' + (d.arbeitsende ? datumLabel(d.arbeitsende) : 'offen')
									: 'ende: des Knotens'}
						>
							<span class="f-wann">{wannLabel(d)}</span>
							<span class="f-titel">{d.titel}</span>
							{#if d.quelle === 'pruefen'}<span class="f-art">prüfen</span>{/if}
							<span class="f-badge">{d.projektTitel}</span>
							<span class="f-datum">{d.circa ? '≈ ' : ''}{datumLabel(d.ende)}</span>
						</a>
					{/each}
				</section>
			{/if}

			{#if data.wiedervorlagen.length}
				<!-- Nicht drängen, aber auffindbar bleiben: wer merkt, dass ein
				     Prüftag schlecht liegt, soll ihn nicht suchen müssen. -->
				<details class="wv">
					<summary>{data.wiedervorlagen.length} Wiedervorlage{data.wiedervorlagen.length === 1 ? '' : 'n'} später</summary>
					{#each data.wiedervorlagen as w (w.projektId + ':' + w.knotenId)}
						<a class="wv-item" href={w.href}>
							<span class="wv-wann">in {w.inTagen} {w.inTagen === 1 ? 'Tag' : 'Tagen'}</span>
							<span class="wv-titel">{w.titel}</span>
							<span class="f-badge">{w.projektTitel}</span>
							<span class="f-datum">{datumLabel(w.pruefen)}</span>
						</a>
					{/each}
				</details>
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
				<div class="grid" ondragover={(e) => zieheId && e.preventDefault()} ondrop={(e) => { e.preventDefault(); ablegen(); }}>
					{#each projekte as project (project.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="platz"
							animate:flip={{ duration: gleitDauer }}
							class:zieht={zieheId === project.id}
							ondragstart={() => (zieheId = project.id)}
							ondragover={(e) => { if (zieheId) { e.preventDefault(); ueberKachel(project.id); } }}
							ondrop={(e) => { e.preventDefault(); ablegen(); }}
							ondragend={abbrechen}
						>
							<ProjectCard {project} agent={agentJeProjekt.get(project.id) ?? null} />
						</div>
					{/each}
				</div>
				<p class="sortier-hinweis">Kacheln am Griff <span aria-hidden="true">⠿</span> ziehen – die Vorschau zeigt die künftige Anordnung.</p>
			{/if}
		</div>
	</div>

	{#if !data.boardAktiv}
		<p class="board-aus">
			Agenten-Board inaktiv – es meldet sich keine Session. Es erscheint von selbst,
			sobald eine da ist; die Einrichtung steht in <code>EINRICHTUNG.md</code>.
		</p>
	{/if}
</div>

<style>
	.board-aus {
		flex: none;
		margin: 10px 0 0;
		font-size: 11.5px;
		color: var(--text-dim);
	}
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
	/* Das Dashboard ist ein Fenster, kein Dokument: es füllt den Schirm, und
	   gescrollt wird ausschließlich innen. Vorher beanspruchte die linke Spalte
	   volle Schirmhöhe, begann aber erst unter der Überschrift – dadurch lag die
	   Eingabezeile unterhalb des Rands. */
	.dash {
		height: calc(100vh - var(--topbar-h));
		display: flex;
		flex-direction: column;
		padding-bottom: 18px;
		overflow: hidden;
	}
	.split {
		display: flex;
		align-items: stretch;
		gap: 0;
		flex: 1 1 auto;
		min-height: 0;
	}
	.pane {
		min-width: 0;
	}
	/* Die linke Spalte bleibt stehen und füllt den Schirm; gescrollt wird
	   rechts. Innen scrollt nur das Chatfenster selbst. */
	.pane.links {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}
	.pane.links :global(.agenten) {
		flex: 0 0 auto;
		max-height: 34vh;
		overflow-y: auto;
		margin-bottom: 14px;
	}
	.split.ohne-board > .pane.rechts {
		flex: 1 1 100%;
	}
	.pane.rechts {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding-right: 4px;
	}
	.pane-titel {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 15px;
		margin: 0 0 8px;
	}
	.pane-titel .dim {
		font-weight: 400;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.anlegen {
		margin-left: auto;
		font-size: 12px;
		padding: 2px 10px;
	}
	.anlegen-body {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 12px;
		margin-bottom: 12px;
	}
	.anlegen-body .row {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}
	.anlegen-body input {
		flex: 1 1 auto;
		min-width: 0;
	}
	.anlegen-body .opt {
		flex: 0 1 140px;
	}
	.anlegen-body .hint {
		margin: 0;
		font-size: 11.5px;
		color: var(--text-dim);
	}

	/* Ziehbare Trennung – gleiches Idiom wie in der Projektansicht */
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
		width: 14px;
		cursor: col-resize;
		align-self: stretch;
	}
	.platz {
		display: flex;
		min-width: 0;
	}
	.platz > :global(.card) {
		flex: 1 1 auto;
		width: 100%;
	}
	/* Die gezogene Kachel bleibt als blasser Platzhalter sichtbar – so ist
	   erkennbar, welche gerade wandert und wo sie gerade läge. */
	.platz.zieht > :global(.card) {
		opacity: 0.4;
		outline: 2px dashed var(--accent);
		outline-offset: 2px;
	}
	.sortier-hinweis {
		margin: 10px 0 0;
		font-size: 11.5px;
		color: var(--text-dim);
	}
	.gutter-col::after {
		inset: 12px 6px;
		width: 2px;
	}

	@media (max-width: 1100px) {
		/* Gestapelt ist ein festes Fenster sinnlos – da scrollt die Seite. */
		.dash {
			height: auto;
			overflow: visible;
		}
		.pane.rechts {
			overflow: visible;
		}
		.split {
			flex-direction: column;
		}
		/* Gezogene Breite gilt nur nebeneinander – gestapelt immer voll. */
		.split > .pane {
			flex: 1 1 auto !important;
			width: 100%;
		}
		.pane.links {
			height: auto;
		}
		.pane.links :global(.agenten) {
			max-height: none;
			overflow: visible;
		}
		.gutter-col {
			display: none;
		}
	}

	.faellig h3 {
		font-size: 13px;
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 0 0 8px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-dim);
	}
	@media (max-width: 1100px) {
		/* Das Dashboard ist ein Fenster, kein Dokument: es füllt den Schirm, und
	   gescrollt wird ausschließlich innen. Vorher beanspruchte die linke Spalte
	   volle Schirmhöhe, begann aber erst unter der Überschrift – dadurch lag die
	   Eingabezeile unterhalb des Rands. */
	.dash {
		height: calc(100vh - var(--topbar-h));
		display: flex;
		flex-direction: column;
		padding-bottom: 18px;
		overflow: hidden;
	}
	.split {
		display: flex;
		align-items: stretch;
		gap: 0;
		flex: 1 1 auto;
		min-height: 0;
	}
	.pane {
		min-width: 0;
	}
	/* Die linke Spalte bleibt stehen und füllt den Schirm; gescrollt wird
	   rechts. Innen scrollt nur das Chatfenster selbst. */
	.pane.links {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}
	.pane.links :global(.agenten) {
		flex: 0 0 auto;
		max-height: 34vh;
		overflow-y: auto;
		margin-bottom: 14px;
	}
	.split.ohne-board > .pane.rechts {
		flex: 1 1 100%;
	}
	.pane.rechts {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding-right: 4px;
	}
	.pane-titel {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 15px;
		margin: 0 0 8px;
	}
	.pane-titel .dim {
		font-weight: 400;
		font-size: 12.5px;
		color: var(--text-dim);
	}
	.mehr {
		margin-left: auto;
		font-size: 12px;
		font-weight: 400;
		color: var(--text-dim);
		text-decoration: none;
	}
	.mehr:hover {
		color: var(--accent);
	}
	.anlegen {
		margin-left: auto;
		font-size: 12px;
		padding: 2px 10px;
	}
	.anlegen-body {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 12px;
		margin-bottom: 12px;
	}
	.anlegen-body .row {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}
	.anlegen-body input {
		flex: 1 1 auto;
		min-width: 0;
	}
	.anlegen-body .opt {
		flex: 0 1 140px;
	}
	.anlegen-body .hint {
		margin: 0;
		font-size: 11.5px;
		color: var(--text-dim);
	}

	/* Ziehbare Trennung – gleiches Idiom wie in der Projektansicht */
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
		width: 14px;
		cursor: col-resize;
		align-self: stretch;
	}
	.platz {
		display: flex;
		min-width: 0;
	}
	.platz > :global(.card) {
		flex: 1 1 auto;
		width: 100%;
	}
	/* Die gezogene Kachel bleibt als blasser Platzhalter sichtbar – so ist
	   erkennbar, welche gerade wandert und wo sie gerade läge. */
	.platz.zieht > :global(.card) {
		opacity: 0.4;
		outline: 2px dashed var(--accent);
		outline-offset: 2px;
	}
	.sortier-hinweis {
		margin: 10px 0 0;
		font-size: 11.5px;
		color: var(--text-dim);
	}
	.gutter-col::after {
		inset: 12px 6px;
		width: 2px;
	}

	@media (max-width: 1100px) {
		/* Gestapelt ist ein festes Fenster sinnlos – da scrollt die Seite. */
		.dash {
			height: auto;
			overflow: visible;
		}
		.pane.rechts {
			overflow: visible;
		}
		.split {
			flex-direction: column;
		}
		/* Gezogene Breite gilt nur nebeneinander – gestapelt immer voll. */
		.split > .pane {
			flex: 1 1 auto !important;
			width: 100%;
		}
		.pane.links {
			height: auto;
		}
		.pane.links :global(.agenten) {
			max-height: none;
			overflow: visible;
		}
		.gutter-col {
			display: none;
		}
	}

	.faellig h3 {
		font-size: 13px;
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 0 0 8px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-dim);
	}
	}
	.mehr {
		margin-left: auto;
		font-size: 12px;
		font-weight: 400;
		color: var(--text-dim);
		text-decoration: none;
	}
	.mehr:hover {
		color: var(--accent);
	}
	.faellig {
		margin-bottom: 22px;
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
	.f-item.termin .f-titel {
		font-weight: 500;
	}
	.f-titel {
		font-weight: 600;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.wv {
		margin: -4px 0 18px;
	}
	.wv summary {
		cursor: pointer;
		font-size: 12px;
		color: var(--text-dim);
	}
	.wv-item {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 5px 12px;
		margin-top: 6px;
		border: 1px dashed var(--border);
		border-radius: 10px;
		text-decoration: none;
		color: var(--text-dim);
		font-size: 12.5px;
	}
	.wv-item:hover {
		border-color: var(--accent);
		color: var(--text);
	}
	.wv-wann {
		flex: none;
		min-width: 92px;
		font-weight: 700;
	}
	.wv-titel {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.f-art {
		flex: none;
		font-size: 10.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-dim);
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
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.anlegen-body button {
		padding: 8px 16px;
		border: 1px solid var(--accent);
		border-radius: 8px;
		background: var(--accent);
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.anlegen-body button:disabled {
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
