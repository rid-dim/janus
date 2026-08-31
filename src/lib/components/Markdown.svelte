<script>
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	/** @type {{ html: string, projectId: string, rel: string }} */
	let { html, projectId, rel } = $props();

	let container = $state(null);
	let mounted = false;

	async function renderPlots() {
		if (!container) return;
		const plots = container.querySelectorAll('.janus-plot:not([data-done])');
		if (!plots.length) return;
		let Plotly;
		try {
			Plotly = (await import('plotly.js-dist-min')).default;
		} catch (e) {
			console.error('Plotly konnte nicht geladen werden', e);
			return;
		}
		for (const el of plots) {
			el.setAttribute('data-done', '1');
			try {
				const spec = JSON.parse(decodeURIComponent(el.getAttribute('data-spec')));
				el.innerHTML = '';
				await Plotly.newPlot(el, spec.data || [], spec.layout || {}, {
					responsive: true,
					displayModeBar: false
				});
			} catch (e) {
				el.innerHTML = '<div class="janus-plot-fallback">⚠︎ Chart-Spec ungültig</div>';
			}
		}
	}

	async function postToggle(cb, checked) {
		const taskIndex = Number(cb.getAttribute('data-task-index'));
		try {
			const res = await fetch('/api/toggle', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ projectId, rel, taskIndex, checked })
			});
			const data = await res.json();
			if (!data.ok) throw new Error(data.error || 'toggle fehlgeschlagen');
			// Reload server data so the file on disk is the single source of truth –
			// otherwise switching between nodes remounts stale, pre-toggle HTML.
			await invalidateAll();
		} catch (e) {
			console.error(e);
			cb.checked = !checked; // revert on failure
		}
	}

	function onChange(ev) {
		const cb = ev.target;
		if (!cb.classList || !cb.classList.contains('janus-cb')) return;
		postToggle(cb, cb.checked);
	}

	async function onClick(ev) {
		// Document links open on disk.
		const link = ev.target.closest && ev.target.closest('.janus-doclink');
		if (link) {
			ev.preventDefault();
			const target = link.getAttribute('data-target');
			const kind = link.getAttribute('data-kind');
			try {
				const res = await fetch('/api/open', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ projectId, target, kind })
				});
				const data = await res.json();
				if (!data.ok) console.warn('Öffnen fehlgeschlagen:', data.error);
			} catch (e) {
				console.warn(e);
			}
			return;
		}

		// A click on the checkbox itself is handled by onChange – don't double-toggle.
		if (ev.target.classList?.contains('janus-cb')) return;

		// A click anywhere on the checkpoint text toggles its checkbox too.
		const li = ev.target.closest && ev.target.closest('li.janus-task');
		if (li) {
			const cb = li.querySelector('.janus-cb');
			if (cb) {
				const next = !cb.checked;
				cb.checked = next;
				postToggle(cb, next);
			}
		}
	}

	onMount(() => {
		mounted = true;
	});

	// Re-hydrate whenever the rendered html changes (e.g. navigation / node switch)
	$effect(() => {
		void html;
		if (container) renderPlots();
	});
</script>

<div
	class="md"
	bind:this={container}
	onchange={onChange}
	onclick={onClick}
	role="document"
>
	{@html html}
</div>
