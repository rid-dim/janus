<script>
	import Aktivitaet from './Aktivitaet.svelte';

	/** @type {{ project: any, agent?: any }} */
	let { project, agent = null } = $props();
	const pct = $derived(
		project.progress.total > 0
			? Math.round((project.progress.done / project.progress.total) * 100)
			: 0
	);
</script>

<a class="card" href="/projekt/{project.id}" style="--ton: {project.farbe}">
	<!-- Griff zum Umsortieren. Nur er ist ziehbar, damit das Ziehen einer
	     Kachel nicht mit dem gewöhnlichen Link-Ziehen kollidiert. -->
	<span
		class="griff"
		draggable="true"
		title="Ziehen, um die Reihenfolge zu ändern"
		aria-label="Reihenfolge ändern"
		ondragstart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', project.id); }}
		onclick={(e) => e.preventDefault()}
	>⠿</span>
	<div class="card-head">
		<span class="punkt" aria-hidden="true"></span>
		<h3>{project.titel}</h3>
		{#if agent}<Aktivitaet {agent} />{/if}
		<span class="pill status-{(project.status || '').replace(/\s+/g, '-')}">{project.status}</span>
	</div>
	{#if project.beschreibung}
		<p class="card-desc">{project.beschreibung}</p>
	{/if}
	<div class="card-meta">
		<div class="progress"><span style="width:{pct}%"></span></div>
		<span class="card-count">{project.progress.done}/{project.progress.total} Checkpoints · {project.nodeCount} Knoten</span>
	</div>
	<div class="card-foot">
		<span class="src src-{project.source}">{project.source === 'linked' ? 'im Repo' : 'Store'}</span>
		<span class="loc" title={project.location}>&lrm;{project.location}</span>
	</div>
	{#if project.tags?.length}
		<div class="card-tags">
			{#each project.tags as t}<span class="tag">{t}</span>{/each}
		</div>
	{/if}
</a>

<style>
	.card {
		position: relative;
	}
	@media (prefers-color-scheme: dark) {
		.punkt {
			background: hsl(var(--ton, 210) 52% 64%);
		}
	}
	:global([data-theme='dark']) .punkt {
		background: hsl(var(--ton, 210) 52% 64%);
	}
	.punkt {
		flex: none;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: hsl(var(--ton, 210) 55% 48%);
		align-self: center;
	}

	.griff {
		position: absolute;
		top: 6px;
		right: 8px;
		cursor: grab;
		color: var(--text-dim);
		font-size: 13px;
		line-height: 1;
		padding: 2px 4px;
		border-radius: 5px;
		opacity: 0;
		transition: opacity 0.12s;
	}
	.card:hover .griff,
	.griff:focus-visible {
		opacity: 0.75;
	}
	.griff:active {
		cursor: grabbing;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px 17px;
		/* Farbe des Projekts – dieselbe trägt jede seiner Nachrichten im Kanal.
		   Flächig, aber zurückhaltend: die Kachel soll erkennbar sein, ohne dem
		   Text die Ruhe zu nehmen. Weitergereicht wird nur der Farbton;
		   Sättigung und Helligkeit setzt das Thema, sonst wäre die Farbe in
		   einem der beiden unlesbar. */
		background: hsl(var(--ton, 210) 55% 96.5%);
		border: 1px solid hsl(var(--ton, 210) 35% 87%);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		color: var(--text);
		transition: transform 0.12s, border-color 0.12s;
	}
	.card:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
		text-decoration: none;
	}
	@media (prefers-color-scheme: dark) {
		.card {
			background: hsl(var(--ton, 210) 24% 15%);
			border-color: hsl(var(--ton, 210) 22% 27%);
		}
		.card:hover {
			background: hsl(var(--ton, 210) 26% 19%);
		}
	}
	.card-head {
		gap: 8px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.card-head h3 {
		margin: 0;
		font-size: 1.08em;
	}
	.card-desc {
		margin: 0;
		color: var(--text-dim);
		font-size: 14px;
	}
	.card-meta {
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-top: auto;
	}
	.card-count {
		font-size: 12px;
		color: var(--text-dim);
	}
	.card-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.src {
		font-size: 11px;
		font-weight: 600;
		padding: 1px 7px;
		border-radius: 6px;
		white-space: nowrap;
	}
	.src-linked {
		color: var(--future);
		background: color-mix(in srgb, var(--future) 14%, transparent);
	}
	.src-store {
		color: var(--past);
		background: color-mix(in srgb, var(--past) 14%, transparent);
	}
	.loc {
		font-size: 11.5px;
		color: var(--text-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		direction: rtl;
		text-align: left;
	}
	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.tag {
		font-size: 11px;
		color: var(--text-dim);
		background: var(--surface-2);
		border-radius: 6px;
		padding: 1px 7px;
	}
</style>
