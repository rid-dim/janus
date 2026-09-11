<script>
	import { invalidateAll } from '$app/navigation';
	import { postJSON } from '$lib/client/api.js';

	/**
	 * Das Kanal-Fenster: was gerade läuft, und die Möglichkeit einzuwerfen.
	 *
	 * Bewusst ein *Fenster*, kein Postfach – der Inhalt verfällt von selbst.
	 * Es ist kein Weg, den Menschen zu erreichen, sondern der Blick des
	 * Menschen auf das, was die Agenten gerade tun und miteinander besprechen.
	 *
	 * Eine „Rundfrage" ist kein eigener Mechanismus, sondern `@all` plus Frage –
	 * und eine „Vermittlung" ist `@a @b klärt das bitte untereinander`. Beide
	 * Empfänger sehen dieselbe Aufforderung, mehr braucht es nicht.
	 *
	 * @type {{ kanal: any[], namen: any[], ttlMinuten: number, kompakt?: boolean }}
	 */
	let { kanal = [], namen = [], ttlMinuten = 120, fuellen = false } = $props();

	// Eigener, leichter Takt für das Fenster: das Dashboard komplett neu zu
	// bauen (Registry, alle Projektdateien) verträgt keine Sekundentakte, ein
	// gerendertes Kanal-JSON schon. Ohne das lag eine Antwort bis zu 15 s
	// unsichtbar herum – und tauchte scheinbar erst auf, wenn man selbst etwas
	// schrieb, weil das eigene Senden ein Nachladen erzwingt.
	let live = $state(null);
	const nachrichten = $derived(live?.nachrichten ?? kanal);
	const adressen = $derived(live?.namen ?? namen);

	async function nachladen() {
		try {
			const res = await fetch('/api/agent/nachricht');
			const d = await res.json();
			if (d.ok) live = { nachrichten: d.nachrichten, namen: d.namen };
		} catch {
			/* Netz weg: beim nächsten Takt wieder versuchen */
		}
	}

	$effect(() => {
		// Neue Serverdaten (z. B. nach invalidateAll) gewinnen wieder.
		kanal;
		live = null;
	});

	$effect(() => {
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') nachladen();
		}, 3000);
		return () => clearInterval(id);
	});

	let text = $state('');
	let feld = $state(null);
	let fenster = $state(null);
	let busy = $state(false);
	let fehler = $state(null);
	let vorschlaege = $state([]);
	let idx = $state(0);

	// Ans Ende springen – aber nur, wenn der Blick ohnehin dort ist. Wer nach
	// oben gescrollt hat, liest oder kopiert gerade etwas; ihn dabei
	// wegzuziehen ist schlimmer, als eine neue Nachricht zu verpassen.
	let amEnde = $state(true);
	let ungelesen = $state(0);
	const NAH_GENUG = 60; // px Abstand, die noch als "unten" gelten

	function beobachteScroll() {
		if (!fenster) return;
		amEnde = fenster.scrollHeight - fenster.scrollTop - fenster.clientHeight < NAH_GENUG;
		if (amEnde) ungelesen = 0;
	}

	function nachUnten() {
		if (!fenster) return;
		fenster.scrollTop = fenster.scrollHeight;
		amEnde = true;
		ungelesen = 0;
	}

	let zuletztGesehen = 0;
	$effect(() => {
		const n = nachrichten.length;
		if (!fenster) return;
		if (amEnde) {
			queueMicrotask(nachUnten);
		} else if (n > zuletztGesehen) {
			ungelesen += n - zuletztGesehen;
		}
		zuletztGesehen = n;
	});

	/** Das @-Wort, in dem der Cursor gerade steht (oder null). */
	function offenesTag() {
		if (!feld) return null;
		const bis = feld.value.slice(0, feld.selectionStart);
		const m = /(^|\s)@([\w.:+-]*)$/.exec(bis);
		return m ? { praefix: m[2], start: bis.length - m[2].length - 1 } : null;
	}

	function pruefe() {
		const tag = offenesTag();
		if (!tag) {
			vorschlaege = [];
			return;
		}
		const q = tag.praefix.toLowerCase();
		vorschlaege = adressen.filter((n) => n.name.toLowerCase().startsWith(q)).slice(0, 8);
		idx = 0;
	}

	function uebernehmen(name) {
		const tag = offenesTag();
		if (!tag) return;
		const vor = text.slice(0, tag.start);
		const nach = text.slice(feld.selectionStart);
		text = vor + '@' + name + ' ' + nach;
		vorschlaege = [];
		queueMicrotask(() => {
			feld?.focus();
			const pos = (vor + '@' + name + ' ').length;
			feld?.setSelectionRange(pos, pos);
		});
	}

	function taste(e) {
		// Steht die Namensliste offen, gehört Enter ihr – erst danach ist Enter
		// wieder "senden".
		if (vorschlaege.length) {
			if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % vorschlaege.length; return; }
			if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + vorschlaege.length) % vorschlaege.length; return; }
			if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); uebernehmen(vorschlaege[idx].name); return; }
			if (e.key === 'Escape') { vorschlaege = []; return; }
		}
		// Wie im Chat: Enter sendet, Shift+Enter bricht die Zeile um.
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			senden();
		}
	}

	async function senden() {
		if (!text.trim()) return;
		busy = true;
		fehler = null;
		try {
			// Der Header weist diese Nachricht als vom Menschen aus – ein Agent
			// ohne `session` gilt dagegen als Agent ohne Absender, nie als Mensch.
			const res = await fetch('/api/agent/nachricht', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-janus-ui': '1' },
				body: JSON.stringify({ text })
			});
			const d = await res.json();
			if (!d.ok) throw new Error(d.error || 'Fehlgeschlagen');
			text = '';
			vorschlaege = [];
			await nachladen();
			amEnde = true; // nach dem eigenen Senden will man ans Ende
			invalidateAll();
		} catch (e) {
			fehler = String(e.message || e);
		} finally {
			busy = false;
		}
	}

	/** Das Feld wächst mit dem Text – von einer Zeile bis zu sechs. */
	function hoeheAnpassen() {
		if (!feld) return;
		feld.style.height = 'auto';
		feld.style.height = Math.min(feld.scrollHeight, 150) + 'px';
	}
	$effect(() => {
		text;
		queueMicrotask(hoeheAnpassen);
	});

	/** Eine Nachricht als Text in die Zwischenablage. */
	let kopiert = $state(null);
	async function kopieren(n) {
		try {
			await navigator.clipboard.writeText(n.text);
			kopiert = n.id;
			setTimeout(() => { if (kopiert === n.id) kopiert = null; }, 1400);
		} catch {
			fehler = 'Kopieren nicht möglich (Zwischenablage gesperrt)';
		}
	}

	function uhr(iso) {
		return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="kanal" class:fuellen>
	<div class="fenster" bind:this={fenster} onscroll={beobachteScroll}>
		{#each nachrichten as n (n.id)}
			{@const ich = n.von?.art === 'mensch'}
			<div class="zeile" class:rechts={ich}>
				<div class="blase" class:eigen={ich} class:bunt={n.farbe !== null && n.farbe !== undefined} style={n.farbe != null ? `--ton: ${n.farbe}` : null}>
					<div class="kopf">
						<span class="wer">
							{#if n.plattform?.zeichen}<span class="wirt" title={'läuft auf ' + n.plattform.name} aria-label={n.plattform.name}>{n.plattform.zeichen}</span>{/if}{n.von?.name ?? '?'}
						</span>
						{#each n.empfaenger as e, i (e)}
							<span class="tag" class:bunt={n.empfaengerFarben?.[i] != null} style={n.empfaengerFarben?.[i] != null ? `--ton: ${n.empfaengerFarben[i]}` : null}>@{e}</span>
						{/each}
						{#if !n.empfaenger.length}<span class="tag leer">Status</span>{/if}
						<span class="zeit">{uhr(n.zeit)}</span>
						<button
							class="kopie"
							title="Nachricht kopieren"
							aria-label="Nachricht kopieren"
							onclick={() => kopieren(n)}
						>{kopiert === n.id ? '✓' : '⧉'}</button>
					</div>
					<!-- Nachrichten sind Markdown: Listen, Tabellen, Bilder aus dem
					     Projektordner und plotly-Blöcke funktionieren damit. -->
					<div class="text md">{@html n.html}</div>
				</div>
			</div>
		{:else}
			<p class="leer-hinweis">Nichts los gerade. Was hier steht, verfällt nach {Math.round(ttlMinuten / 60) || 1} h von selbst.</p>
		{/each}
	</div>

	{#if !amEnde && ungelesen > 0}
		<button class="runter" onclick={nachUnten}>
			↓ {ungelesen} neue {ungelesen === 1 ? 'Nachricht' : 'Nachrichten'}
		</button>
	{/if}

	{#if fehler}<p class="fehler">{fehler}</p>{/if}

	<div class="eingabe">
		<textarea
			bind:this={feld}
			bind:value={text}
			oninput={pruefe}
			onkeydown={taste}
			rows="1"
			placeholder="@all Wo steht ihr gerade?   ·   @ irgendwo im Text · Enter sendet, Shift+Enter neue Zeile"
		></textarea>
		{#if vorschlaege.length}
			<ul class="ac">
				{#each vorschlaege as v, i (v.name)}
					<li class:aktiv={i === idx}>
						<button type="button" onmousedown={(e) => { e.preventDefault(); uebernehmen(v.name); }}>
							<code>@{v.name}</code><span class="dim">{v.hinweis}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<button disabled={busy || !text.trim()} onclick={senden}>Senden</button>
	</div>
</div>

<style>
	/* Gefüllt: die Spalte gibt die Höhe vor, das Fenster nimmt, was übrig ist.
	   min-height:0 ist hier zwingend – ohne das wächst ein Flex-Kind über seinen
	   Container hinaus, statt innen zu scrollen. */
	.kanal.fuellen {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1 1 auto;
	}
	.kanal.fuellen .fenster {
		height: auto;
		flex: 1 1 auto;
		min-height: 0;
	}
	.fenster {
		display: flex;
		flex-direction: column;
		gap: 6px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface-2);
		height: 40vh;
		min-height: 220px;
		overflow-y: auto;
		padding: 12px;
		margin-bottom: 8px;
	}
	.zeile {
		display: flex;
	}
	.zeile.rechts {
		justify-content: flex-end;
	}
	.blase {
		max-width: min(80%, 62em);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 6px 10px 7px;
	}
	/* Jede Nachricht trägt die Farbe ihres Projekts – dieselbe wie dessen
	   Kachel. Nur so ist auf einen Blick klar, wer spricht. */
	.blase.bunt {
		border-left: 3px solid hsl(var(--ton) 55% 52%);
	}
	.blase.bunt .wer {
		color: hsl(var(--ton) 60% 38%);
	}
	.tag.bunt {
		color: hsl(var(--ton) 60% 38%);
		background: hsl(var(--ton) 60% 94%);
	}
	@media (prefers-color-scheme: dark) {
		.blase.bunt {
			border-left-color: hsl(var(--ton) 52% 62%);
		}
		.blase.bunt .wer {
			color: hsl(var(--ton) 62% 72%);
		}
		.tag.bunt {
			color: hsl(var(--ton) 62% 74%);
			background: hsl(var(--ton) 40% 22%);
		}
	}
	.blase.eigen {
		background: color-mix(in srgb, var(--accent) 14%, var(--surface));
		border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 2px;
	}
	.wer {
		font-weight: 700;
		font-size: 11.5px;
	}
	.kopie {
		flex: none;
		background: none;
		border: 0;
		padding: 0 2px;
		font-size: 12px;
		line-height: 1;
		color: var(--text-dim);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.12s;
	}
	.blase:hover .kopie,
	.kopie:focus-visible {
		opacity: 0.8;
	}
	.kopie:hover {
		color: var(--accent);
	}
	.wirt {
		margin-right: 5px;
		padding: 0 4px;
		border-radius: 4px;
		background: var(--surface-2);
		color: var(--text-dim);
		font-family: var(--mono);
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		vertical-align: 1px;
		cursor: help;
	}
	.zeit {
		margin-left: auto;
		padding-left: 8px;
		font-size: 10.5px;
		color: var(--text-dim);
		font-variant-numeric: tabular-nums;
	}
	.tag {
		font-family: var(--mono);
		font-size: 10.5px;
		padding: 0 5px;
		border-radius: 99px;
		background: var(--surface-2);
		color: var(--accent);
	}
	.tag.leer {
		color: var(--text-dim);
		font-style: italic;
	}
	.text {
		font-size: 13px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
	.text :global(p) {
		margin: 3px 0;
	}
	.text :global(ul),
	.text :global(ol) {
		margin: 3px 0;
		padding-left: 18px;
	}
	.text :global(img) {
		max-width: 100%;
		border-radius: 8px;
		margin: 4px 0;
	}
	.text :global(pre) {
		overflow-x: auto;
	}
	.leer-hinweis {
		margin: auto;
		color: var(--text-dim);
		font-style: italic;
		font-size: 13px;
	}
	.runter {
		align-self: flex-start;
		margin-bottom: 6px;
		font-size: 11.5px;
		padding: 3px 10px;
		border-radius: 99px;
		background: var(--accent);
		color: var(--surface);
		border: 0;
		cursor: pointer;
	}
	.fehler {
		color: var(--kat-vorfall);
		font-size: 12.5px;
		margin: 0 0 6px;
	}
	.eingabe {
		position: relative;
		display: flex;
		gap: 8px;
		align-items: stretch;
	}
	.eingabe textarea {
		flex: 1 1 auto;
		min-width: 0;
		font: inherit;
		font-size: 13px;
		line-height: 1.45;
		resize: none;
		overflow-y: auto;
		max-height: 150px;
	}
	.eingabe button {
		flex: none;
		align-self: stretch;
		padding: 0 14px;
		white-space: nowrap;
	}
	.ac {
		position: absolute;
		bottom: 100%;
		left: 0;
		z-index: 5;
		margin: 0 0 4px;
		padding: 4px;
		list-style: none;
		min-width: 280px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: var(--shadow);
	}
	.ac li button {
		display: flex;
		gap: 8px;
		width: 100%;
		align-items: baseline;
		background: none;
		border: 0;
		padding: 4px 8px;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		color: inherit;
	}
	.ac li.aktiv button {
		background: var(--surface-2);
	}
	.ac code {
		font-size: 12px;
		color: var(--accent);
	}
	.dim {
		color: var(--text-dim);
		font-size: 12px;
	}
</style>
