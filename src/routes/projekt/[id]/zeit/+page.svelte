<script>
	import { onMount } from 'svelte';
	import Aktivitaetsstreifen from '$lib/components/Aktivitaetsstreifen.svelte';
	import ThemenGantt from '$lib/components/ThemenGantt.svelte';
	import { deDatum, tageZwischen } from '$lib/zeit.js';

	let { data } = $props();
	const p = $derived(data.projekt);

	// --- Zoomstufen der Zeitachse (Pixel pro Tag) -----------------------------
	const STUFEN = [1.5, 2.5, 4, 6, 9, 14];
	let stufe = $state(2);
	const tagBreite = $derived(STUFEN[stufe]);

	onMount(() => {
		try {
			const s = Number(localStorage.getItem('janus.zeit.zoom'));
			if (Number.isFinite(s) && s >= 0 && s < STUFEN.length) stufe = s;
		} catch {
			/* ignore */
		}
		// Startansicht: rechtes Ende (heute) im Blick
		queueMicrotask(() => {
			for (const el of [streifenEl, gantEl]) {
				if (el) el.scrollLeft = el.scrollWidth;
			}
		});
	});
	function zoom(d) {
		stufe = Math.min(STUFEN.length - 1, Math.max(0, stufe + d));
		try {
			localStorage.setItem('janus.zeit.zoom', String(stufe));
		} catch {
			/* ignore */
		}
	}

	// --- horizontales Scrollen der beiden Achsen koppeln -----------------------
	let streifenEl = $state(null);
	let gantEl = $state(null);
	$effect(() => {
		const a = streifenEl;
		const b = gantEl;
		if (!a || !b) return;
		let sperre = false;
		const kopple = (von, nach) => () => {
			if (sperre) return;
			sperre = true;
			nach.scrollLeft = von.scrollLeft;
			requestAnimationFrame(() => (sperre = false));
		};
		const ha = kopple(a, b);
		const hb = kopple(b, a);
		a.addEventListener('scroll', ha, { passive: true });
		b.addEventListener('scroll', hb, { passive: true });
		return () => {
			a.removeEventListener('scroll', ha);
			b.removeEventListener('scroll', hb);
		};
	});

	const spanneTage = $derived(tageZwischen(data.von, data.bis) + 1);
	const langlaeufer = $derived(data.themen.filter((t) => t.langlaeufer));
</script>

<svelte:head><title>{p.titel} · Zeitleiste · Janus</title></svelte:head>

