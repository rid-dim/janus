<script>
	import { tageZwischen, monatsBaender, deDatum } from '$lib/zeit.js';

	/** @type {{ themen: any[], ohneZeitraum: any[], von: string, bis: string, heute: string,
	 *           tagBreite: number, projektId: string, scrollEl?: HTMLElement|null }} */
	let {
		themen,
		ohneZeitraum,
		von,
		bis,
		heute,
		tagBreite,
		projektId,
		scrollEl = $bindable(null)
	} = $props();

	const ZEILE = 42; // Zeilenhöhe – Label- und Balkenspalte müssen gleich hoch sein

	const tage = $derived(Math.max(tageZwischen(von, bis) + 1, 1));
	const breite = $derived(Math.max(tage * tagBreite, 240));
	const baender = $derived(monatsBaender(von, bis));
	const heuteX = $derived(tageZwischen(von, heute));

	function geo(t) {
		const a = Math.max(tageZwischen(von, t.start), 0);
		const b = Math.min(tageZwischen(von, t.bisDatum) + 1, tage);
		return { left: a * tagBreite, width: Math.max((b - a) * tagBreite, 4) };
	}
	const link = (t) => `/projekt/${projektId}?knoten=${encodeURIComponent(t.id)}`;

	function altersText(t) {
		if (t.status === 'fertig') return t.dauer != null ? `${t.dauer} Tage` : 'abgeschlossen';
		return `seit ${t.tage} Tagen`;
	}
	function balkenTitel(t) {
		const bis2 = t.ende ? deDatum(t.ende) : t.status === 'fertig' ? 'Ende offen' : 'heute';
		const cp = t.tasks?.total ? ` · Checkpoints ${t.tasks.done}/${t.tasks.total}` : '';
		return `${t.title}\n${deDatum(t.start)} – ${bis2} · ${altersText(t)} · ${t.status}${cp}`;
	}
</script>

