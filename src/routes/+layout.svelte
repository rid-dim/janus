<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	let { children } = $props();

	// Theme-Wahl: 'system' folgt prefers-color-scheme, 'light'/'dark' überstimmen
	// es via data-theme auf <html> (initial gesetzt vom Inline-Script in app.html).
	let theme = $state('system');

	const themeLabel = { system: 'System', light: 'Hell', dark: 'Dunkel' };

	function applyTheme(t) {
		theme = t;
		if (t === 'system') {
			delete document.documentElement.dataset.theme;
			localStorage.removeItem('janus-theme');
		} else {
			document.documentElement.dataset.theme = t;
			localStorage.setItem('janus-theme', t);
		}
	}

	function cycleTheme() {
		applyTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system');
	}

	// The app is only a view on the files; external changes (a deleted/added
	// project folder, an agent editing markdown) aren't pushed. Re-read from disk
	// whenever the tab regains focus/visibility – no watcher, no polling.
	onMount(() => {
		theme = document.documentElement.dataset.theme || 'system';

		let last = 0;
		const refresh = () => {
			const now = Date.now();
			if (now - last < 500) return; // collapse focus+visibility double-fires
			last = now;
			invalidateAll();
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') refresh();
		};
		window.addEventListener('focus', refresh);
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			window.removeEventListener('focus', refresh);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<div class="janus-topbar">
	<a class="janus-logo" href="/">
		<svg viewBox="0 0 32 32" aria-hidden="true">
			<circle cx="11" cy="16" r="4.4" fill="none" stroke="var(--past)" stroke-width="2" />
			<circle cx="21" cy="16" r="4.4" fill="none" stroke="var(--future)" stroke-width="2" />
			<line x1="16" y1="6" x2="16" y2="26" stroke="var(--border)" stroke-width="1.4" />
		</svg>
		Janus
	</a>
	<button
		class="theme-toggle"
		onclick={cycleTheme}
		title="Farbschema: {themeLabel[theme]} (klicken zum Wechseln)"
		aria-label="Farbschema wechseln, aktuell {themeLabel[theme]}"
	>
		{#if theme === 'light'}
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" stroke-width="1.8" />
				<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
					<line x1="12" y1="2.5" x2="12" y2="5" />
					<line x1="12" y1="19" x2="12" y2="21.5" />
					<line x1="2.5" y1="12" x2="5" y2="12" />
					<line x1="19" y1="12" x2="21.5" y2="12" />
					<line x1="5.3" y1="5.3" x2="7" y2="7" />
					<line x1="17" y1="17" x2="18.7" y2="18.7" />
					<line x1="5.3" y1="18.7" x2="7" y2="17" />
					<line x1="17" y1="7" x2="18.7" y2="5.3" />
				</g>
			</svg>
		{:else if theme === 'dark'}
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linejoin="round"
				/>
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<rect
					x="3"
					y="4.5"
					width="18"
					height="12.5"
					rx="2"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
				/>
				<line
					x1="8.5"
					y1="20.5"
					x2="15.5"
					y2="20.5"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
		{/if}
		<span class="theme-toggle-label">{themeLabel[theme]}</span>
	</button>
</div>

{@render children()}
