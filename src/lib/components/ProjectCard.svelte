<script>
	/** @type {{ project: any }} */
	let { project } = $props();
	const pct = $derived(
		project.progress.total > 0
			? Math.round((project.progress.done / project.progress.total) * 100)
			: 0
	);
</script>

<a class="card" href="/projekt/{project.id}">
	<div class="card-head">
		<h3>{project.titel}</h3>
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
		<span class="loc" title={project.location}>{project.location}</span>
	</div>
	{#if project.tags?.length}
		<div class="card-tags">
			{#each project.tags as t}<span class="tag">{t}</span>{/each}
		</div>
	{/if}
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px 17px;
		background: var(--surface);
		border: 1px solid var(--border);
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
	.card-head {
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