<div class="gantt">
	<div class="labspalte">
		<div class="kopfzeile"></div>
		{#each themen as t (t.id)}
			<a
				class="lab status-{t.status}"
				class:fertig={t.status === 'fertig'}
				href={link(t)}
				style="height:{ZEILE}px"
				title={balkenTitel(t)}
			>
				<span class="lab-titel"><i class="punkt"></i>{t.title}</span>
				<span class="lab-meta">
					<span class:langlaeufer={t.langlaeufer}>
						{#if t.langlaeufer}⏳{/if}{altersText(t)}
					</span>
					{#if t.tasks?.total}<span class="cp">· {t.tasks.done}/{t.tasks.total}</span>{/if}
				</span>
			</a>
		{/each}
	</div>

	<div class="scroll" bind:this={scrollEl}>
		<div class="canvas" style="width:{breite}px">
			<div class="achse kopfzeile">
				{#each baender as b (b.jahr + '-' + b.monat)}
					<div
						class="band"
						class:alt={b.monat % 2 === 0}
						style="left:{b.i * tagBreite}px; width:{b.breite * tagBreite}px"
						title={b.lang}
					>
						<span class="bandlabel">{b.breite * tagBreite > 62 ? b.label : ''}</span>
					</div>
				{/each}
			</div>

			<div class="zeilen" style="height:{themen.length * ZEILE}px">
				{#each baender as b (b.jahr + '-' + b.monat)}
					<div class="raster" style="left:{b.i * tagBreite}px"></div>
				{/each}
				{#if heuteX >= 0 && heuteX < tage}
					<div class="heute" style="left:{heuteX * tagBreite + tagBreite / 2}px" title="heute"></div>
				{/if}

				{#each themen as t, zi (t.id)}
					{@const g = geo(t)}
					<a
						class="balken status-{t.status}"
						class:offenesEnde={t.endeUnbekannt && t.status !== 'fertig'}
						href={link(t)}
						style="top:{zi * ZEILE + 8}px; left:{g.left}px; width:{g.width}px"
						title={balkenTitel(t)}
					>
						<span class="balken-text">
							{altersText(t)}{#if t.tasks?.total}&nbsp;· {t.tasks.done}/{t.tasks.total}{/if}
						</span>
					</a>
				{/each}
			</div>
		</div>
	</div>
</div>

{#if ohneZeitraum.length}
	<div class="ohne">
		<div class="ohne-kopf">Ohne Zeitraum ({ohneZeitraum.length})</div>
		<ul>
			{#each ohneZeitraum as t (t.id)}
				<li>
					<a href={link(t)}>
						<i class="punkt status-{t.status}"></i>{t.title}
					</a>
					<span class="ohne-meta">
						{t.status}{#if t.tasks?.total}&nbsp;· {t.tasks.done}/{t.tasks.total}{/if}
					</span>
				</li>
			{/each}
		</ul>
		<p class="hinweis">
			Tipp: <code>start: JJJJ-MM-TT</code> (optional <code>ende:</code>) ins Frontmatter des Knotens
			schreiben, dann erscheint er oben im Gantt.
		</p>
	</div>
{/if}

<style>
	.gantt {
		display: flex;
		align-items: stretch;
	}
	.labspalte {
		flex: 0 0 var(--zeit-lab);
		width: var(--zeit-lab);
		display: flex;
		flex-direction: column;
		padding-right: 12px;
		overflow: hidden;
	}
	.kopfzeile {
		height: 20px;
		flex: 0 0 auto;
		/* transparente Kante spiegelt den Rahmen der Achse -> Zeilen fluchten */
		border-bottom: 1px solid transparent;
	}

	.lab {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1px;
		padding: 0 4px 0 2px;
		border-radius: 7px;
		color: var(--text);
		text-decoration: none;
		overflow: hidden;
	}
	.lab:hover {
		background: var(--surface-2);
		text-decoration: none;
	}
	.lab-titel {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.lab.fertig .lab-titel {
		color: var(--text-dim);
		font-weight: 500;
	}
	.lab-meta {
		font-size: 11px;
		color: var(--text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding-left: 16px;
	}
	.langlaeufer {
		color: var(--kat-vorfall);
		font-weight: 700;
	}
	.cp {
		opacity: 0.85;
	}

	.punkt {
		flex: 0 0 auto;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--st);
	}

	.scroll {
		flex: 1 1 auto;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.canvas {
		position: relative;
		min-width: 100%;
	}
	.achse {
		position: relative;
		border-bottom-color: var(--border);
	}
	.band {
		position: absolute;
		top: 0;
		bottom: 0;
		overflow: hidden;
	}
	.band.alt {
		background: color-mix(in srgb, var(--surface-2) 70%, transparent);
	}
	.bandlabel {
		position: absolute;
		left: 5px;
		top: 2px;
		font-size: 11px;
		font-weight: 650;
		letter-spacing: 0.03em;
		color: var(--text);
		opacity: 0.8;
		white-space: nowrap;
	}
	.zeilen {
		position: relative;
	}
	.raster {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--border);
		opacity: 0.55;
	}
	.heute {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.balken {
		position: absolute;
		height: 26px;
		display: flex;
		align-items: center;
		padding: 0 8px;
		border-radius: 7px;
		border: 1px solid var(--st-rand);
		background: var(--st-fuell);
		color: var(--st-text);
		font-size: 11.5px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-decoration: none;
		transition: filter 0.12s, box-shadow 0.12s;
	}
	.balken:hover {
		text-decoration: none;
		filter: brightness(1.06);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 32%, transparent);
	}
	.balken-text {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Balken, dessen Ende nicht feststeht, franst rechts aus */
	.balken.offenesEnde {
		border-right-style: dashed;
		border-top-right-radius: 2px;
		border-bottom-right-radius: 2px;
	}

	/* --- Status-Farben, konsistent zur übrigen App --- */
	.status-offen {
		--st: var(--text-dim);
		--st-rand: var(--border);
		--st-fuell: color-mix(in srgb, var(--text-dim) 18%, var(--surface));
		--st-text: var(--text-dim);
	}
	.status-in-arbeit,
	.status-aktiv {
		--st: var(--future);
		--st-rand: color-mix(in srgb, var(--future) 55%, var(--border));
		--st-fuell: color-mix(in srgb, var(--future) 26%, var(--surface));
		--st-text: color-mix(in srgb, var(--future) 78%, var(--text));
	}
	.status-fertig,
	.status-erledigt,
	.status-done {
		--st: var(--ok);
		--st-rand: color-mix(in srgb, var(--ok) 45%, var(--border));
		--st-fuell: color-mix(in srgb, var(--ok) 20%, var(--surface));
		--st-text: color-mix(in srgb, var(--ok) 75%, var(--text));
	}
	.balken.status-fertig,
	.balken.status-erledigt,
	.balken.status-done {
		opacity: 0.62;
	}

	/* --- Knoten ohne Zeitraum --- */
	.ohne {
		margin-top: 16px;
		padding-left: 2px;
	}
	.ohne-kopf {
		font-size: 0.72em;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
		margin-bottom: 6px;
	}
	.ohne ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px 10px;
	}
	.ohne li {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 4px 11px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		font-size: 12.5px;
	}
	.ohne li a {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		color: var(--text);
		font-weight: 600;
	}
	.ohne-meta {
		color: var(--text-dim);
		font-size: 11.5px;
	}
	.hinweis {
		margin: 10px 0 0;
		font-size: 12px;
		color: var(--text-dim);
	}
	.hinweis code {
		font-family: var(--mono);
		font-size: 0.9em;
		background: var(--surface-2);
		padding: 1px 5px;
		border-radius: 5px;
	}

	@media (max-width: 760px) {
		.labspalte {
			flex-basis: 130px;
			width: 130px;
		}
	}
</style>