<div class="zeit-layout">
	<aside class="sidebar">
		<div class="sidebar-head"><a class="sidebar-title" href="/">Projekte</a></div>
		<nav class="sidebar-nav">
			{#each data.projects as pr (pr.id)}
				<a class="side-item" class:active={pr.id === p.id} href="/projekt/{pr.id}/zeit" title={pr.titel}>
					<span class="side-name">{pr.titel}</span>
					<span class="dot status-{(pr.status || '').replace(/\s+/g, '-')}"></span>
				</a>
			{/each}
		</nav>
	</aside>

	<div class="zeit-main">
		<div class="proj-head">
			<a href="/projekt/{p.id}" class="back">← Projekt</a>
			<h1>{p.titel}</h1>
			<span class="pill status-{(p.status || '').replace(/\s+/g, '-')}">{p.status}</span>
			<nav class="viewtabs">
				<a class="vtab" href="/projekt/{p.id}">Projekt</a>
				<a class="vtab" href="/projekt/{p.id}/wiki">Wiki</a>
				<span class="vtab on">Zeitleiste</span>
			</nav>
			<div class="head-actions">
				<span class="spanne">{deDatum(data.von)} – {deDatum(data.bis)} · {spanneTage} Tage</span>
				<div class="zoomer">
					<button class="tb" onclick={() => zoom(-1)} disabled={stufe === 0} title="Zeitachse stauchen">−</button>
					<button class="tb" onclick={() => zoom(1)} disabled={stufe === STUFEN.length - 1} title="Zeitachse dehnen">+</button>
				</div>
			</div>
		</div>

		<div class="zeit-scroll">
			<section class="block">
				<h2 class="block-title">
					Aktivität
					<span class="grow"></span>
					{#if data.chronik.rel}
						<span class="meta">{data.chronik.eintraege.length} Einträge · {data.chronik.titel}</span>
					{/if}
				</h2>
				{#if data.chronik.eintraege.length}
					<Aktivitaetsstreifen
						eintraege={data.chronik.eintraege}
						von={data.von}
						bis={data.bis}
						heute={data.heute}
						{tagBreite}
						bind:scrollEl={streifenEl}
					/>
				{:else}
					<p class="dim">
						Keine datierten Chronik-Einträge gefunden (erwartet:
						<code>stand/chronik.md</code> mit Zeilen wie <code>- **21.08.** ⚡ …</code> unter einer
						Monats-/Jahresüberschrift).
					</p>
				{/if}
			</section>

			<section class="block">
				<h2 class="block-title">
					Themen
					<span class="grow"></span>
					{#if langlaeufer.length}
						<span class="meta warn">⏳ {langlaeufer.length} Langläufer (&gt; 90 Tage)</span>
					{/if}
					<span class="meta">{data.themen.length} mit Zeitraum</span>
				</h2>
				{#if data.themen.length}
					<ThemenGantt
						themen={data.themen}
						ohneZeitraum={data.ohneZeitraum}
						von={data.von}
						bis={data.bis}
						heute={data.heute}
						{tagBreite}
						projektId={p.id}
						bind:scrollEl={gantEl}
					/>
				{:else}
					<p class="dim">
						Noch kein Thema mit <code>start:</code> im Frontmatter.
						{#if data.ohneZeitraum.length}
							{data.ohneZeitraum.length} Knoten ohne Zeitraum:
							<span class="inline-liste">
								{#each data.ohneZeitraum as t, i (t.id)}<a href="/projekt/{p.id}?knoten={t.id}"
										>{t.title}</a
									>{#if i < data.ohneZeitraum.length - 1}, {/if}{/each}
							</span>
						{/if}
					</p>
				{/if}
			</section>
		</div>
	</div>
</div>

<style>
	.zeit-layout {
		display: flex;
		height: calc(100dvh - var(--topbar-h));
		overflow: hidden;
	}
	.zeit-main {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.zeit-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 4px 22px 40px;
	}

	.sidebar {
		flex: 0 0 auto;
		width: 224px;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		background: var(--surface);
		overflow: hidden;
	}
	.sidebar-head {
		display: flex;
		align-items: center;
		gap: 8px;
		height: var(--topbar-h);
		padding: 0 14px;
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
	.dot.status-fertig {
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
	.head-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-left: auto;
	}
	.spanne {
		font-size: 12px;
		color: var(--text-dim);
		white-space: nowrap;
	}
	.zoomer {
		display: flex;
		gap: 4px;
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
		font-size: 14px;
		cursor: pointer;
	}
	.tb:hover {
		border-color: var(--accent);
	}
	.tb:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.block {
		margin-bottom: 26px;
	}
	.block-title {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.8em;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
		margin: 0 0 12px;
		padding-bottom: 6px;
		border-bottom: 2px solid var(--border);
	}
	.grow {
		flex: 1;
	}
	.meta {
		text-transform: none;
		letter-spacing: 0;
		font-size: 12px;
		font-weight: 500;
	}
	.meta.warn {
		color: var(--kat-vorfall);
		font-weight: 700;
	}
	.dim {
		color: var(--text-dim);
		font-size: 13.5px;
	}
	.dim code {
		font-family: var(--mono);
		font-size: 0.88em;
		background: var(--surface-2);
		padding: 1px 5px;
		border-radius: 5px;
	}
	.inline-liste a {
		font-size: 13px;
	}

	@media (max-width: 900px) {
		.sidebar {
			display: none;
		}
		.zeit-layout {
			height: auto;
			overflow: visible;
		}
	}
</style>
