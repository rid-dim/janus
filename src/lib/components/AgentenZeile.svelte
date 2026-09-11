<script>
	/**
	 * Agenten-Board: wer arbeitet gerade wo, wer wartet worauf.
	 *
	 * Zwei bewusst getrennte Arten von "wartet":
	 *   - Prozess-Warten  (agenten): Session steht am Prompt. Minuten-Uhr.
	 *   - Sachliches Warten (warten): deklariert per @wartet. Tage-Uhr.
	 * Vermischt man sie, zeigt das Board hektisch an, was sich in fünf Minuten
	 * von selbst erledigt, und schweigt über das, was seit Wochen liegt.
	 *
	 * @type {{ agenten: any[], warten: any[] }}
	 */
	let { agenten = [], warten = [] } = $props();

	const KAT = {
		entscheidung: 'Entscheidung',
		fremdstelle: 'Fremde Stelle',
		kollege: 'Kollege',
		zugang: 'Zugang'
	};

	const wartende = $derived(agenten.filter((a) => a.wartet));
	const aktive = $derived(agenten.filter((a) => !a.wartet && !a.veraltet));
	const veraltete = $derived(agenten.filter((a) => a.veraltet));
	const fehlerhaft = $derived(warten.filter((w) => w.fehler));
	const echtWarten = $derived(warten.filter((w) => !w.fehler));

	function dauer(min) {
		if (min === null || min === undefined) return '';
		if (min < 60) return `${min} min`;
		const h = Math.floor(min / 60);
		if (h < 24) return `${h} h`;
		return `${Math.floor(h / 24)} T.`;
	}
	function tage(n) {
		if (n === 0) return 'heute';
		if (n === 1) return '1 Tag';
		return `${n} Tage`;
	}
	/** Die Janus-Adresse ist die Projekt-ID: sie stimmt immer, weil Janus die
	 *  Abbildung Projekt ↔ Verzeichnis selbst führt. Der ListAgents-Name ist
	 *  eine Zugabe für SendMessage – und wird nur gezeigt, wenn er wirklich
	 *  registriert wurde. Geraten anzuzeigen lüde dazu ein, ins Leere zu
	 *  schreiben: das Session-Suffix ist nicht vorhersagbar. */
	function adresse(a) {
		return a.projektId ? '@' + a.projektId : null;
	}
</script>

