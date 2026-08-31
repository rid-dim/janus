<script>
	import { tageZwischen, monatsBaender, deDatum, KATEGORIEN } from '$lib/zeit.js';

	/** @type {{ eintraege: any[], von: string, bis: string, heute: string,
	 *           tagBreite: number, scrollEl?: HTMLElement|null }} */
	let { eintraege, von, bis, heute, tagBreite, scrollEl = $bindable(null) } = $props();

	const H = 9; // Höhe eines Markers
	const GAP = 2;

	const tage = $derived(Math.max(tageZwischen(von, bis) + 1, 1));
	const breite = $derived(Math.max(tage * tagBreite, 240));
	const baender = $derived(monatsBaender(von, bis));

	// Ereignisse eines Tages stapeln sich (ältestes unten) – Flamechart-artig.
	const marker = $derived.by(() => {
		const proTag = new Map();
		const out = [];
		for (const e of eintraege) {
			const i = tageZwischen(von, e.datum);
			if (i < 0 || i >= tage) continue;
			const s = proTag.get(i) ?? 0;
			proTag.set(i, s + 1);
			out.push({ e, i, stapel: s });
		}
		return out;
	});
	const maxStapel = $derived(marker.reduce((m, x) => Math.max(m, x.stapel + 1), 1));
	const hoehe = $derived(Math.max(maxStapel, 3) * (H + GAP) + 6);
	const heuteX = $derived(tageZwischen(von, heute));

	let hov = $state(null); // { e, i, stapel }

	const x = (i) => i * tagBreite + tagBreite / 2;
	const tipStil = $derived.by(() => {
		if (!hov?.r) return '';
		const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
		const cx = Math.min(Math.max(hov.r.left + hov.r.width / 2, 195), vw - 195);
		return `left:${cx}px; top:${hov.r.bottom + 10}px; transform:translateX(-50%);`;
	});
</script>

<div class="streifen">
	<div class="labspalte">
		<div class="legende">
			{#each KATEGORIEN as k}
				{#if (k.key === 'sonstig' && eintraege.some((e) => e.kategorie === 'sonstig')) || k.key !== 'sonstig'}
					<span class="leg kat-{k.key}"><i></i>{k.emoji} {k.label}</span>
				{/if}
			{/each}
		</div>
	</div>

	<div class="scroll" bind:this={scrollEl}>
		<div class="canvas" style="width:{breite}px">
			<div class="achse">
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

			<div class="plot" style="height:{hoehe}px">
				{#each baender as b (b.jahr + '-' + b.monat)}
					<div class="raster" style="left:{b.i * tagBreite}px"></div>
				{/each}
				{#if heuteX >= 0 && heuteX < tage}
					<div class="heute" style="left:{x(heuteX)}px" title="heute"><span class="heute-label">Heute</span></div>
				{/if}

				{#each marker as m (m.e.datum + '|' + m.i + '|' + m.stapel)}
					<button
						class="mark kat-{m.e.kategorie}"
						class:circa={m.e.circa}
						style="left:{x(m.i)}px; bottom:{m.stapel * (H + GAP)}px; width:{Math.max(
							5,
							Math.min(tagBreite - 1, 16)
						)}px; height:{H}px"
						onmouseenter={(ev) => (hov = { ...m, r: ev.currentTarget.getBoundingClientRect() })}
						onmouseleave={() => (hov = null)}
						onfocus={(ev) => (hov = { ...m, r: ev.currentTarget.getBoundingClientRect() })}
						onblur={() => (hov = null)}
						aria-label="{deDatum(m.e.datum)}: {m.e.text}"
					></button>
				{/each}

				{#if hov}
					<div class="tip" style={tipStil}>
						<div class="tip-kopf">
							<span class="tip-emoji">{hov.e.emoji}</span>
							<b>{deDatum(hov.e.datum)}</b>
							{#if hov.e.circa}<span class="ca">ca.</span>{/if}
						</div>
						<div class="tip-text">{hov.e.text}</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.streifen {
		display: flex;
		align-items: stretch;
		gap: 0;
	}
	.labspalte {
		flex: 0 0 var(--zeit-lab);
		width: var(--zeit-lab);
		display: flex;
		align-items: flex-end;
		padding: 0 12px 4px 2px;
		overflow: hidden;
	}
	.legende {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 11.5px;
		color: var(--text-dim);
	}
	.leg {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}
	.leg i {
		width: 11px;
		height: 8px;
		border-radius: 2px;
		background: var(--c);
		flex: 0 0 auto;
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
		height: 20px;
		border-bottom: 1px solid var(--border);
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

	.plot {
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
	.heute-label {
		position: absolute;
		top: -1px;
		left: 5px;
		font-size: 10px;
		font-weight: 700;
		color: var(--accent, var(--text));
		white-space: nowrap;
	}

	.mark {
		position: absolute;
		transform: translateX(-50%);
		padding: 0;
		border: 0;
		border-radius: 2px;
		background: var(--c);
		cursor: pointer;
		transition: filter 0.1s;
	}
	.mark:hover,
	.mark:focus-visible {
		filter: brightness(1.15);
		outline: 1px solid var(--text);
		outline-offset: 1px;
	}
	.mark.circa {
		opacity: 0.62;
	}

	.kat-entscheidung {
		--c: var(--kat-entscheidung);
	}
	.kat-vorfall {
		--c: var(--kat-vorfall);
	}
	.kat-korrespondenz {
		--c: var(--kat-korrespondenz);
	}
	.kat-sonstig {
		--c: var(--kat-sonstig);
	}

	.tip {
		position: fixed;
		z-index: 50;
		width: max-content;
		max-width: 360px;
		padding: 8px 11px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface);
		box-shadow: var(--shadow);
		pointer-events: none;
		font-size: 12.5px;
		line-height: 1.45;
	}
	.tip-kopf {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 3px;
	}
	.tip-emoji {
		font-size: 13px;
	}
	.ca {
		font-size: 11px;
		color: var(--text-dim);
	}
	.tip-text {
		color: var(--text);
		white-space: normal;
	}

	@media (max-width: 760px) {
		.streifen {
			flex-direction: column;
			gap: 6px;
		}
		.labspalte {
			flex: none;
			width: auto;
			align-items: flex-start;
			padding: 0 0 2px;
		}
		.legende {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 4px 12px;
		}
	}
</style>
