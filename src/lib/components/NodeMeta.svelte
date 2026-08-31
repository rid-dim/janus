<script>
	import { postJSON } from '$lib/client/api.js';

	/** @type {{ node: any, allNodes: any[], projectId: string, onchanged?: () => void }} */
	let { node, allNodes, projectId, onchanged } = $props();

	// Local drafts – the parent remounts this component per node (keyed by id),
	// so plain initialisers stay in sync with the selected node.
	let title = $state(node.title);
	let status = $state(node.status);
	let deps = $state(new Set(node.depends_on));
	let busy = $state(false);
	let err = $state(null);

	const STATUS = ['offen', 'in-arbeit', 'fertig'];
	const others = $derived(allNodes.filter((n) => n.id !== node.id));

	const dirty = $derived(
		title.trim() !== node.title ||
			status !== node.status ||
			deps.size !== node.depends_on.length ||
			node.depends_on.some((d) => !deps.has(d))
	);

	function toggleDep(id) {
		const next = new Set(deps);
		next.has(id) ? next.delete(id) : next.add(id);
		deps = next;
	}

	async function save() {
		busy = true;
		err = null;
		try {
			await postJSON('/api/node-meta', {
				projectId,
				rel: node.rel,
				patch: { title: title.trim(), status, depends_on: [...deps] }
			});
			onchanged?.();
		} catch (e) {
			err = String(e.message || e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="node-meta">
	<div class="row">
		<label class="field grow">
			<span>Titel</span>
			<input bind:value={title} placeholder="Knoten-Titel" />
		</label>
		<label class="field">
			<span>Status</span>
			<select bind:value={status}>
				{#each STATUS as s}<option value={s}>{s}</option>{/each}
				{#if !STATUS.includes(status)}<option value={status}>{status}</option>{/if}
			</select>
		</label>
	</div>

	<div class="field">
		<span>Abhängig von <em>(DAG-Kanten – Klick schaltet um)</em></span>
		{#if others.length === 0}
			<p class="empty">Noch keine anderen Knoten vorhanden.</p>
		{:else}
			<div class="chips">
				{#each others as n (n.id)}
					<button
						class="chip"
						class:on={deps.has(n.id)}
						onclick={() => toggleDep(n.id)}
						title={n.id}
					>
						{deps.has(n.id) ? '✓ ' : '+ '}{n.title}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if err}<p class="err">{err}</p>{/if}

	<div class="actions">
		<button class="primary" disabled={busy || !dirty} onclick={save}>Metadaten speichern</button>
		{#if dirty}<span class="hint">ungespeicherte Änderungen</span>{/if}
	</div>
</div>

<style>
	.node-meta {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		border: 1px dashed var(--border);
		border-radius: 10px;
		background: var(--surface-2);
		margin-bottom: 12px;
	}
	.row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-dim);
	}
	.field.grow {
		flex: 1;
		min-width: 180px;
	}
	.field em {
		font-weight: 400;
		font-style: normal;
		opacity: 0.8;
	}
	input,
	select {
		padding: 7px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-weight: 500;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-dim);
		font: inherit;
		font-size: 12.5px;
		cursor: pointer;
	}
	.chip.on {
		border-color: color-mix(in srgb, var(--future) 55%, var(--border));
		background: color-mix(in srgb, var(--future) 14%, transparent);
		color: var(--future);
		font-weight: 600;
	}
	.empty {
		margin: 2px 0 0;
		font-weight: 400;
		font-style: italic;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	button.primary {
		padding: 6px 14px;
		border: 1px solid var(--accent);
		border-radius: 8px;
		background: var(--accent);
		color: #fff;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	button.primary:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.hint {
		font-size: 11.5px;
		color: var(--future);
	}
	.err {
		margin: 0;
		color: #d1495b;
		font-size: 13px;
	}
</style>