{#if agenten.length || warten.length}
	<section class="agenten">
		<h2>
			Agenten
			{#if wartende.length}
				<span class="dringend">{wartende.length} wartet{wartende.length === 1 ? '' : 'en'}</span>
			{/if}
			{#if echtWarten.length}
				<span class="dim">· {echtWarten.length} blockiert</span>
			{/if}
		</h2>

		<!-- Prozess-Warten: Session steht am Prompt -->
		{#each wartende as a (a.sessionId)}
			<a class="a-item wartet" href={a.projektId ? '/projekt/' + a.projektId : '#'} title={a.frage || 'Session wartet auf Eingabe'}>
				<span class="a-wann">{dauer(a.alterMin)}</span>
				<span class="a-titel">{a.projektTitel ?? a.cwd ?? 'Unbekanntes Projekt'}</span>
				{#if a.frage}<span class="a-frage">{a.frage}</span>{/if}
				{#if adresse(a)}<code class="a-adresse" title="Janus-Adresse – so erreichst du diese Session im Kanal">{adresse(a)}</code>{#if a.adresse}<code class="a-adresse sendmsg" title="Registrierter ListAgents-Name – für SendMessage">{a.adresse}</code>{/if}{/if}
				<span class="a-host" title={a.plattformName + (a.ueber === 'http' ? ' · meldet über HTTP' : '')}>
					{#if a.plattformZeichen}<span class="plattform" aria-label={a.plattformName}>{a.plattformZeichen}</span>{/if}{a.host}
				</span>
			</a>
		{/each}

		<!-- Sachliches Warten: deklariert, überlebt das Ende der Session -->
		{#each echtWarten as w, i (w.projektId + ':' + w.rel + ':' + w.zeile)}
			<a class="a-item sachlich" class:nachfassen={w.nachfassen} href={w.href} title={w.rel + ':' + w.zeile}>
				<span class="a-wann">{tage(w.tage)}</span>
				<span class="a-kat">{KAT[w.kategorie]}</span>
				<span class="a-titel">{w.text}</span>
				<span class="a-badge">{w.projektTitel}</span>
				{#if w.nachfassen}<span class="a-nach">nachfassen</span>{/if}
			</a>
		{/each}

		{#if aktive.length || veraltete.length || fehlerhaft.length}
			<details class="rest">
				<summary>
					{#if aktive.length}{aktive.length} aktiv{/if}
					{#if veraltete.length}{aktive.length ? ' · ' : ''}{veraltete.length} veraltet{/if}
					{#if fehlerhaft.length}{aktive.length || veraltete.length ? ' · ' : ''}{fehlerhaft.length} unlesbare Marker{/if}
				</summary>
				{#each aktive as a (a.sessionId)}
					<a class="a-item still" href={a.projektId ? '/projekt/' + a.projektId : '#'}>
						<span class="a-wann">{a.status}</span>
						<span class="a-titel">{a.projektTitel ?? a.cwd}</span>
						{#if adresse(a)}<code class="a-adresse">{adresse(a)}</code>{/if}
						<span class="a-host" title={a.plattformName + (a.ueber === 'http' ? ' · meldet über HTTP' : '')}>
					{#if a.plattformZeichen}<span class="plattform" aria-label={a.plattformName}>{a.plattformZeichen}</span>{/if}{a.host}
				</span>
					</a>
				{/each}
				{#each veraltete as a (a.sessionId)}
					<div class="a-item still veraltet" title="Zustandsdatei älter als 24 h – die Session ist vermutlich hart abgebrochen">
						<span class="a-wann">veraltet</span>
						<span class="a-titel">{a.projektTitel ?? a.cwd}</span>
						<span class="a-host" title={a.plattformName + (a.ueber === 'http' ? ' · meldet über HTTP' : '')}>
					{#if a.plattformZeichen}<span class="plattform" aria-label={a.plattformName}>{a.plattformZeichen}</span>{/if}{a.host}
				</span>
					</div>
				{/each}
				{#each agenten.filter((a) => a.meldefehler) as a (a.sessionId + ':f')}
					<div class="a-item still fehler" title={a.meldefehler}>
						<span class="a-wann">Meldung</span>
						<span class="a-titel">{a.projektTitel ?? a.cwd ?? a.sessionId}</span>
						<span class="a-fehler">Payload unlesbar</span>
					</div>
				{/each}
				{#each fehlerhaft as w, i (w.projektId + ':' + w.rel + ':' + w.zeile)}
					<div class="a-item still fehler" title={w.rel + ':' + w.zeile}>
						<span class="a-wann">Marker</span>
						<span class="a-titel">{w.text}</span>
						<span class="a-fehler">{w.fehler}</span>
						<span class="a-badge">{w.projektTitel}</span>
					</div>
				{/each}
			</details>
		{/if}
	</section>
{/if}

<style>
	.agenten {
		margin-bottom: 22px;
	}
	.agenten h2 {
		font-size: 15px;
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.dringend {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px 8px;
		border-radius: 99px;
		color: var(--kat-vorfall);
		border: 1px solid color-mix(in srgb, var(--kat-vorfall) 50%, var(--border));
		background: color-mix(in srgb, var(--kat-vorfall) 12%, transparent);
	}
	.dim {
		color: var(--text-dim);
		font-weight: 400;
		font-size: 13px;
	}
	.a-item {
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
	a.a-item:hover {
		border-color: var(--accent);
	}
	.a-item.wartet {
		border-color: color-mix(in srgb, var(--kat-vorfall) 45%, var(--border));
	}
	.a-item.wartet .a-wann {
		color: var(--kat-vorfall);
	}
	.a-item.sachlich .a-wann {
		color: var(--text-dim);
	}
	.a-item.nachfassen {
		border-color: color-mix(in srgb, var(--kat-entscheidung) 45%, var(--border));
	}
	.a-item.nachfassen .a-wann {
		color: var(--kat-entscheidung);
	}
	.a-wann {
		flex: none;
		min-width: 72px;
		font-size: 12px;
		font-weight: 700;
		color: var(--future);
		font-variant-numeric: tabular-nums;
	}
	.a-kat {
		flex: none;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-dim);
		min-width: 92px;
	}
	.a-titel {
		font-weight: 600;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.a-frage {
		color: var(--text-dim);
		font-size: 12.5px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.a-badge {
		flex: none;
		margin-left: auto;
		font-size: 11px;
		font-weight: 700;
		padding: 1px 8px;
		border-radius: 99px;
		background: var(--surface-2);
		color: var(--text-dim);
	}
	.a-adresse {
		flex: none;
		margin-left: auto;
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--accent);
	}
	.a-adresse.sendmsg {
		margin-left: 0;
		color: var(--text-dim);
	}
	.a-host {
		flex: none;
		font-size: 11px;
		color: var(--text-dim);
	}
	.plattform {
		margin-right: 5px;
		padding: 0 4px;
		border-radius: 4px;
		background: var(--surface-2);
		font-family: var(--mono);
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: help;
	}
	.a-nach {
		flex: none;
		font-size: 10.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--kat-entscheidung);
	}
	.a-fehler {
		flex: none;
		margin-left: auto;
		font-size: 11.5px;
		color: var(--kat-vorfall);
	}
	.rest {
		margin-top: 4px;
	}
	.rest summary {
		cursor: pointer;
		font-size: 12px;
		color: var(--text-dim);
		margin-bottom: 8px;
	}
	.a-item.still {
		opacity: 0.72;
	}
	.a-item.still .a-wann {
		color: var(--text-dim);
		font-weight: 600;
	}
</style>
