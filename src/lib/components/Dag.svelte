<script>
	/** @type {{ geplant: any, selectedId: string|null,
	 *           onselect: (id:string)=>void, onadvance?: (id:string)=>void }} */
	let { geplant, selectedId, onselect, onadvance } = $props();

	const nodeById = $derived(new Map(geplant.nodes.map((n) => [n.id, n])));
	const connected = $derived(geplant.nodes.filter((n) => !n.loose));
	const loose = $derived(geplant.nodes.filter((n) => n.loose));

	function edgePath(e) {
		const a = nodeById.get(e.from);
		const b = nodeById.get(e.to);
		if (!a || !b) return '';
		const x1 = a.x + a.w;
		const y1 = a.y + a.h / 2;
		const x2 = b.x;
		const y2 = b.y + b.h / 2;
		const dx = Math.max(40, (x2 - x1) / 2);
		return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
	}

	function statusClass(s) {
		return 'status-' + (s || 'offen').replace(/\s+/g, '-');
	}
</script>

{#snippet nodeCard(n, positioned)}
	<button
		class="dag-node"
		class:selected={n.id === selectedId}
		class:flow={!positioned}
		style={positioned ? `left:${n.x}px; top:${n.y}px; width:${n.w}px; height:${n.h}px;` : ''}
		onclick={() => onselect(n.id)}
		ondblclick={() => onadvance?.(n.id)}
		title="Klick: auswählen · Doppelklick: Status weiterschalten"
	>
		<div class="dag-node-head">
			<span class="dag-node-title">{n.title}</span>
			<span class="pill {statusClass(n.status)}">{n.status}</span>
		</div>
		{#if n.tasks.total > 0}
			<div class="dag-node-progress">
				<div class="progress">
					<span style="width:{Math.round((n.tasks.done / n.tasks.total) * 100)}%"></span>
				</div>
				<span class="dag-node-count">{n.tasks.done}/{n.tasks.total}</span>
			</div>
		{:else if n.preview}
			<div class="dag-node-text">{n.preview}</div>
		{:else}
			<div class="dag-node-count dim">leer</div>
		{/if}
	</button>
{/snippet}

<div class="dag">
	{#if connected.length}
		<div class="dag-scroll">
			<div class="dag-canvas" style="width:{geplant.width}px; height:{geplant.height}px;">
				<svg width={geplant.width} height={geplant.height} class="dag-edges">
					<defs>
						<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
							<path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-dim)" />
						</marker>
					</defs>
					{#each geplant.edges as e}
						<path class="dag-edge" d={edgePath(e)} marker-end="url(#arrow)" />
					{/each}
				</svg>
				{#each connected as n (n.id)}
					{@render nodeCard(n, true)}
				{/each}
			</div>
		</div>
	{/if}

	{#if loose.length}
		<div class="loose">
			{#if connected.length}
				<div class="loose-label">Lose Knoten ({loose.length})</div>
			{/if}
			<div class="loose-grid">
				{#each loose as n (n.id)}
					{@render nodeCard(n, false)}
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.dag {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
	}
	.dag-scroll {
		overflow: auto;
		background:
			radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0) 0 0 / 22px 22px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background-color: var(--surface);
	}
	.dag-canvas {
		position: relative;
		min-width: 100%;
	}
	.dag-edges {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.dag-edge {
		fill: none;
		stroke: var(--text-dim);
		stroke-width: 1.6;
		opacity: 0.65;
	}

	.loose {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
	}
	.loose-label {
		font-size: 0.72em;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
		margin-bottom: 8px;
	}
	.loose-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.dag-node {
		position: absolute;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 8px;
		padding: 11px 13px;
		text-align: left;
		font: inherit;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: var(--shadow);
		cursor: pointer;
		transition: border-color 0.12s, transform 0.12s;
	}
	.dag-node.flow {
		position: relative;
		width: 230px;
		min-height: 96px;
	}
	.dag-node:hover {
		transform: translateY(-1px);
	}
	.dag-node.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent), var(--shadow);
	}
	.dag-node-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.dag-node-title {
		font-weight: 620;
		font-size: 14px;
		line-height: 1.2;
	}
	.dag-node-progress {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dag-node-progress .progress {
		flex: 1;
	}
	.dag-node-count {
		font-size: 12px;
		color: var(--text-dim);
		white-space: nowrap;
	}
	.dag-node-count.dim {
		font-style: italic;
	}
	.dag-node-text {
		font-size: 12px;
		line-height: 1.4;
		color: var(--text-dim);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
